"use client";

import { useEffect } from "react";

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const handleRegister = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // SW registrado con éxito en la aplicación
            console.log(
              "Service Worker registrado correctamente con alcance:",
              reg.scope,
            );
          })
          .catch((err) => {
            // SW falló al registrarse
            console.error("Error al registrar el Service Worker:", err);
          });
      };

      // Registrar cuando la carga del documento esté lista
      if (document.readyState === "complete") {
        handleRegister();
      } else {
        window.addEventListener("load", handleRegister);
        return () => window.removeEventListener("load", handleRegister);
      }
    }
  }, []);

  return null;
}
