"use client";

import { DevicesTab } from "@/components/dashboard/DevicesTab";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import { Cpu, ShieldAlert, Settings, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DevicesPageContent() {
  const { role } = useAuth();
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");

  const backLink = targetOrgId ? `/admin?targetOrgId=${targetOrgId}` : "/admin";

  if (role !== ROLES.SUPER_ADMIN) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6 pt-12">
        <div className="card bg-base-100/60 backdrop-blur-md border border-error/30 shadow-2xl p-8 rounded-3xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-error/10 text-error flex items-center justify-center rounded-2xl">
            <ShieldAlert className="size-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-base-content">
              Acceso Denegado
            </h2>
            <p className="text-base-content/60 text-sm max-w-md mx-auto">
              No tienes los permisos necesarios para ver esta sección. Solo los
              super administradores del sistema pueden gestionar los dispositivos de hardware.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <div className="text-xs text-base-content/50 flex items-center gap-1.5 mb-1">
            <Link href={backLink} className="hover:text-primary transition-colors flex items-center gap-1">
              <Settings className="size-3" />
              Administración
            </Link>
            <span>/</span>
            <span className="text-base-content/85 font-semibold">Dispositivos</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Cpu className="text-primary size-7" />
            Dispositivos GPS
          </h1>
          <p className="text-base-content/60 text-sm mt-0.5">
            Gestiona la asignación física de trackers Teltonika, asócialos con tarjetas SIM y vincula dispositivos con los vehículos.
          </p>
        </div>
        <div>
          <Link
            href={backLink}
            className="btn btn-sm btn-outline border-base-300 hover:bg-base-200/80 hover:border-base-400 font-bold transition-all"
          >
            Volver a Administración
          </Link>
        </div>
      </div>

      <div className="animate-in fade-in duration-200">
        <DevicesTab />
      </div>
    </div>
  );
}

export default function AdminDevicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando gestión de dispositivos...
          </p>
        </div>
      }
    >
      <DevicesPageContent />
    </Suspense>
  );
}
