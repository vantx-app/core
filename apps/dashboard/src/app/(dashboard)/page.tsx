import { DashboardPageProps } from "@/types";
import { getUserRole } from "@/utils/server";
import { fetchServer } from "@/utils/server/api-server";
import { ROLES } from "@/utils/enums";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";
import { DriverDashboard } from "@/components/dashboard/DriverDashboard";
export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const targetOrgId =
    typeof params.targetOrgId === "string" ? params.targetOrgId : undefined;
  const role = await getUserRole();

  if (role === ROLES.SUPER_ADMIN) {
    if (targetOrgId) {
      let vehicles = [];
      let drivers = [];

      try {
        vehicles = await fetchServer(
          `/vehicles?liveState=true&targetOrgId=${targetOrgId}`,
        );
      } catch (e) {
        console.error("Error fetching vehicles:", e);
      }

      try {
        drivers = await fetchServer(`/drivers?targetOrgId=${targetOrgId}`);
      } catch (e) {
        console.error("Error fetching drivers:", e);
      }

      return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <OwnerDashboard
            vehicles={vehicles}
            drivers={drivers}
            targetOrgId={targetOrgId}
          />
        </div>
      );
    }

    let organizations = [];
    let vehicles = [];
    let drivers = [];

    try {
      organizations = await fetchServer("/organizations");
    } catch (e) {
      console.error("Error fetching organizations:", e);
    }

    try {
      vehicles = await fetchServer("/vehicles?liveState=true");
    } catch (e) {
      console.error("Error fetching vehicles:", e);
    }

    try {
      drivers = await fetchServer("/drivers");
    } catch (e) {
      console.error("Error fetching drivers:", e);
    }

    return (
      <div className="p-6 max-w-7xl mx-auto">
        <SuperAdminDashboard
          organizations={organizations}
          vehicles={vehicles}
          drivers={drivers}
        />
      </div>
    );
  }

  if (role === ROLES.OWNER || role === ROLES.ADMIN) {
    const isDriverView = params.view === "driver";

    if (isDriverView) {
      let driverStats = null;
      let errorMsg = null;
      try {
        driverStats = await fetchServer("/drivers/me/stats");
      } catch (e) {
        console.error("Error fetching driver stats:", e);
        errorMsg =
          "No se encontró perfil de conductor asociado a este usuario.";
      }

      if (errorMsg || !driverStats) {
        return (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="alert alert-error shadow-lg">
              <span className="text-white font-semibold">
                {errorMsg || "Error al cargar perfil de conductor"}
              </span>
            </div>
            <div className="text-center py-8 bg-base-100/50 backdrop-blur-md rounded-2xl border border-base-200">
              <p className="text-sm text-base-content/60">
                Asegúrate de tener un perfil de conductor vinculado en la
                sección de administración de usuarios.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="p-6 max-w-7xl mx-auto">
          <DriverDashboard stats={driverStats} />
        </div>
      );
    }

    let vehicles = [];
    let drivers = [];

    try {
      vehicles = await fetchServer("/vehicles?liveState=true");
    } catch (e) {
      console.error("Error fetching vehicles:", e);
    }

    try {
      drivers = await fetchServer("/drivers");
    } catch (e) {
      console.error("Error fetching drivers:", e);
    }

    return (
      <div className="p-6 max-w-7xl mx-auto">
        <OwnerDashboard vehicles={vehicles} drivers={drivers} />
      </div>
    );
  }

  // Si el rol es DRIVER
  let driverStats = null;
  try {
    driverStats = await fetchServer("/drivers/me/stats");
  } catch (e) {
    console.error("Error fetching driver stats:", e);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DriverDashboard stats={driverStats} />
    </div>
  );
}
