import { cookies, headers } from "next/headers";
import { ROLES } from "../enums";

export async function getUserRole(): Promise<ROLES> {
  try {
    // Primary: read the role forwarded by middleware via a custom request header.
    // This is reliably propagated via NextResponse.next({ request: { headers } })
    // even when the access_token cookie is expired and a transient refresh failure occurred.
    const headerStore = await headers();
    const roleFromHeader = headerStore.get("x-user-role");
    if (
      roleFromHeader &&
      Object.values(ROLES).includes(roleFromHeader as ROLES)
    ) {
      return roleFromHeader as ROLES;
    }

    // Fallback: decode the cookie JWT directly (normal happy path when no header is set).
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (!token) return ROLES.DRIVER;

    const payloadBase64 = token.split(".")[1];
    const payloadBuffer = Buffer.from(payloadBase64, "base64");
    const payload = JSON.parse(payloadBuffer.toString("utf-8"));

    return payload.role ?? ROLES.DRIVER;
  } catch (error) {
    console.error("Error decodificando JWT en servidor:", error);
    return ROLES.DRIVER;
  }
}
