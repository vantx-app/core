// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleFromToken, isTokenExpired, NAV_LINKS } from "./utils/client";
import {
  getCookieSettings,
  refreshSessionInMiddleware,
  parseHostHeader,
  applyRequestHeadersToResponse,
} from "@vantx/auth";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|css|js)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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

  // Redirigir usuarios autenticados fuera de las páginas de auth
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  if (isAuthRoute && refreshToken && !isTokenExpired(refreshToken)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/login") {
    const landingUrl =
      process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
    const currentUrl = `${protocol}://${host}/`;
    const callbackUrl =
      request.nextUrl.searchParams.get("callbackUrl") || currentUrl;
    return NextResponse.redirect(
      new URL(
        `${landingUrl}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ),
    );
  }

  // Verifica si la ruta exacta está, o si es una subruta de /map
  const protectedRoute = NAV_LINKS.find(
    (route) => pathname === route.href || pathname.startsWith(`${route.href}/`),
  );

  if (!protectedRoute) return NextResponse.next();

  if (!refreshToken) {
    const landingUrl =
      process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
    const currentUrl = `${protocol}://${host}${pathname}${search}`;
    const callbackUrl = encodeURIComponent(currentUrl);
    return NextResponse.redirect(
      new URL(`${landingUrl}/login?callbackUrl=${callbackUrl}`),
    );
  }

  let validAccessToken = accessToken;
  let response = NextResponse.next();
  let cookiesToSet: any[] | undefined = undefined;

  if (!accessToken || isTokenExpired(accessToken)) {
    try {
      const result = await refreshSessionInMiddleware({
        refreshToken,
        userAgent: request.headers.get("user-agent") || "VantX-Middleware",
        internalApiUrl: process.env.INTERNAL_API_URL || "http://localhost:8000",
        host,
      });

      if (!result.success) {
        throw new Error(result.errorType || "TRANSIENT_ERROR");
      }

      const newToken = result.newToken!;
      validAccessToken = newToken;
      cookiesToSet = result.cookiesToSet;
    } catch (error: any) {
      console.error("[Auth] Error crítico en middleware:", error);

      // Si es un error de red o de servidor (5xx, timeouts), no borramos sesión ni redirigimos.
      // Inyectamos el rol derivado del token expirado via header para que los Server Components
      // no colapsen a ROLES.DRIVER cuando el refresh falla transitoriamente.
      if (
        error?.message === "TRANSIENT_ERROR" ||
        (error instanceof Error && error.message !== "AUTH_FAILED")
      ) {
        const fallbackHeaders = new Headers(request.headers);
        const roleFromExpiredToken = accessToken
          ? getRoleFromToken(accessToken)
          : null;
        if (roleFromExpiredToken) {
          fallbackHeaders.set("x-user-role", roleFromExpiredToken);
        }
        return NextResponse.next({ request: { headers: fallbackHeaders } });
      }

      const landingUrl =
        process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
      const response = NextResponse.redirect(new URL(`${landingUrl}/login`));
      // Limpieza agresiva para evitar bucles de redirección en caso de credenciales fallidas
      const deleteSettings = getCookieSettings(0);
      response.cookies.delete({ name: "access_token", ...deleteSettings });
      response.cookies.delete({ name: "refresh_token", ...deleteSettings });

      return response;
    }
  }

  // Token válido (o recién refrescado): inyectamos el rol via header para que getUserRole()
  // lo lea de forma confiable. También eliminamos cualquier x-user-role que pudiera
  // venir del cliente para evitar spoofing.
  if (validAccessToken) {
    const userRole = getRoleFromToken(validAccessToken);

    // RBAC: verificar que el rol tenga acceso a la ruta protegida
    if (protectedRoute) {
      const allowedRoles = protectedRoute.allowedRoles;
      if (!allowedRoles.includes(userRole)) {
        console.warn(
          `[RBAC] Acceso denegado: Rol ${userRole} intentó acceder a ${pathname}`,
        );
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

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
