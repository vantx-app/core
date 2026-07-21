"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import {
  Car,
  Users,
  Shield,
  Settings,
  ShieldAlert,
  Building2,
  Loader2,
  Briefcase,
  Cpu,
  Map,
} from "lucide-react";
import { AdminCard } from "@/components/dashboard/AdminCard";

// ─── Admin Overview (cards grid) ─────────────────────────────────────────

function AdminOverview() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const { role } = useAuth();

  const getLink = (path: string) =>
    targetOrgId ? `${path}?targetOrgId=${targetOrgId}` : path;

  const isOwnerOrSuper = role === ROLES.OWNER || role === ROLES.SUPER_ADMIN;
  const hasOrgContext = role !== ROLES.SUPER_ADMIN || !!targetOrgId;
  const canEditOrgs = role === ROLES.SUPER_ADMIN && !targetOrgId;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Card 0: Organizaciones (Solo Super Admin) */}
      {role === ROLES.SUPER_ADMIN && (
        <AdminCard
          href={getLink("/organizations")}
          icon={Building2}
          iconColorClass="bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white"
          title="Organizaciones"
          description="Administra las flotas asociadas a la plataforma, registra nuevas organizaciones, edita sus datos y gestiona sus respectivos usuarios."
          disabled={!canEditOrgs}
          disabledBadge="Vista Impersonada"
          disabledDescription={
            <>
              Administra las flotas asociadas a la plataforma.{" "}
              <strong className="text-primary/60">
                Sal de la vista de Owner para poder editar organizaciones.
              </strong>
            </>
          }
          disabledTitleAttr="No disponible en modo de vista (impersonación)"
        />
      )}

      {/* Card 1: Vehículos */}
      <AdminCard
        href={getLink("/vehicle")}
        icon={Car}
        iconColorClass="bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
        title="Vehículos de la Flota"
        description="Visualiza el listado de vehículos, sus estados en tiempo real (en mantenimiento, activo), registra unidades nuevas y administra las asignaciones de conductores."
        disabled={!hasOrgContext}
        disabledBadge="Requiere Organización"
        disabledDescription={
          <>
            Visualiza el listado de vehículos y sus estados en tiempo real.{" "}
            <strong className="text-primary/60">
              Selecciona una organización primero.
            </strong>
          </>
        }
        disabledTitleAttr="Requiere seleccionar una organización para impersonar"
      />

      {/* Card 2: Conductores */}
      <AdminCard
        href={getLink("/drivers")}
        icon={Users}
        iconColorClass="bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
        title="Conductores"
        description="Directorio completo de choferes. Consulta sus identificaciones, estados de verificación de cuenta y sus puntajes de seguridad, eficiencia de operación y cuidado del motor."
        disabled={!hasOrgContext}
        disabledBadge="Requiere Organización"
        disabledDescription={
          <>
            Directorio completo de choferes y consulta de sus estados y
            puntajes.{" "}
            <strong className="text-primary/60">
              Selecciona una organización primero.
            </strong>
          </>
        }
        disabledTitleAttr="Requiere seleccionar una organización para impersonar"
      />

      {/* Card 3: Usuarios / Equipo */}
      <AdminCard
        href={getLink("/users")}
        icon={Shield}
        iconColorClass="bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
        title="Usuarios del Equipo"
        description="Administra las cuentas de administradores autorizados que gestionan la logística, registran vehículos y supervisan viajes dentro de tu organización."
        disabled={!hasOrgContext || !isOwnerOrSuper}
        disabledBadge={!hasOrgContext ? "Requiere Organización" : "Bloqueado"}
        disabledDescription={
          !hasOrgContext ? (
            <>
              Administra las cuentas de administradores autorizados que
              gestionan la logística.{" "}
              <strong className="text-primary/60">
                Selecciona una organización primero.
              </strong>
            </>
          ) : (
            <>
              Administra las cuentas de administradores autorizados que
              gestionan la logística.{" "}
              <strong className="text-primary/60">
                Requiere rol de Propietario (Owner).
              </strong>
            </>
          )
        }
        disabledTitleAttr={
          !hasOrgContext
            ? "Requiere seleccionar una organización para impersonar"
            : "Solo disponible para Propietarios de la organización (Owner)"
        }
      />

      {/* Card 4: Portal de Reclutamiento (Marketplace) */}
      <AdminCard
        href={
          process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3002"
        }
        isExternalLink={true}
        icon={Briefcase}
        iconColorClass="bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
        title="Portal de Reclutamiento"
        description="Accede al Marketplace de conductores. Publica ofertas de alquiler de vehículos y gestiona postulaciones de choferes profesionales."
      />

      {/* Card 5: Dispositivos GPS (Solo Super Admin) */}
      {role === ROLES.SUPER_ADMIN && (
        <AdminCard
          href={getLink("/admin/devices")}
          icon={Cpu}
          iconColorClass="bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
          title="Dispositivos GPS"
          description="Gestiona el inventario de hardware de la plataforma, registra trackers GPS, asocia tarjetas SIM y asígnalos a vehículos de la flota."
        />
      )}

      {/* Card 6: Segmentos de Mapa (Autolearning) */}
      {role === ROLES.SUPER_ADMIN && (
        <AdminCard
          href={getLink("/admin/segments")}
          icon={Map}
          iconColorClass="bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white"
          title="Segmentos de Mapa"
          description="Visualiza el mapa de todos los segmentos de calle (MapLink) en la base de datos, con límites de velocidad, clases funcionales e indicadores de rumbo."
        />
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

function AdminPageContent() {
  const { role } = useAuth();

  // Comprobar si el rol actual es apto para administración
  const isAllowed = [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN].includes(
    role,
  );
  if (!isAllowed) {
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
              administradores o propietarios de la organización pueden acceder
              aquí.
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
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Settings className="text-primary size-7" />
            Panel de Administración
          </h1>
          <p className="text-base-content/60 text-sm mt-0.5">
            Configura y gestiona las operaciones, vehículos, conductores y
            accesos de tu organización.
          </p>
        </div>
      </div>

      <div className="animate-in fade-in duration-200">
        <AdminOverview />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando panel de administración...
          </p>
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
