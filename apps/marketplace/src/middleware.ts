import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieSettings, isTokenExpired, refreshSessionInMiddleware } from "@vantx/auth";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|css|js)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Resolución robusta del host del cliente (evitando 0.0.0.0 cuando Next.js corre en un contenedor con HOSTNAME=0.0.0.0)
  let host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  if (host.startsWith("0.0.0.0")) {
    host = host.replace("0.0.0.0", "localhost");
  }

  let protocol =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol;
  protocol = protocol.replace(/:$/, "");

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
        internalApiUrl: process.env.CRM_API_URL || "http://localhost:8000",
      });

      if (!result.success) {
        throw new Error(result.errorType || "TRANSIENT_ERROR");
      }

      const newToken = result.newToken!;

      // Redireccionamiento de Escritura (Redirect-to-Self):
      // Creamos una respuesta de redirección a la misma URL para forzar al navegador
      // a guardar las cookies de manera persistente antes de renderizar.
      // Modificamos el protocolo y el host para asegurar que coincida con el cliente público (evita subdominios de Docker)
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.protocol = protocol;
      redirectUrl.host = host;
      response = NextResponse.redirect(redirectUrl);
 
      // Propagamos de manera robusta las cookies devueltas por el helper
      result.cookiesToSet?.forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      });
 
      // Deshabilitamos la caché de middleware para garantizar la frescura de los tokens
      response.headers.set("x-middleware-cache", "no-cache");
      // Evitamos agresivamente que el navegador o WebView del PWA cachee la respuesta de redirección 307
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      response.headers.set("Pragma", "no-cache");
 
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
