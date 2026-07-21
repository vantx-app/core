"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

const SegmentsMapComponent = dynamic(
  () => import("@/components/admin/SegmentsMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-full w-full items-center justify-center bg-slate-950 text-slate-400 gap-4">
        <Loader2 className="size-10 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Iniciando el mapa de segmentos...</p>
      </div>
    ),
  }
);

export default function AdminSegmentsPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <Suspense
        fallback={
          <div className="flex flex-col h-full w-full items-center justify-center bg-slate-950 text-slate-400 gap-4">
            <Loader2 className="size-10 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Iniciando el mapa de segmentos...</p>
          </div>
        }
      >
        <SegmentsMapComponent />
      </Suspense>
    </div>
  );
}
