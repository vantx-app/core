// apps/marketplace/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieSettings, parseSetCookie } from "@vantx/auth";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|css|js)$).*)",
  ],
};

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

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
      const internalApiUrl =
        process.env.INTERNAL_API_URL || "http://localhost:8000";
      const res = await fetch(`${internalApiUrl}/api/auth/refresh`, {
        method: "POST",
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
          "User-Agent": request.headers.get("user-agent") || "VantX-Middleware",
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("AUTH_FAILED");
        }
        throw new Error("TRANSIENT_ERROR");
      }

      const { accessToken: newToken } = await res.json();

      // Clonamos headers para que los Server Components vean el nuevo token en este renderizado
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        "cookie",
        `access_token=${newToken}; refresh_token=${refreshToken}`,
      );

      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Propagamos de manera robusta las cookies que retornó el backend usando el nuevo parser
      const backendCookies = res.headers.getSetCookie();
      backendCookies.forEach((cookieStr) => {
        const parsed = parseSetCookie(cookieStr);
        if (parsed) {
          response.cookies.set(parsed.name, parsed.value, parsed.options);
        }
      });

      // Inyectamos el access_token en el navegador del cliente
      const cookieSettings = getCookieSettings(60 * 15);
      response.cookies.set("access_token", newToken, {
        ...cookieSettings,
        httpOnly: false, // Legible por JS en el cliente (api-client)
      });

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
