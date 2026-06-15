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
