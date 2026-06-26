import { cookies, headers } from "next/headers";

export async function fetchServer(endpoint: string, options: RequestInit = {}) {
  // Intentamos obtener el token desde la cabecera Authorization enviada por el middleware
  const headerStore = await headers();
  const authHeader = headerStore.get("Authorization");
  const roleHeader = headerStore.get("x-user-role");
  console.log(`DEBUG [fetchServer]: endpoint = ${endpoint}`);
  console.log(`DEBUG [fetchServer]: header Authorization =`, authHeader ? "present" : "missing");
  console.log(`DEBUG [fetchServer]: header x-user-role =`, roleHeader);

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
    console.log(`DEBUG [fetchServer]: fallback to cookies, access_token =`, token ? "present" : "missing");
  }

  console.log(`DEBUG [fetchServer]: final resolved token =`, token ? "present" : "missing");

  // Si no hay token y se consulta /users/me, es un invitado
  if (endpoint === "/users/me" && !token) {
    return null;
  }

  const url = `${process.env.INTERNAL_API_URL}/api${endpoint}`;

  console.log(`🚀 Intentando fetch a: ${url}`);

  // Preparamos cabeceras limpias
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Solo adjuntamos Authorization si tenemos un token real
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store", // Evitamos que Next.js cachee telemetría o datos dinámicos
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
    // Es mejor lanzar el error o devolver null estructurado para que la UI maneje el estado de fallo
    throw error;
  }
}
