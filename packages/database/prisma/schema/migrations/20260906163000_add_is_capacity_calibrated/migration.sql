-- AlterTable Vehicle
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "isCapacityCalibrated" BOOLEAN NOT NULL DEFAULT false;
