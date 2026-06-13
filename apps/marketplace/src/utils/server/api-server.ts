import { cookies } from "next/headers";

export async function fetchServer(endpoint: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const url = `${process.env.INTERNAL_API_URL}/api${endpoint}`;

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
