// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleFromToken, isTokenExpired, NAV_LINKS } from "./utils/client";
import { getCookieSettings, parseSetCookie } from "@vantx/auth";

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

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("AUTH_FAILED");
        }
        throw new Error("TRANSIENT_ERROR");
      }

      const { accessToken: newToken } = await res.json();
      validAccessToken = newToken;

      // FIX 2: Clonamos los headers del request para inyectar el nuevo token.
      // Así, los Server Components de Next.js en ESTE renderizado verán el token actualizado.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        "cookie",
        `access_token=${newToken}; refresh_token=${refreshToken}`,
      );
      // Eliminamos cualquier x-user-role que pudiera venir del cliente para
      // evitar spoofing, y lo sobreescribimos con el rol del token validado.
      requestHeaders.set("x-user-role", getRoleFromToken(newToken));
      requestHeaders.set("Authorization", `Bearer ${newToken}`);

      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Propagamos de manera robusta las cookies del backend usando el nuevo parser
      const backendCookies = res.headers.getSetCookie();
      backendCookies.forEach((cookieStr) => {
        const parsed = parseSetCookie(cookieStr);
        if (parsed) {
          response.cookies.set(parsed.name, parsed.value, parsed.options);
        }
      });

      // Inyectamos el Access Token con la configuración del monorepo
      const cookieSettings = getCookieSettings(60 * 15);
      response.cookies.set("access_token", newToken, {
        ...cookieSettings,
        httpOnly: false, // Debe ser legible por JS en el cliente (api-client)
      });

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
