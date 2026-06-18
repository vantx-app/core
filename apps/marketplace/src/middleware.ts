import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieSettings, isTokenExpired, applyRequestHeadersToResponse, refreshSessionInMiddleware } from "@vantx/auth";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|css|js)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Solo nos interesa la página principal u otras vistas del Marketplace
  if (pathname !== "/" && !pathname.startsWith("/drivers/"))
    return NextResponse.next();

  // Si no hay refresh_token, es un invitado, seguimos adelante sin autenticar
  if (!refreshToken) return NextResponse.next();

  let response = NextResponse.next();

  // Si el access_token no existe o está expirado, intentamos refrescarlo en el servidor
  if (!accessToken || isTokenExpired(accessToken)) {
    try {
      const result = await refreshSessionInMiddleware({
        refreshToken,
        userAgent: request.headers.get("user-agent") || "VantX-Middleware",
        internalApiUrl: process.env.INTERNAL_API_URL || "http://localhost:8000",
      });

      if (!result.success) {
        throw new Error(result.errorType || "TRANSIENT_ERROR");
      }

      const newToken = result.newToken!;

      // Clonamos headers para que los Server Components vean el nuevo token en este renderizado
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        "cookie",
        `access_token=${newToken}; refresh_token=${refreshToken}`,
      );

      // Creamos la respuesta estándar de Next.js
      response = NextResponse.next();

      // Propagamos de manera robusta las cookies devueltas por el helper
      result.cookiesToSet?.forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      });

      // WORKAROUND CRÍTICO: Aplicamos la cabecera de anulación para que Next.js no descarte las cookies
      applyRequestHeadersToResponse(response, requestHeaders);

      return response;
    } catch (error: any) {
      console.error(
        "[Auth] Error crítico en middleware de marketplace:",
        error,
      );

      // Si es un error de red o de servidor (5xx, timeouts), no borramos sesión.
      // Permitimos que proceda de manera normal (los fetches del cliente fallarán controladamente).
      if (
        error?.message === "TRANSIENT_ERROR" ||
        (error instanceof Error && error.message !== "AUTH_FAILED")
      ) {
        return NextResponse.next();
      }

      // Limpieza agresiva de cookies en caso de falla real de autenticación
      const response = NextResponse.next();
      const deleteSettings = getCookieSettings(0);
      response.cookies.delete({ name: "access_token", ...deleteSettings });
      response.cookies.delete({ name: "refresh_token", ...deleteSettings });
      return response;
    }
  }

  return response;
}
