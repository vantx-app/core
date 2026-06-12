import { VehicleTripsPageProps } from "@/types";
import { fetchServer } from "@/utils/server/api-server";
import VehicleTripsClient from "@/components/VehicleTripsClient";
import { notFound } from "next/navigation";

export default async function VehicleTripsPage({
  params,
}: VehicleTripsPageProps) {
  const { id: vehicleId } = await params;

  let vehicle = null;
  let trips = [];

  try {
    // 1. Cargar metadatos del vehículo
    vehicle = await fetchServer(`/vehicles/${vehicleId}`);

    // 2. Cargar historial de viajes del vehículo
    trips = await fetchServer(`/vehicles/${vehicleId}/trips`);
  } catch (error) {
    console.error(
      "Error al obtener información de viajes del vehículo desde el servidor:",
      error,
    );
  }

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto lg:h-[calc(100vh-48px)] lg:overflow-hidden lg:flex lg:flex-col">
      <VehicleTripsClient vehicle={vehicle} initialTrips={trips || []} />
    </div>
  );
}
