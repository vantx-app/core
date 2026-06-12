import { ImeiScannerModalProps } from "@/types";
/* eslint-disable @typescript-eslint/no-explicit-any */
("use client");

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode, CameraDevice } from "html5-qrcode";
import { RotateCw, X, Zap, ZapOff, Loader2, AlertCircle } from "lucide-react";
import { cleanImei } from "@/utils/client";

export default function ImeiScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: ImeiScannerModalProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isUnmountedRef = useRef(false);



  const startScanning = async (
    cameraId: string,
    scannerInstance: Html5Qrcode,
  ) => {
    if (!scannerInstance) return;
    setIsInitializing(true);
    setErrorMsg(null);

    try {
      if (scannerInstance.isScanning) {
        await scannerInstance.stop();
      }

      await scannerInstance.start(
        cameraId,
        {
          fps: 20,
        },
        (decodedText) => {
          const cleanVal = cleanImei(decodedText);
          if (cleanVal) {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(100);
            }
            onScanSuccess(cleanVal);
            onClose();
          }
        },
        () => {
          // Errores continuos de escaneo por fotograma no descodificado se ignoran
        },
      );

      if (isUnmountedRef.current) {
        await scannerInstance.stop();
        return;
      }

      // Check for torch capabilities safely through the native API
      const capabilities = scannerInstance.getRunningTrackCapabilities();
      if (capabilities && (capabilities as any).torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
      setIsTorchOn(false);
    } catch (err) {
      console.error("Error al iniciar el escaneo de cámara:", err);
      setErrorMsg(
        "Error al conectar con la cámara elegida o dispositivo bloqueado.",
      );
    } finally {
      if (!isUnmountedRef.current) {
        setIsInitializing(false);
      }
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !scannerRef.current.isScanning) return;

    try {
      const nextState = !isTorchOn;

      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });

      setIsTorchOn(nextState);
    } catch (err) {
      console.error("Error al encender/apagar la linterna:", err);
    }
  };

  const switchCamera = async () => {
    if (devices.length <= 1 || !activeCameraId || !scannerRef.current) return;
    const currentIndex = devices.findIndex((d) => d.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextCameraId = devices[nextIndex].id;
    setActiveCameraId(nextCameraId);
    await startScanning(nextCameraId, scannerRef.current);
  };

  useEffect(() => {
    if (!isOpen) return;

    setIsInitializing(true);
    setErrorMsg(null);
    setHasPermission(null);
    setHasTorch(false);
    setIsTorchOn(false);
    isUnmountedRef.current = false;

    const html5QrCode = new Html5Qrcode("imei-scanner-reader", {
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    });
    scannerRef.current = html5QrCode;

    const initCamera = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (isUnmountedRef.current) return;
        setDevices(cameras);
        setHasPermission(true);

        if (cameras.length > 0) {
          // Select the ultra-wide/main back camera accurately on phones
          const defaultCamera = cameras[cameras.length - 1];
          setActiveCameraId(defaultCamera.id);
          await startScanning(defaultCamera.id, html5QrCode);
        } else {
          setErrorMsg(
            "No se encontraron cámaras de video en este dispositivo.",
          );
        }
      } catch (err) {
        console.error("Error solicitando permisos de cámara o cargando:", err);
        if (!isUnmountedRef.current) {
          setHasPermission(false);
          setErrorMsg(
            "Permiso de acceso a la cámara denegado o dispositivo bloqueado.",
          );
        }
      } finally {
        if (!isUnmountedRef.current) {
          setIsInitializing(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      initCamera();
    }, 250);

    return () => {
      isUnmountedRef.current = true;
      clearTimeout(timeoutId);

      // Gracefully clear scanner instance
      if (html5QrCode.isScanning) {
        html5QrCode
          .stop()
          .then(() => {
            try {
              html5QrCode.clear();
            } catch (e) {}
          })
          .catch((err) => console.error("Error deteniendo cámara:", err));
      } else {
        try {
          html5QrCode.clear();
        } catch (e) {}
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      <style>{`
        @keyframes laser-sweep {
          0% { top: 5%; }
          50% { top: 95%; }
          100% { top: 5%; }
        }
        .animate-laser-line {
          animation: laser-sweep 2.5s infinite ease-in-out;
        }
        #imei-scanner-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

      {/* Header */}
      <div className="pt-[calc(1rem+env(safe-area-inset-top))] pb-4 px-4 flex items-center justify-between border-b border-white/10 shrink-0 bg-slate-900/60 backdrop-blur-md text-white">
        <div>
          <h3 className="font-extrabold text-base tracking-tight text-white">
            Escáner de IMEI
          </h3>
          <p className="text-[10px] text-white/60 font-medium">
            Compatible con Teltonika FMC003/FMC150
          </p>
        </div>
        <button
          onClick={onClose}
          className="btn btn-ghost btn-circle btn-sm text-white/80 hover:text-white hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Contenedor del video y visor */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <div
          id="imei-scanner-reader"
          className="absolute inset-0 w-full h-full"
        />

        {hasPermission && !isInitializing && !errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className="relative flex flex-col items-center gap-6">
              <div className="w-[250px] h-[250px] max-w-[70vw] max-h-[70vw] relative border-2 border-emerald-500/70 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.65),inset_0_0_15px_rgba(255,255,255,0.1)]">
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />

                <div className="absolute left-2.5 right-2.5 h-[3px] bg-red-500/80 shadow-[0_0_10px_#ef4444] rounded-full animate-laser-line" />
              </div>

              <span className="text-[12px] text-white/90 font-medium tracking-wide bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-lg text-center">
                Coloque el código QR del dispositivo dentro del recuadro
              </span>
            </div>
          </div>
        )}

        {isInitializing && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-3 z-20 text-white">
            <Loader2 className="size-8 animate-spin text-emerald-500" />
            <p className="text-xs font-semibold text-white/75">
              Iniciando cámara...
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center gap-4 z-20 text-white">
            <div className="p-3 bg-red-500/10 rounded-full text-red-500">
              <AlertCircle className="size-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{errorMsg}</p>
              <p className="text-xs text-white/50 mt-1.5 max-w-xs mx-auto">
                Asegúrate de conceder permisos de cámara en tu navegador y de
                cargar el sitio en un entorno seguro (HTTPS).
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-outline btn-sm text-white/80 border-white/20 hover:bg-white/10"
            >
              Entendido
            </button>
          </div>
        )}
      </div>

      {/* Footer / Barra de controles */}
      <div className="pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-6 border-t border-white/10 shrink-0 bg-slate-900/80 backdrop-blur-md text-white flex items-center justify-center gap-8 z-30">
        {hasTorch && (
          <button
            onClick={toggleTorch}
            className={`btn btn-circle btn-md transition-all duration-200 border-none ${
              isTorchOn
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/35 hover:brightness-110"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title="Linterna"
          >
            {isTorchOn ? (
              <ZapOff className="size-5" />
            ) : (
              <Zap className="size-5" />
            )}
          </button>
        )}

        {devices.length > 1 && (
          <button
            onClick={switchCamera}
            className="btn btn-circle btn-md bg-white/10 text-white hover:bg-white/20 border-none transition-all duration-200"
            title="Cambiar Cámara"
          >
            <RotateCw className="size-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
