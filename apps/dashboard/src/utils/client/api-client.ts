import { FailedRequest } from "@/types";
import axios from "axios";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Detectamos 401 y aseguramos que no sea un reintento previo
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Si ya hay un refresh en curso, ponemos esta petición en cola
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // FIX CRÍTICO: Usamos 'axios' puro, NO la instancia 'api' para evitar loops.
        // Hacemos proxy a NestJS a través de Nginx usando '/api/auth/refresh'
        const { data } = await axios.post(
          "/api/auth/refresh",
          {},
          {
            withCredentials: true, // Vital para enviar la cookie del refresh_token
          },
        );

        const newAccessToken = data.accessToken;

        // Sobrescribimos el access_token.
        // Las configuraciones deben igualar exactamente lo que pusimos en el middleware.
        const authSettings = getCookieSettings(15 * 60 * 1000);
        Cookies.set("access_token", newAccessToken, {
          path: authSettings.path,
          domain: authSettings.domain,
          sameSite: authSettings.sameSite as any,
          secure: authSettings.secure,
          expires: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        });

        // Resolvemos la cola con el nuevo token
        processQueue(null, newAccessToken);

        // Reintentamos la petición que falló originalmente
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Si el refresh falla (ej. Refresh Token expirado), rechazamos toda la cola
        processQueue(refreshError, null);

        // Limpiamos rastros
        const deleteSettings = getCookieSettings(0);
        Cookies.remove("access_token", { path: "/" });
        if (deleteSettings.domain) {
          Cookies.remove("access_token", {
            path: "/",
            domain: deleteSettings.domain,
          });
        }
        Cookies.remove("refresh_token", { path: "/" });
        if (deleteSettings.domain) {
          Cookies.remove("refresh_token", {
            path: "/",
            domain: deleteSettings.domain,
          });
        }

        // Redirección forzada (MVP Friendly)
        if (typeof window !== "undefined") {
          const landingUrl =
            process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
          window.location.href = `${landingUrl}/login?expired=true`;
        }

        return Promise.reject(refreshError);
      } finally {
        // Liberamos el candado SIEMPRE
        isRefreshing = false;
      }
    }

    // Si es cualquier otro error (400, 403, 500), lo dejamos pasar
    return Promise.reject(error);
  },
);

export default api;
