// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleFromToken, isTokenExpired, NAV_LINKS } from "./utils/client";
import { getCookieSettings, refreshSessionInMiddleware } from "@vantx/auth";

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

  let protocol =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol;
  protocol = protocol.replace(/:$/, "");

  // Redirigir usuarios autenticados fuera de las páginas de auth
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  if (isAuthRoute && refreshToken && !isTokenExpired(refreshToken)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/login") {
    const landingUrl =
      process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
    const currentUrl = `${request.nextUrl.protocol}//${host}/`;
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
    const currentUrl = `${request.nextUrl.protocol}//${host}${pathname}${search}`;
    const callbackUrl = encodeURIComponent(currentUrl);
    return NextResponse.redirect(
      new URL(`${landingUrl}/login?callbackUrl=${callbackUrl}`),
    );
  }

  let validAccessToken = accessToken;
  let response = NextResponse.next();

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
      validAccessToken = newToken;

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

  // Token válido y no expirado: inyectamos el rol via header para que getUserRole()
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
    return NextResponse.next({ request: { headers: secureHeaders } });
  }

  return response;
}
