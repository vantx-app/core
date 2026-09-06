-- CreateEnum
CREATE TYPE "FuelEventType" AS ENUM ('REFUEL', 'DRAIN');

-- CreateTable
CREATE TABLE "FuelEvent" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "tripId" UUID,
    "type" "FuelEventType" NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "percentageDelta" DOUBLE PRECISION NOT NULL,
    "startLevel" DOUBLE PRECISION NOT NULL,
    "endLevel" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuelEvent_vehicleId_timestamp_idx" ON "FuelEvent"("vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "FuelEvent_tripId_idx" ON "FuelEvent"("tripId");

-- AddForeignKey
ALTER TABLE "FuelEvent" ADD CONSTRAINT "FuelEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelEvent" ADD CONSTRAINT "FuelEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
