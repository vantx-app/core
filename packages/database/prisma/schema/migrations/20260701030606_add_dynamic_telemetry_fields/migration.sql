-- AlterEnum
ALTER TYPE "DeviceModel" ADD VALUE 'FMC650_FMS';

-- AlterTable
ALTER TABLE "TelemetryLog" ADD COLUMN     "fuelConsumption" DOUBLE PRECISION,
ADD COLUMN     "fuelLevel" DOUBLE PRECISION,
ADD COLUMN     "fuelRate" DOUBLE PRECISION,
ADD COLUMN     "throttlePosition" SMALLINT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "capabilities" JSONB;
