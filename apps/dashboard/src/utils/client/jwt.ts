import { decodeJWT, isTokenExpired, getRoleFromToken as getRoleFromTokenRaw } from "@vantx/auth";
import { ROLES } from "../enums";

export { decodeJWT, isTokenExpired };

export function getRoleFromToken(token: string): ROLES {
  return getRoleFromTokenRaw(token) as ROLES;
}

