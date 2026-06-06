-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'IN_MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "VehicleMovementStatus" AS ENUM ('STOPPED', 'MOVING', 'IDLING', 'EXCESSIVE_IDLING', 'UNPLUGGED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DriverDocumentType" AS ENUM ('NATIONAL_ID', 'DRIVERS_LICENSE', 'POLICE_RECORD');

-- CreateEnum
CREATE TYPE "DriverDocumentStatus" AS ENUM ('PENDING_UPLOAD', 'PENDING_VALIDATION', 'APPROVED', 'PENDING_MANUAL_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('NONE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('HEAVY_DUTY', 'LIGHT_COMMERCIAL', 'PASSENGER', 'MACHINERY');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "to" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTelemetryRollup" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEngineHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "idlingHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overspeedCount" INTEGER NOT NULL DEFAULT 0,
    "overspeedSeverity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brakingCount" INTEGER NOT NULL DEFAULT 0,
    "brakingSeverity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "corneringCount" INTEGER NOT NULL DEFAULT 0,
    "corneringSeverity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accelerationCount" INTEGER NOT NULL DEFAULT 0,
    "accelerationSeverity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "highRpmCount" INTEGER NOT NULL DEFAULT 0,
    "highRpmSeverity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coldEngineStrainCount" INTEGER NOT NULL DEFAULT 0,
    "coastingInNeutralCount" INTEGER NOT NULL DEFAULT 0,
    "engineLuggingCount" INTEGER NOT NULL DEFAULT 0,
    "highLoadStrainCount" INTEGER NOT NULL DEFAULT 0,
    "criticalOverheatingCount" INTEGER NOT NULL DEFAULT 0,
    "activeFaultCodesCount" INTEGER NOT NULL DEFAULT 0,
    "deviceUnpluggedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyTelemetryRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "type" "DriverDocumentType" NOT NULL,
    "status" "DriverDocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "extractedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverGlobalStats" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSnapshots" INTEGER NOT NULL DEFAULT 0,
    "globalSafetyScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "globalEcoScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "globalAssetScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "globalOverallScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverGlobalStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverScoreSnapshot" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "safetyScore" DOUBLE PRECISION NOT NULL,
    "ecoScore" DOUBLE PRECISION NOT NULL,
    "assetScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdown" JSONB,

    CONSTRAINT "DriverScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "firstName" TEXT,
    "lastName" TEXT,
    "nationalId" TEXT NOT NULL,
    "phone" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "licenseType" TEXT,
    "shareScoresPublicly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInvitation" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
    "freeMatchCredits" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "paymentReceiptKey" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringProfile" (
    "id" UUID NOT NULL,
    "orgId" UUID,
    "name" TEXT NOT NULL,
    "rulesEngine" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TelemetryLog" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "angle" SMALLINT NOT NULL DEFAULT 0,
    "altitude" SMALLINT,
    "satellites" SMALLINT,
    "speed" SMALLINT NOT NULL DEFAULT 0,
    "gpsSpeed" SMALLINT NOT NULL DEFAULT 0,
    "rpm" SMALLINT,
    "engineLoad" SMALLINT,
    "coolantTemp" SMALLINT,
    "powerSupply" DOUBLE PRECISION,
    "harshAcceleration" SMALLINT NOT NULL DEFAULT 0,
    "harshBraking" SMALLINT NOT NULL DEFAULT 0,
    "harshCornering" SMALLINT NOT NULL DEFAULT 0,
    "harshAccelerationDuration" INTEGER,
    "harshBrakingDuration" INTEGER,
    "harshCorneringDuration" INTEGER,
    "harshAccelerationAverage" INTEGER,
    "harshBrakingAverage" INTEGER,
    "harshCorneringAverage" INTEGER,
    "ignition" BOOLEAN NOT NULL DEFAULT false,
    "movement" BOOLEAN NOT NULL DEFAULT false,
    "unplugged" BOOLEAN NOT NULL DEFAULT false,
    "status" "VehicleMovementStatus" NOT NULL DEFAULT 'STOPPED',
    "odometer" DOUBLE PRECISION,
    "dtcCount" SMALLINT NOT NULL DEFAULT 0,
    "faultCodes" TEXT,
    "vin" VARCHAR(50),
    "extra" JSONB,
    "tripId" UUID,

    CONSTRAINT "TelemetryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "clientName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "orgId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGlobalStats" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEngineHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "globalMaintenanceScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "globalFuelEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "globalSafetyScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "globalOverallScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleGlobalStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleLiveState" (
    "vehicleId" UUID NOT NULL,
    "lastLat" DOUBLE PRECISION NOT NULL,
    "lastLng" DOUBLE PRECISION NOT NULL,
    "lastAngle" SMALLINT NOT NULL DEFAULT 0,
    "lastSpeed" SMALLINT NOT NULL DEFAULT 0,
    "lastIgnition" BOOLEAN NOT NULL DEFAULT false,
    "unplugged" BOOLEAN NOT NULL DEFAULT false,
    "currentStatus" "VehicleMovementStatus" NOT NULL DEFAULT 'STOPPED',
    "lastOdometer" DOUBLE PRECISION,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleLiveState_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "VehicleScoreSnapshot" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "maintenanceScore" DOUBLE PRECISION NOT NULL,
    "fuelEfficiency" DOUBLE PRECISION NOT NULL,
    "safetyScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "idlingHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTrips" INTEGER NOT NULL DEFAULT 0,
    "breakdown" JSONB,

    CONSTRAINT "VehicleScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "imei" TEXT,
    "alias" TEXT,
    "plateNumber" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'NONE',
    "deviceModel" TEXT NOT NULL DEFAULT 'FMC003',
    "trialActivated" BOOLEAN NOT NULL DEFAULT false,
    "trialExpiresAt" TIMESTAMP(3),
    "scoringProfileId" UUID,
    "category" "VehicleCategory" NOT NULL DEFAULT 'PASSENGER',
    "fuelType" "FuelType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceProfile" TEXT NOT NULL DEFAULT 'TELTONIKA_STANDARD',
    "initialOdometer" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_driverId_from_to_idx" ON "Assignment"("driverId", "from", "to");

-- CreateIndex
CREATE INDEX "Assignment_vehicleId_idx" ON "Assignment"("vehicleId");

-- CreateIndex
CREATE INDEX "DailyTelemetryRollup_date_idx" ON "DailyTelemetryRollup"("date");

-- CreateIndex
CREATE INDEX "DailyTelemetryRollup_vehicleId_idx" ON "DailyTelemetryRollup"("vehicleId");

-- CreateIndex
CREATE INDEX "DailyTelemetryRollup_driverId_idx" ON "DailyTelemetryRollup"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTelemetryRollup_date_vehicleId_driverId_key" ON "DailyTelemetryRollup"("date", "vehicleId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverDocument_driverId_type_key" ON "DriverDocument"("driverId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DriverGlobalStats_driverId_key" ON "DriverGlobalStats"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverScoreSnapshot_driverId_weekNumber_year_key" ON "DriverScoreSnapshot"("driverId", "weekNumber", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_nationalId_key" ON "Driver"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvitation_token_key" ON "OrgInvitation"("token");

-- CreateIndex
CREATE INDEX "ScoringProfile_orgId_idx" ON "ScoringProfile"("orgId");

-- CreateIndex
CREATE INDEX "TelemetryLog_vehicleId_timestamp_idx" ON "TelemetryLog"("vehicleId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "TrackingLink_id_isActive_idx" ON "TrackingLink"("id", "isActive");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_idx" ON "Trip"("vehicleId");

-- CreateIndex
CREATE INDEX "Trip_startTime_idx" ON "Trip"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGlobalStats_vehicleId_key" ON "VehicleGlobalStats"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleScoreSnapshot_vehicleId_weekNumber_year_key" ON "VehicleScoreSnapshot"("vehicleId", "weekNumber", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_imei_key" ON "Vehicle"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_orgId_plateNumber_key" ON "Vehicle"("orgId", "plateNumber");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTelemetryRollup" ADD CONSTRAINT "DailyTelemetryRollup_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTelemetryRollup" ADD CONSTRAINT "DailyTelemetryRollup_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverGlobalStats" ADD CONSTRAINT "DriverGlobalStats_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverScoreSnapshot" ADD CONSTRAINT "DriverScoreSnapshot_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryLog" ADD CONSTRAINT "TelemetryLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryLog" ADD CONSTRAINT "TelemetryLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleGlobalStats" ADD CONSTRAINT "VehicleGlobalStats_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLiveState" ADD CONSTRAINT "VehicleLiveState_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleScoreSnapshot" ADD CONSTRAINT "VehicleScoreSnapshot_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_scoringProfileId_fkey" FOREIGN KEY ("scoringProfileId") REFERENCES "ScoringProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

