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
