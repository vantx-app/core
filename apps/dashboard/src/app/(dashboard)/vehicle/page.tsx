import { VehiclePageProps } from '@/types';
import Link from 'next/link';
import { Plus, Car } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { VehicleTableDesktop } from '@/components/VehicleTableDesktop';
import { VehicleMobileView } from './VehicleMobileView';
import { fetchServer } from '@/utils/server/api-server';
import { getUserRole } from '@/utils/server';
import { Suspense } from 'react';
import { ROLES } from '@/utils/enums';

async function VehicleListContainer({ targetOrgId }: { targetOrgId?: string }) {
  const url = targetOrgId ? `/vehicles?targetOrgId=${targetOrgId}` : '/vehicles';
  const vehicles = await fetchServer(url);
  const role = await getUserRole();
  const canCreate = [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN].includes(role);

  if (!vehicles || vehicles.length === 0) {
    return (
      <>
        {/* Desktop View */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20 m-6">
          <Car className="size-16 text-base-content/20 mb-4" />
          <h3 className="text-lg font-bold">No hay vehículos registrados</h3>
          <p className="text-sm text-base-content/50 max-w-sm mt-1">
            Comienza registrando tu primer vehículo para poder rastrear telemetría y asignar conductores.
          </p>
          {canCreate && (
            <Link href={targetOrgId ? `/vehicle/new?targetOrgId=${targetOrgId}` : "/vehicle/new"} className="btn btn-primary mt-6">
              <Plus className="size-5" />
              Registrar Vehículo
            </Link>
          )}
        </div>

        {/* Mobile View */}
        <div className="block lg:hidden">
          <VehicleMobileView vehicles={[]} targetOrgId={targetOrgId} />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block">
        <VehicleTableDesktop vehicles={vehicles} targetOrgId={targetOrgId} />
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden">
        <VehicleMobileView vehicles={vehicles} targetOrgId={targetOrgId} />
      </div>
    </>
  );
}

export default async function VehiclePage({ searchParams }: VehiclePageProps) {
  const params = await searchParams;
  const targetOrgId = typeof params.targetOrgId === 'string' ? params.targetOrgId : undefined;
  const role = await getUserRole();
  const canCreate = [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN].includes(role);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <BackButton
          fallbackHref={targetOrgId ? `/admin?targetOrgId=${targetOrgId}` : "/admin"}
        >
          Volver a administración
        </BackButton>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Car className="text-primary size-7" />
            Control de Vehículos (Flota)
          </h1>
          <p className="text-base-content/60 text-sm">
            Rastrea, edita y administra los vehículos activos en tu organización.
          </p>
        </div>
        {canCreate && (
          <Link
            href={targetOrgId ? `/vehicle/new?targetOrgId=${targetOrgId}` : "/vehicle/new"}
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 shadow-lg shadow-blue-500/20 hidden lg:flex"
          >
            <Plus className="size-5" />
            Registrar Vehículo
          </Link>
        )}
      </div>

      {/* List */}
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        }
      >
        <VehicleListContainer targetOrgId={targetOrgId} />
      </Suspense>
    </div>
  );
}