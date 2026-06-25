import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getCookieSettings,
  isTokenExpired,
  refreshSessionInMiddleware,
  parseHostHeader,
  getRoleFromToken,
  applyRequestHeadersToResponse,
} from "@vantx/auth";

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

  const isLocalhost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0");

  // En producción, forzamos HTTPS para evitar rechazos de cookies seguras si el proxy no propaga x-forwarded-proto.
  let protocol = "https";
  if (isLocalhost) {
    const protoHeader =
      request.headers.get("x-forwarded-proto") || request.nextUrl.protocol;
    protocol = protoHeader.replace(/:$/, "");
  }

  // Solo nos interesa la página principal u otras vistas del Marketplace
  if (pathname !== "/" && !pathname.startsWith("/drivers/"))
    return NextResponse.next();

  // Si no hay refresh_token, es un invitado, seguimos adelante sin autenticar
  if (!refreshToken) return NextResponse.next();

  let validAccessToken = accessToken;
  let response = NextResponse.next();
  let cookiesToSet: any[] | undefined = undefined;

  // Si el access_token no existe o está expirado, intentamos refrescarlo en el servidor
  if (!accessToken || isTokenExpired(accessToken)) {
    try {
      const result = await refreshSessionInMiddleware({
        refreshToken,
        userAgent: request.headers.get("user-agent") || "VantX-Middleware",
        internalApiUrl: process.env.CRM_API_URL || "http://localhost:8000",
        host,
      });

      if (!result.success) {
        throw new Error(result.errorType || "TRANSIENT_ERROR");
      }

      const newToken = result.newToken!;
      validAccessToken = newToken;
      cookiesToSet = result.cookiesToSet;
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

  // Inyectamos las cabeceras del rol y token si el access_token es válido (o recién refrescado)
  if (validAccessToken) {
    const userRole = getRoleFromToken(validAccessToken);
    const secureHeaders = new Headers(request.headers);
    secureHeaders.set("x-user-role", userRole);
    secureHeaders.set("Authorization", `Bearer ${validAccessToken}`);

    // Si refrescamos el token, también actualizamos el Cookie header en el request
    // para que las cookies inyectadas estén disponibles en los Server Components en este renderizado.
    if (cookiesToSet) {
      let requestCookies = request.headers.get("cookie") || "";
      const newCookiesMap = new Map<string, string>();
      requestCookies.split(";").forEach((c) => {
        const parts = c.trim().split("=");
        if (parts[0]) newCookiesMap.set(parts[0], parts[1] || "");
      });
      cookiesToSet.forEach((cookie) => {
        newCookiesMap.set(cookie.name, cookie.value);
      });
      const newCookieStr = Array.from(newCookiesMap.entries())
        .map(([name, val]) => `${name}=${val}`)
        .join("; ");
      secureHeaders.set("cookie", newCookieStr);
    }

    // Creamos una respuesta limpia
    response = NextResponse.next();

    // Aplicamos los headers modificados utilizando el workaround
    applyRequestHeadersToResponse(response, secureHeaders);

    // Si refrescamos el token, propagamos las nuevas cookies en el response 200 OK
    if (cookiesToSet) {
      cookiesToSet.forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      });
      // Deshabilitamos la caché de middleware para garantizar la frescura de los tokens
      response.headers.set("x-middleware-cache", "no-cache");
      // Evitamos agresivamente que el navegador o WebView del PWA cachee la respuesta
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0",
      );
      response.headers.set("Pragma", "no-cache");
    }
  }

  return response;
}
