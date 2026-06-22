import { cookies } from "next/headers";

export async function fetchServer(endpoint: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers,
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
