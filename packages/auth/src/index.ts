export interface CookieSettings {
  httpOnly: boolean;
  path: string;
  secure: boolean;
  sameSite: boolean | "strict" | "lax" | "none" | undefined;
  maxAge: number;
  domain?: string;
}

export function getCookieSettings(maxAge: number): CookieSettings {
  const isProd = process.env.NODE_ENV === "production";

  // En producción, usar Secure=true y Domain=.vantx.app a menos que se configure lo contrario
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : isProd;

  const domain =
    process.env.COOKIE_DOMAIN !== undefined
      ? process.env.COOKIE_DOMAIN || undefined
      : isProd
        ? ".vantx.app"
        : undefined;

  return {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export interface ParsedCookie {
  name: string;
  value: string;
  options: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    sameSite?: "lax" | "strict" | "none" | boolean;
    secure?: boolean;
    httpOnly?: boolean;
  };
}

export function parseSetCookie(cookieStr: string): ParsedCookie | null {
  const parts = cookieStr.split(";").map((p) => p.trim());
  const [nameValuePair, ...directives] = parts;
  if (!nameValuePair) return null;

  const eqIdx = nameValuePair.indexOf("=");
  if (eqIdx === -1) return null;
  const name = nameValuePair.substring(0, eqIdx);
  const value = nameValuePair.substring(eqIdx + 1);

  const options: ParsedCookie["options"] = {};
  directives.forEach((directive) => {
    const eqSignIdx = directive.indexOf("=");
    let dName = directive;
    let dValue = "";
    if (eqSignIdx !== -1) {
      dName = directive.substring(0, eqSignIdx).trim();
      dValue = directive.substring(eqSignIdx + 1).trim();
    } else {
      dName = directive.trim();
    }

    const lowerDName = dName.toLowerCase();
    if (lowerDName === "path") {
      options.path = dValue;
    } else if (lowerDName === "domain") {
      options.domain = dValue;
    } else if (lowerDName === "max-age") {
      options.maxAge = parseInt(dValue, 10);
    } else if (lowerDName === "expires") {
      options.expires = new Date(dValue);
    } else if (lowerDName === "httponly") {
      options.httpOnly = true;
    } else if (lowerDName === "secure") {
      options.secure = true;
    } else if (lowerDName === "samesite") {
      const lowerVal = dValue.toLowerCase();
      if (lowerVal === "lax" || lowerVal === "strict" || lowerVal === "none") {
        options.sameSite = lowerVal;
      } else if (lowerVal === "true") {
        options.sameSite = true;
      } else if (lowerVal === "false") {
        options.sameSite = false;
      }
    }
  });

  return { name, value, options };
}

export function decodeJWT(token: string): any {
  try {
    const payloadBase64 = token.split(".")[1];
    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decodificando JWT:", error);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  const exp = decoded.exp * 1000;
  return Date.now() >= exp - 30000; // 30 seconds buffer
}

export function getRoleFromToken(token: string): string {
  const decoded = decodeJWT(token);
  return decoded?.role ?? "DRIVER";
}


export interface ParsedHost {
  hostname: string;
  port: string;
}

export function parseHostHeader(host: string): ParsedHost {
  let hostname = host;
  let port = "";
  if (host.includes(":")) {
    const parts = host.split(":");
    hostname = parts[0];
    port = parts[1];
  }
  return { hostname, port };
}

export interface SessionRefreshOptions {
  refreshToken: string;
  userAgent: string;
  internalApiUrl: string;
  host?: string;
}

export interface SessionRefreshResult {
  success: boolean;
  errorType?: "AUTH_FAILED" | "TRANSIENT_ERROR";
  newToken?: string;
  cookiesToSet?: ParsedCookie[];
}

export async function refreshSessionInMiddleware(
  options: SessionRefreshOptions
): Promise<SessionRefreshResult> {
  const { refreshToken, userAgent, internalApiUrl, host } = options;
  try {
    const res = await fetch(`${internalApiUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}`,
        "User-Agent": userAgent,
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { success: false, errorType: "AUTH_FAILED" };
      }
      return { success: false, errorType: "TRANSIENT_ERROR" };
    }

    const data = await res.json();
    const newToken = data?.accessToken;
    if (!newToken) {
      return { success: false, errorType: "AUTH_FAILED" };
    }

    const cookiesToSet: ParsedCookie[] = [];

    // Propagar cookies del backend
    let backendCookies: string[] = [];
    if (typeof res.headers.getSetCookie === "function") {
      backendCookies = res.headers.getSetCookie();
    } else {
      const setCookieHeader = res.headers.get("set-cookie");
      if (setCookieHeader) {
        backendCookies = [setCookieHeader];
      }
    }

    const isLocalhost =
      host &&
      (host.startsWith("localhost") ||
        host.startsWith("127.0.0.1") ||
        host.startsWith("0.0.0.0"));

    backendCookies.forEach((cookieStr) => {
      const parsed = parseSetCookie(cookieStr);
      if (parsed) {
        if (isLocalhost) {
          delete parsed.options.domain;
          parsed.options.secure = false;
        }
        cookiesToSet.push(parsed);
      }
    });

    // Inyectar el Access Token con la configuración del monorepo
    const cookieSettings = getCookieSettings(60 * 15);
    if (isLocalhost) {
      delete cookieSettings.domain;
      cookieSettings.secure = false;
    }
    cookiesToSet.push({
      name: "access_token",
      value: newToken,
      options: {
        ...cookieSettings,
        httpOnly: false, // Debe ser legible por JS en el cliente (api-client)
      },
    });

    return {
      success: true,
      newToken,
      cookiesToSet,
    };
  } catch (error) {
    console.error("[Auth] Error en refreshSessionInMiddleware:", error);
    return { success: false, errorType: "TRANSIENT_ERROR" };
  }
}
