"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";

export function useMarketplaceSocket(
  onApplicationReceived: (data: {
    listingId: string;
    title: string;
    driverName: string;
  }) => void,
  onStatusChanged: (data: {
    listingId: string;
    title: string;
    status: string;
  }) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const onApplicationReceivedRef = useRef(onApplicationReceived);
  const onStatusChangedRef = useRef(onStatusChanged);

  // Sync callbacks to refs on every render
  useEffect(() => {
    onApplicationReceivedRef.current = onApplicationReceived;
    onStatusChangedRef.current = onStatusChanged;
  });

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) return;

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
      console.log("✅ Marketplace socket connected:", socket.id);
    });

    socket.on("marketplace:application-received", (data) => {
      console.log("📬 Socket event: marketplace:application-received", data);
      onApplicationReceivedRef.current(data);
    });

    socket.on("marketplace:application-status-changed", (data) => {
      console.log(
        "🔔 Socket event: marketplace:application-status-changed",
        data,
      );
      onStatusChangedRef.current(data);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log(
          "ℹ️ Cambio de visibilidad del documento (marketplace): visible. Comprobando conexión del socket...",
        );
        if (socket && !socket.connected) {
          console.log(
            "⚠️ El socket de marketplace está desconectado. Intentando reconectar...",
          );
          socket.connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      console.log("🧹 Disconnecting marketplace socket...");
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
}
