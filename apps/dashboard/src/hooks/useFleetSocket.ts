import { FleetVehicle } from "@/types";
import { useEffect, useState, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
export const useFleetSocket = (
  setFleet: React.Dispatch<React.SetStateAction<Record<string, FleetVehicle>>>,
) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [token, setToken] = useState<string | undefined>(
    Cookies.get("access_token"),
  );
  const searchParams = useSearchParams();
  const { role } = useAuth();

  const targetOrgId = searchParams.get("targetOrgId");

  const adminParams = useMemo(() => {
    if (role === ROLES.SUPER_ADMIN) {
      if (!targetOrgId) {
        return { global: true };
      }
      return { targetOrgId };
    }
    return {};
  }, [targetOrgId, role]);

  useEffect(() => {
    // 1. Polling ligero (watchdog) inicial. Solo corre si NO hay token.
    if (!token) {
      const interval = setInterval(() => {
        const t = Cookies.get("access_token");
        if (t) {
          setToken(t);
          clearInterval(interval); // Matamos el watchdog apenas tenemos token
        }
      }, 500);
      return () => clearInterval(interval);
    }

    // 2. Si llegamos aquí, GARANTIZAMOS que hay un token.
    const isDev = process.env.NODE_ENV === "development";
    const SOCKET_URL = isDev ? "http://localhost:8000" : "/";

    const socket = io(SOCKET_URL, {
      path: "/api/socket.io",
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket conectado:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket desconectado");
      setIsConnected(false);
    });

    socket.on(
      "live-location",
      (
        data: Partial<FleetVehicle> & {
          vehicleId: string;
          ignition?: boolean;
          odometer?: number;
        },
      ) => {
        setFleet((prevFleet) => {
          const currentVehicle =
            prevFleet[data.vehicleId] ?? ({} as FleetVehicle);

          return {
            ...prevFleet,
            [data.vehicleId]: {
              ...currentVehicle,
              ...data,
              // Asegurar que el estado, velocidad, ángulo, latitud y longitud estén tipados de forma segura
              status: data.status ?? currentVehicle.status ?? "STOPPED",
              speed: data.speed ?? currentVehicle.speed ?? 0,
              angle: data.angle ?? currentVehicle.angle ?? 0,
              latitude: data.latitude ?? currentVehicle.latitude ?? 0,
              longitude: data.longitude ?? currentVehicle.longitude ?? 0,
              ignition: data.ignition ?? currentVehicle.ignition ?? false,
              odometer: data.odometer ?? currentVehicle.odometer ?? 0,
              // Sincronizar el timestamp de última actualización en vivo
              updatedAt: data.updatedAt ?? new Date().toISOString(),
              isFromSocket: true,
              lastSocketUpdate: Date.now(),
            } as FleetVehicle,
          };
        });
      },
    );

    // 3. Manejo de Errores de Auth
    socket.on("connect_error", async (error) => {
      console.error("❌ Socket Error:", error.message);

      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("jwt expired")
      ) {
        try {
          // Detenemos el socket actual para que no siga iterando fallos
          socket.disconnect();

          const response = await axios.post(
            `/api/auth/refresh`,
            {},
            { withCredentials: true },
          );
          const newToken = response.data.accessToken;
          Cookies.set("access_token", newToken);

          // Magia de React: Al cambiar este estado, React destruye el useEffect
          // y lo vuelve a arrancar con el token fresco. No necesitamos "socket.connect()"
          setToken(newToken);
        } catch (e) {
          console.error("Fallo crítico de refresh", e);
          // Si falla el refresh, forzamos logout borrando la cookie is_authenticated
          // para que el middleware de Next.js expulse al usuario.
          Cookies.remove("access_token");
          Cookies.remove("refresh_token");
          window.location.href = "/login";
        }
      }
    });

    // Limpieza: Cuando el componente se desmonta o el token cambia
    return () => {
      console.log("🧹 Limpiando socket viejo...");
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, setFleet]);

  // Manejar suscripciones de salas sin desconectar el socket físico
  useEffect(() => {
    if (socketRef.current && isConnected) {
      console.log("📡 Emitiendo subscribe-to-fleet con params:", adminParams);
      socketRef.current.emit("subscribe-to-fleet", adminParams);
    }
  }, [adminParams, isConnected]);

  return { isConnected };
};
