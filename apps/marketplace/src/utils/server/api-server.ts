import { cookies, headers } from "next/headers";

export async function fetchServer(endpoint: string, options: RequestInit = {}) {
  // Intentamos obtener el token desde la cabecera Authorization enviada por el middleware
  const headerStore = await headers();
  const authHeader = headerStore.get("Authorization");
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  // Si no está en Authorization, intentamos extraerlo de la cookie inyectada en request headers
  if (!token) {
    const cookieHeader = headerStore.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]*)/);
      if (match) {
        token = match[1];
      }
    }
  }

  // Fallback a las cookies normales
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("access_token")?.value;
  }

  // Si no hay token y se consulta /users/me, es un invitado
  if (endpoint === "/users/me" && !token) {
    return null;
  }

  const isMarketplaceEndpoint = endpoint.startsWith("/marketplace");
  const baseApiUrl = isMarketplaceEndpoint
    ? process.env.MARKETPLACE_API_URL || "http://localhost:8001"
    : process.env.CRM_API_URL || "http://localhost:8000";

  const url = `${baseApiUrl}/api${endpoint}`;

  console.log(`🚀 Intentando fetch a: ${url}`);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: requestHeaders,
    });

    if (response.status === 401) {
      console.warn(`⚠️ 401 en Server Component para: ${endpoint}`);
    }

    if (!response.ok) {
      const errorMsg = `Fetch failed with status ${response.status} for ${endpoint}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return response.json();
  } catch (error) {
    console.error(`❌ Falló fetch a ${url}:`, error);
    throw error;
  }
}
