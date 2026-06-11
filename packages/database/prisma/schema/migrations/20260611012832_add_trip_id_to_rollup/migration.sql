-- DropIndex
DROP INDEX "DailyTelemetryRollup_date_vehicleId_driverId_key";

-- AlterTable
ALTER TABLE "DailyTelemetryRollup" ADD COLUMN     "tripId" UUID;

-- CreateIndex
CREATE INDEX "DailyTelemetryRollup_tripId_idx" ON "DailyTelemetryRollup"("tripId");

-- AddForeignKey
ALTER TABLE "DailyTelemetryRollup" ADD CONSTRAINT "DailyTelemetryRollup_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create partial unique index for active trips
CREATE UNIQUE INDEX "DailyTelemetryRollup_date_vehicleId_driverId_tripId_key" ON "DailyTelemetryRollup"("date", "vehicleId", "driverId", "tripId") WHERE "tripId" IS NOT NULL;

-- Create partial unique index for unassigned logs
CREATE UNIQUE INDEX "DailyTelemetryRollup_date_vehicleId_driverId_key" ON "DailyTelemetryRollup"("date", "vehicleId", "driverId") WHERE "tripId" IS NULL;
