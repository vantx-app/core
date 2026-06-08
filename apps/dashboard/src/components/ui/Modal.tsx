"use client";

import React, { useEffect, useRef } from "react";
import { ModalProps } from "@/types";
import { X } from "lucide-react";

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className = "max-w-md",
  closeOnBackdrop = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Controlar tecla Escape y atrapar el foco
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      // Foco cíclico (Focus Trap)
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]',
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (focusableElements.length === 0) return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    // Poner el foco en el primer campo del modal al abrir
    const firstInput = modalRef.current?.querySelector(
      'input, button:not([aria-label="Cerrar modal"])',
    ) as HTMLElement;
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 50);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo difuminado y oscuro */}
      <div
        className="absolute inset-0 bg-base-900/60 backdrop-blur-md transition-all duration-300 animate-in fade-in"
        onClick={() => closeOnBackdrop && onClose()}
      />

      {/* Caja del Modal */}
      <div
        ref={modalRef}
        className={`card bg-base-100 w-full shadow-2xl border border-base-200 z-10 p-6 animate-in fade-in zoom-in-95 duration-200 ${className}`}
      >
        {/* Cabecera del modal */}
        {(title || subtitle) && (
          <div className="flex justify-between items-start mb-4 gap-4">
            <div>
              {title && (
                <h2 className="card-title text-xl font-black text-base-content flex items-center gap-2">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-base-content/65 mt-1">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="btn btn-sm btn-ghost btn-square -mr-2 -mt-2 text-base-content/60 hover:text-base-content"
              aria-label="Cerrar modal"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {/* Botón de cerrar flotante si no hay título pero se requiere poder cerrar */}
        {!title && !subtitle && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 btn btn-sm btn-ghost btn-square text-base-content/60 hover:text-base-content z-20"
            aria-label="Cerrar modal"
          >
            <X className="size-5" />
          </button>
        )}

        {/* Contenido */}
        <div className="flex-1 w-full">{children}</div>
      </div>
    </div>
  );
}
