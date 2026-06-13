"use client";

import { useState } from "react";
import { Truck, ChevronRight, X } from "lucide-react";
import dynamic from "next/dynamic";

const OwnerContactForm = dynamic(
  () => import("./OwnerContactForm").then((m) => m.OwnerContactForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center">
        <span className="loading loading-spinner loading-lg text-blue-600"></span>
      </div>
    ),
  }
);

export function OwnerContactCard() {
  const [isOwnerContactOpen, setIsOwnerContactOpen] = useState(false);

  return (
    <>
      {/* Card 1: B2B Fleet Owner */}
      <div
        className="glass-card p-8 flex flex-col items-center justify-between text-center group cursor-pointer bg-white/70 border-slate-200"
        onClick={() => setIsOwnerContactOpen(true)}
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
          <Truck className="size-6" />
        </div>
        <div className="my-4">
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Soy Propietario de Flota
          </h3>
          <p className="text-slate-650 text-xs leading-relaxed">
            Monitorea rutas en vivo, comparte enlaces de seguimiento en
            tiempo real con tus clientes, analiza consumo de combustible y
            reduce costos operativos.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
          Solicitar Demostración <ChevronRight className="size-4" />
        </span>
      </div>

      {/* OWNER CONTACT FORM MODAL */}
      {isOwnerContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsOwnerContactOpen(false)}
          />
          {/* Modal Content */}
          <div className="glass-card w-full max-w-xl p-8 bg-white/95 border-slate-200 relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsOwnerContactOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition-colors"
            >
              <X className="size-5" />
            </button>
            <OwnerContactForm />
          </div>
        </div>
      )}
    </>
  );
}
