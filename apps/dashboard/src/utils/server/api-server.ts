import { cookies } from 'next/headers';

export async function fetchServer(endpoint: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const url = `${process.env.INTERNAL_API_URL}/api${endpoint}`;

  console.log(`🚀 Intentando fetch a: ${url}`);

  // Preparamos cabeceras limpias
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Solo adjuntamos Authorization si tenemos un token real
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store', // Evitamos que Next.js cachee telemetría o datos dinámicos
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
    // Es mejor lanzar el error o devolver null estructurado para que la UI maneje el estado de fallo
    throw error;
  }
}