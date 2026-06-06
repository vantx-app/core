import { fetchServer } from "@/utils/server/api-server";
import { notFound } from "next/navigation";
import { VehicleDetail, VehicleViewPageProps } from '@/types';
import { VehicleDetailClient } from "@/components/VehicleDetailClient";

export default async function VehicleViewPage({ params }: VehicleViewPageProps) {
  const { id: vehicleId } = await params;

  let vehicle: VehicleDetail | null = null;

  try {
    vehicle = await fetchServer(`/vehicles/${vehicleId}`);
  } catch (error) {
    console.error('Error fetching vehicle details from server:', error);
  }

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <VehicleDetailClient vehicle={vehicle} />
    </div>
  );
}
