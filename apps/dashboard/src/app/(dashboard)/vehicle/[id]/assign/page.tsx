import { AssignVehicleDriver } from "@/types";
import AssignDriverForm from "@/components/AssignDriverForm";
import { fetchServer } from "@/utils/server/api-server";
import { UserCheck } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";

export default async function VehicleAssignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id: vehicleId } = await params;
  const sParams = await searchParams;
  const targetOrgId =
    typeof sParams.targetOrgId === "string" ? sParams.targetOrgId : undefined;
  let driver: AssignVehicleDriver | null = null;

  try {
    const data = await fetchServer(`/vehicles/${vehicleId}/driver`, {
      cache: "no-store",
    });
    driver = data?.driver || null;
  } catch (error) {
    console.error("Error al obtener el conductor desde el servidor:", error);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <BackButton
          fallbackHref={
            targetOrgId ? `/vehicle?targetOrgId=${targetOrgId}` : "/vehicle"
          }
        >
          Volver a vehículos
        </BackButton>
      </div>

      {/* Header */}
      <div className="bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          <UserCheck className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-base-content">
            Asignar Conductor
          </h1>
          <p className="text-xs text-base-content/60 mt-1">
            Vincula un chofer a este vehículo para registrar sus trayectos y
            calcular su puntuación de seguridad.
          </p>
        </div>
      </div>

      {/* Assign Form Wrapper Card */}
      <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md rounded-2xl">
        <div className="card-body p-6">
          <AssignDriverForm vehicleId={vehicleId} initialDriver={driver} />
        </div>
      </div>
    </div>
  );
}
