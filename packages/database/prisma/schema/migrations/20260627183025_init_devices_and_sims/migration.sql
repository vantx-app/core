-- CreateEnum
CREATE TYPE "DeviceModel" AS ENUM ('FMC003', 'FMC150', 'FMC650');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('UNASSIGNED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "DeviceSource" AS ENUM ('FOTA', 'MANUAL');

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "imei" TEXT NOT NULL,
    "model" "DeviceModel" NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "firmware" TEXT,
    "source" "DeviceSource" NOT NULL DEFAULT 'FOTA',
    "lastSeen" TIMESTAMP(3),
    "vehicleId" UUID,
    "simCardId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimCard" (
    "id" UUID NOT NULL,
    "iccid" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "carrier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_imei_key" ON "Device"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "Device_vehicleId_key" ON "Device"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_simCardId_key" ON "Device"("simCardId");

-- CreateIndex
CREATE UNIQUE INDEX "SimCard_iccid_key" ON "SimCard"("iccid");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_simCardId_fkey" FOREIGN KEY ("simCardId") REFERENCES "SimCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data Migration: Copy existing vehicle IMEIs to Device table
INSERT INTO "Device" ("id", "imei", "model", "status", "source", "vehicleId", "updatedAt")
SELECT 
  gen_random_uuid(), 
  "imei", 
  CASE 
    WHEN "deviceModel" = 'FMC150' THEN 'FMC150'::"DeviceModel"
    WHEN "deviceModel" = 'FMC650' THEN 'FMC650'::"DeviceModel"
    ELSE 'FMC003'::"DeviceModel"
  END,
  'ACTIVE'::"DeviceStatus", 
  'MANUAL'::"DeviceSource", 
  "id", 
  NOW()
FROM "Vehicle"
WHERE "imei" IS NOT NULL;

-- DropIndex
DROP INDEX "Vehicle_imei_key";

-- AlterTable
ALTER TABLE "TelemetryLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "deviceModel",
DROP COLUMN "deviceProfile",
DROP COLUMN "imei";

