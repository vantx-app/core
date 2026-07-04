-- AlterTable
ALTER TABLE "TelemetryLog" DROP COLUMN "throttlePosition";

-- AlterTable
ALTER TABLE "VehicleLiveState" ADD COLUMN     "lastFuelLevel" DOUBLE PRECISION;
