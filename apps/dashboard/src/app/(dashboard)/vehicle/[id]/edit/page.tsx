'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Car } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import VehicleForm from '@/components/VehicleForm';

export default function VehicleEditPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const targetOrgId = searchParams?.get('targetOrgId');
  const vehicleId = params?.id as string;
  const fallbackHref = targetOrgId ? `/vehicle?targetOrgId=${targetOrgId}` : '/vehicle';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <BackButton fallbackHref={fallbackHref}>
          Volver a vehículos
        </BackButton>
      </div>

      {/* Header */}
      <div className="bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          <Car className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-base-content">
            Editar Vehículo
          </h1>
          <p className="text-xs text-base-content/60 mt-1">
            Modifica la información técnica o el alias de identificación de la unidad.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md rounded-2xl">
        <div className="card-body p-6">
          <VehicleForm
            vehicleId={vehicleId}
            targetOrgId={targetOrgId || undefined}
            onSuccess={() => {
              router.replace(fallbackHref);
              router.refresh();
            }}
            onCancel={() => {
              router.push(fallbackHref);
            }}
          />
        </div>
      </div>
    </div>
  );
}