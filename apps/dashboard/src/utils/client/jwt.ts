import { ROLES } from "../enums";

export function decodeJWT(token: string) {
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
  if (!decoded || !decoded.exp) return true; // Falla seguro

  const exp = decoded.exp * 1000;
  return Date.now() >= exp - 30000; // 30 segundos de margen
}

export function getRoleFromToken(token: string): ROLES {
  const decoded = decodeJWT(token);
  return decoded?.role ?? ROLES.DRIVER;
}
