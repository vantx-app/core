import axios from "axios";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";

export interface FailedRequest {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

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

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
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
        const { data } = await axios.post(
          "/api/auth/refresh",
          {},
          {
            withCredentials: true,
          },
        );

        const newAccessToken = data.accessToken;
        const authSettings = getCookieSettings(15 * 60 * 1000);
        Cookies.set("access_token", newAccessToken, {
          path: authSettings.path,
          domain: authSettings.domain,
          sameSite: authSettings.sameSite as any,
          secure: authSettings.secure,
          expires: new Date(Date.now() + 15 * 60 * 1000),
        });

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
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

        // Si es una consulta pública del Marketplace (como verificar perfil o listar conductores),
        // no forzamos redirección para permitir navegación en modo invitado.
        const isPublicCheck =
          originalRequest.url?.includes("/users/me") ||
          originalRequest.url?.includes("/drivers");

        if (!isPublicCheck) {
          const landingUrl =
            process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
          if (typeof window !== "undefined") {
            window.location.href = `${landingUrl}/login?expired=true`;
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
