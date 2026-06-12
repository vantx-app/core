import { fetchServer } from "@/utils/server/api-server";
import { notFound } from "next/navigation";
import { DriverStats, DashboardVehicle } from "@/types";
import { DriverDetailClient } from "@/components/DriverDetailClient";

interface DriverViewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DriverViewPage({
  params,
  searchParams,
}: DriverViewPageProps) {
  const { id: driverId } = await params;
  const sParams = await searchParams;
  const targetOrgId =
    typeof sParams.targetOrgId === "string" ? sParams.targetOrgId : undefined;

  let driver: any = null;
  let trips: any[] = [];
  let dailyReports: any[] = [];
  let vehicles: DashboardVehicle[] = [];

  try {
    // Fetch driver general details and weekly snapshots
    driver = await fetchServer(`/drivers/${driverId}`);
  } catch (error) {
    console.error("Error fetching driver details from server:", error);
  }

  if (!driver) {
    notFound();
  }

  // Fetch remaining data in parallel
  try {
    const tripsUrl = `/drivers/${driverId}/trips`;
    const reportsUrl = `/drivers/${driverId}/daily-reports?limit=50`;
    const vehiclesUrl = targetOrgId
      ? `/vehicles?targetOrgId=${targetOrgId}`
      : "/vehicles";

    const [tripsData, reportsData, vehiclesData] = await Promise.all([
      fetchServer(tripsUrl).catch((err) => {
        console.error("Error fetching driver trips:", err);
        return [];
      }),
      fetchServer(reportsUrl).catch((err) => {
        console.error("Error fetching driver daily reports:", err);
        return [];
      }),
      fetchServer(vehiclesUrl).catch((err) => {
        console.error("Error fetching vehicles:", err);
        return [];
      }),
    ]);

    trips = tripsData || [];
    dailyReports = reportsData || [];
    vehicles = vehiclesData || [];
  } catch (error) {
    console.error("Error fetching auxiliary driver data:", error);
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <DriverDetailClient
        driver={driver}
        trips={trips}
        dailyReports={dailyReports}
        vehicles={vehicles}
        targetOrgId={targetOrgId}
      />
    </div>
  );
}
