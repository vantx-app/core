// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleFromToken, isTokenExpired, NAV_LINKS } from "./utils/client";
import { getCookieSettings } from "@vantx/auth";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|css|js)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Redirigir usuarios autenticados fuera de las páginas de auth
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  if (isAuthRoute && refreshToken && !isTokenExpired(refreshToken)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/login") {
    const landingUrl =
      process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
    const currentUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/`;
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
    const currentUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}${pathname}${search}`;
    const callbackUrl = encodeURIComponent(currentUrl);
    return NextResponse.redirect(
      new URL(`${landingUrl}/login?callbackUrl=${callbackUrl}`),
    );
  }

  let validAccessToken = accessToken;
  let response = NextResponse.next();

  if (!accessToken || isTokenExpired(accessToken)) {
    try {
      // OJO AQUÍ: Asegúrate que INTERNAL_API_URL apunte al nombre del servicio Docker (ej: http://backend:8000)
      // Si usas 127.0.0.1 aquí dentro de Docker, Next.js se llamará a sí mismo y el fetch fallará.
      const res = await fetch(
        `${process.env.INTERNAL_API_URL}/api/auth/refresh`,
        {
          method: "POST",
          headers: {
            Cookie: `refresh_token=${refreshToken}`,
            "User-Agent":
              request.headers.get("user-agent") || "VantX-Middleware",
          },
        },
      );

      if (!res.ok) throw new Error("Refresh backend falló");
      const { accessToken: newToken } = await res.json();
      validAccessToken = newToken;

      // FIX 2: Clonamos los headers del request para inyectar el nuevo token.
      // Así, los Server Components de Next.js en ESTE renderizado verán el token actualizado.
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

      // FIX 1: Usar getSetCookie() devuelve un Array de strings puros.
      // Esto evita que las comas de las fechas corrompan los headers.
      const backendCookies = res.headers.getSetCookie();

      backendCookies.forEach((cookie) => {
        response.headers.append("Set-Cookie", cookie);
      });

      // Inyectamos el Access Token con la configuración del monorepo
      const cookieSettings = getCookieSettings(60 * 15);
      response.cookies.set("access_token", newToken, {
        ...cookieSettings,
        httpOnly: false, // Debe ser legible por JS en el cliente (api-client)
      });

      return response;
    } catch (error) {
      console.error("[Auth] Error crítico en middleware:", error);

      const landingUrl =
        process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
      const response = NextResponse.redirect(new URL(`${landingUrl}/login`));
      // Limpieza agresiva para evitar bucles de redirección
      const deleteSettings = getCookieSettings(0);
      response.cookies.delete({ name: "access_token", ...deleteSettings });
      response.cookies.delete({ name: "refresh_token", ...deleteSettings });

      return response;
    }
  }

  if (validAccessToken && protectedRoute) {
    const userRole = getRoleFromToken(validAccessToken);
    const allowedRoles = protectedRoute.allowedRoles;

    if (!allowedRoles.includes(userRole)) {
      console.warn(
        `[RBAC] Acceso denegado: Rol ${userRole} intentó acceder a ${pathname}`,
      );
      // Redirigir a una ruta de fallback según tu UX
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
