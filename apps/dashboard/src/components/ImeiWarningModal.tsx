"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Wifi, WifiOff, ArrowRight, X } from "lucide-react";

export type ImeiWarningMode = "create_no_imei" | "update_imei";

interface ImeiWarningModalProps {
  isOpen: boolean;
  mode: ImeiWarningMode | null;
  currentImei?: string | null;
  newImei?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ImeiWarningModal({
  isOpen,
  mode,
  currentImei,
  newImei,
  onConfirm,
  onCancel,
}: ImeiWarningModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen || !mode) return null;

  const isUpdate = mode === "update_imei";

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-base-100 rounded-2xl border border-base-200 shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${isUpdate ? "bg-amber-500/10" : "bg-orange-500/10"}`}
            >
              {isUpdate ? (
                <Wifi className="size-5 text-amber-500" />
              ) : (
                <WifiOff className="size-5 text-orange-500" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-base-content">
                {isUpdate
                  ? "¿Cambiar dispositivo GPS?"
                  : "¿Registrar sin dispositivo GPS?"}
              </h2>
              <p className="text-[11px] text-base-content/50 mt-0.5">
                {isUpdate
                  ? "Acción irreversible en telemetría"
                  : "El vehículo quedará sin rastreo"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="btn btn-ghost btn-sm btn-square rounded-lg text-base-content/40 hover:text-base-content mt-0.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          {isUpdate && (
            /* IMEI change visualization — only for update mode */
            <div className="flex items-center gap-3 p-3 bg-base-200/40 rounded-xl border border-base-200/60">
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] text-base-content/40 uppercase font-bold mb-1 tracking-wider">
                  Actual
                </p>
                <p className="text-xs font-mono text-base-content/60 truncate">
                  {currentImei || "Sin IMEI"}
                </p>
              </div>
              <ArrowRight className="size-4 text-base-content/25 shrink-0" />
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] text-base-content/40 uppercase font-bold mb-1 tracking-wider">
                  Nuevo
                </p>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold truncate">
                  {newImei || "Sin IMEI"}
                </p>
              </div>
            </div>
          )}

          {/* Warning message */}
          <div
            className={`rounded-xl p-4 border ${
              isUpdate
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-orange-500/10 border-orange-500/20"
            }`}
          >
            <p
              className={`text-xs font-bold mb-1.5 ${
                isUpdate
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-orange-700 dark:text-orange-400"
              }`}
            >
              {isUpdate
                ? "⚠️ Riesgo de pérdida de telemetría"
                : "Sin rastreo GPS activo"}
            </p>
            <p className="text-xs text-base-content/70 leading-relaxed">
              {isUpdate ? (
                <>
                  Si el IMEI ingresado es incorrecto, el vehículo{" "}
                  <strong>perderá la telemetría en tiempo real</strong>. Los
                  viajes no se registrarán y el puntaje operativo de la unidad
                  se verá afectado hasta que el dispositivo correcto transmita
                  datos.
                </>
              ) : (
                <>
                  El vehículo se registrará{" "}
                  <strong>sin dispositivo de telemetría</strong>. El rastreo
                  GPS, los viajes y el cálculo de puntajes no estarán
                  disponibles hasta que se vincule un dispositivo desde la
                  configuración del vehículo.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="btn btn-outline btn-sm flex-1 rounded-xl border-base-300 hover:bg-base-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`btn btn-sm flex-1 rounded-xl text-white border-none font-bold ${
              isUpdate
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {isConfirming ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Guardando...
              </>
            ) : isUpdate ? (
              "Confirmar cambio"
            ) : (
              "Registrar sin dispositivo"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
