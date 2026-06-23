-- AlterTable: Rename TelemetryLog to TelemetryLog_old
ALTER TABLE "TelemetryLog" RENAME TO "TelemetryLog_old";

-- Drop constraints and indexes on the old table to avoid name collisions
ALTER TABLE "TelemetryLog_old" DROP CONSTRAINT IF EXISTS "TelemetryLog_pkey";
ALTER TABLE "TelemetryLog_old" DROP CONSTRAINT IF EXISTS "TelemetryLog_tripId_fkey";
ALTER TABLE "TelemetryLog_old" DROP CONSTRAINT IF EXISTS "TelemetryLog_vehicleId_fkey";
DROP INDEX IF EXISTS "TelemetryLog_vehicleId_timestamp_idx";

-- Create the new TelemetryLog partitioned table
CREATE TABLE "TelemetryLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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
  CONSTRAINT "TelemetryLog_pkey" PRIMARY KEY ("id", "timestamp")
) PARTITION BY RANGE ("timestamp");

-- Pre-create monthly partitions dynamically from 2025 to 2030
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR y IN 2025..2030 LOOP
    FOR m IN 1..12 LOOP
      start_date := TO_DATE(y || '-' || m || '-01', 'YYYY-MM-DD');
      end_date := start_date + INTERVAL '1 month';
      partition_name := 'TelemetryLog_y' || y || 'm' || TO_CHAR(m, 'FM00');
      EXECUTE FORMAT(
        'CREATE TABLE %I PARTITION OF "TelemetryLog" FOR VALUES FROM (%L) TO (%L);',
        partition_name, start_date, end_date
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Create default partition for out-of-range timestamps
CREATE TABLE "TelemetryLog_default" PARTITION OF "TelemetryLog" DEFAULT;

-- Copy data from the old table into the new partitioned table (if data exists)
INSERT INTO "TelemetryLog" (
  "id", "vehicleId", "timestamp", "latitude", "longitude", "angle", "altitude", "satellites",
  "speed", "gpsSpeed", "rpm", "engineLoad", "coolantTemp", "powerSupply",
  "harshAcceleration", "harshBraking", "harshCornering",
  "harshAccelerationDuration", "harshBrakingDuration", "harshCorneringDuration",
  "harshAccelerationAverage", "harshBrakingAverage", "harshCorneringAverage",
  "ignition", "movement", "unplugged", "status", "odometer", "dtcCount", "faultCodes", "vin", "extra", "tripId"
)
SELECT
  "id", "vehicleId", "timestamp", "latitude", "longitude", "angle", "altitude", "satellites",
  "speed", "gpsSpeed", "rpm", "engineLoad", "coolantTemp", "powerSupply",
  "harshAcceleration", "harshBraking", "harshCornering",
  "harshAccelerationDuration", "harshBrakingDuration", "harshCorneringDuration",
  "harshAccelerationAverage", "harshBrakingAverage", "harshCorneringAverage",
  "ignition", "movement", "unplugged", "status", "odometer", "dtcCount", "faultCodes", "vin", "extra", "tripId"
FROM "TelemetryLog_old";

-- Drop the old table
DROP TABLE "TelemetryLog_old";

-- Recreate index on the partitioned table (automatically applies to all partitions)
CREATE INDEX "TelemetryLog_vehicleId_timestamp_idx" ON "TelemetryLog"("vehicleId", "timestamp" DESC);

-- Recreate foreign key constraints on the partitioned table
ALTER TABLE "TelemetryLog" ADD CONSTRAINT "TelemetryLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemetryLog" ADD CONSTRAINT "TelemetryLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create stored procedure for daily telemetry rollups calculation
CREATE OR REPLACE FUNCTION calculate_daily_telemetry_rollups(target_date DATE)
RETURNS VOID AS $$
BEGIN
  -- 1. Purge hardware ghost trips (less than 3 telemetry records)
  DELETE FROM "Trip"
  WHERE "id" IN (
    SELECT "tripId"
    FROM "TelemetryLog"
    WHERE "tripId" IS NOT NULL
    GROUP BY "tripId"
    HAVING COUNT(*) < 3
  );

  -- 2. Compute and insert/update rollups for active trips (tripId IS NOT NULL)
  WITH VehicleThresholds AS (
    SELECT
      v."id" AS vehicle_id,
      v."category" AS vehicle_category,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'OVERSPEEDING'
      ), 110) AS th_overspeed,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HARSH_BRAKING'
      ), 400) AS th_braking,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HARSH_CORNERING'
      ), 300) AS th_cornering,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HARSH_ACCELERATION'
      ), 250) AS th_accel,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HIGH_RPM'
      ), 3500) AS th_rpm,
      COALESCE((
        SELECT (elem->>'maxThreshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HIGH_RPM'
      ), 5000) AS th_maxRpm
    FROM "Vehicle" v
    LEFT JOIN "ScoringProfile" sp ON v."scoringProfileId" = sp."id"
  ),
  TelemetryLag AS (
    SELECT
      t."vehicleId",
      a."driverId" AS driver_or_unassigned,
      t."tripId",
      t."speed", t."rpm", t."ignition", t."status",
      t."harshBraking", t."harshCornering", t."harshAcceleration", 
      t."harshBrakingDuration", t."harshCorneringDuration", t."harshAccelerationDuration",
      t."harshBrakingAverage", t."harshCorneringAverage", t."harshAccelerationAverage",
      t."coolantTemp", t."engineLoad", t."dtcCount",
      t."odometer", t."altitude", t."timestamp",
      t."unplugged",
      
      LAG(t."timestamp") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_time,
      LAG(t."odometer") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_odo,
      LAG(t."altitude") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_alt
    FROM "TelemetryLog" t
    
    LEFT JOIN "Assignment" a 
      ON t."vehicleId" = a."vehicleId"
      AND t."timestamp" >= a."from"
      AND (a."to" IS NULL OR t."timestamp" <= a."to")
      
    WHERE t."timestamp" >= (target_date::timestamp AT TIME ZONE 'America/Panama')
      AND t."timestamp" < (target_date::timestamp AT TIME ZONE 'America/Panama' + INTERVAL '1 day')
  ),
  Deltas AS (
    SELECT
      tl."vehicleId",
      tl.driver_or_unassigned,
      tl."tripId",
      EXTRACT(EPOCH FROM (tl."timestamp" - tl.prev_time)) AS time_diff_sec,
      (tl."odometer" - tl.prev_odo) AS odo_diff,
      CASE 
        WHEN (tl."odometer" - tl.prev_odo) >= 0.05 THEN 
          ((tl."altitude" - tl.prev_alt) / ((tl."odometer" - tl.prev_odo) * 1000.0)) * 100.0
        ELSE 0
      END AS slope_pct,
      tl."speed", tl."rpm", tl."ignition", tl."status",
      tl."harshBraking", tl."harshCornering", tl."harshAcceleration", 
      tl."harshBrakingDuration", tl."harshCorneringDuration", tl."harshAccelerationDuration",
      tl."harshBrakingAverage", tl."harshCorneringAverage", tl."harshAccelerationAverage",
      tl."coolantTemp", tl."engineLoad", tl."dtcCount",
      tl."unplugged"
    FROM TelemetryLag tl
    WHERE tl.prev_time IS NOT NULL
  )
  INSERT INTO "DailyTelemetryRollup" (
    "id", "date", "vehicleId", "driverId", "tripId", "totalKm", "totalEngineHours", "idlingHours", 
    "overspeedCount", "overspeedSeverity", "brakingCount", "brakingSeverity",
    "corneringCount", "corneringSeverity", "accelerationCount", "accelerationSeverity",
    "highRpmCount", "highRpmSeverity", "coldEngineStrainCount", "coastingInNeutralCount", 
    "engineLuggingCount", "highLoadStrainCount", "criticalOverheatingCount",
    "activeFaultCodesCount", "deviceUnpluggedCount"
  )
  SELECT
    gen_random_uuid(),
    target_date,
    d."vehicleId",
    d.driver_or_unassigned,
    d."tripId",
    ROUND(COALESCE(SUM(d.odo_diff) FILTER (WHERE d.odo_diff > 0 AND d.odo_diff < (d.time_diff_sec * 0.05)), 0)::numeric, 3),
    ROUND((COALESCE(SUM(
      CASE 
        WHEN d.time_diff_sec <= 3600 THEN d.time_diff_sec
        WHEN d.odo_diff > 0 AND d.odo_diff < (d.time_diff_sec * 0.05) THEN LEAST(d.odo_diff * 60.0, d.time_diff_sec)
        ELSE 0
      END
    ) FILTER (WHERE d."status" != 'STOPPED'), 0) / 3600.0)::numeric, 3),
    ROUND((COALESCE(SUM(
      CASE 
        WHEN d.time_diff_sec <= 3600 THEN d.time_diff_sec
        ELSE 0
      END
    ) FILTER (WHERE d."status" = 'EXCESSIVE_IDLING'), 0) / 3600.0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."speed" > vt.th_overspeed),
    ROUND(COALESCE(SUM(d."speed" - vt.th_overspeed) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."speed" > vt.th_overspeed), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshBraking" >= vt.th_braking),
    ROUND(COALESCE(SUM((d."harshBraking"::numeric / vt.th_braking::numeric) * (COALESCE(d."harshBrakingAverage", d."harshBraking")::numeric / vt.th_braking::numeric) * (COALESCE(d."harshBrakingDuration", 1000)::numeric / 1000.0)) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshBraking" >= vt.th_braking), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshCornering" >= vt.th_cornering),
    ROUND(COALESCE(SUM((d."harshCornering"::numeric / vt.th_cornering::numeric) * (COALESCE(d."harshCorneringAverage", d."harshCornering")::numeric / vt.th_cornering::numeric) * (COALESCE(d."harshCorneringDuration", 1000)::numeric / 1000.0)) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshCornering" >= vt.th_cornering), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshAcceleration" >= vt.th_accel),
    ROUND(COALESCE(SUM((d."harshAcceleration"::numeric / vt.th_accel::numeric) * (COALESCE(d."harshAccelerationAverage", d."harshAcceleration")::numeric / vt.th_accel::numeric) * (COALESCE(d."harshAccelerationDuration", 1000)::numeric / 1000.0)) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshAcceleration" >= vt.th_accel), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND (
      (d."rpm" > vt.th_rpm AND COALESCE(d.slope_pct, 0) <= 6.0) OR 
      (d."rpm" > vt.th_maxRpm)
    )),
    ROUND(COALESCE(SUM(
      CASE 
        WHEN COALESCE(d.slope_pct, 0) <= 6.0 AND d."rpm" > vt.th_rpm THEN d."rpm" - vt.th_rpm
        WHEN COALESCE(d.slope_pct, 0) > 6.0 AND d."rpm" > vt.th_maxRpm THEN d."rpm" - vt.th_maxRpm
        ELSE 0
      END
    ) FILTER (WHERE d."ignition" = true OR d."rpm" > 400), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."coolantTemp" > 0 AND d."coolantTemp" < 60 AND d."rpm" > 2500),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."speed" > 50 AND d."rpm" <= 900),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."engineLoad" > 90 AND d."rpm" < 1200 AND d."speed" > 15),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."engineLoad" > 85),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."coolantTemp" >= 105),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."dtcCount" > 0),
    CASE WHEN COUNT(*) FILTER (WHERE d."unplugged" = true) > 0 THEN 1 ELSE 0 END
  FROM Deltas d
  JOIN VehicleThresholds vt ON d."vehicleId" = vt.vehicle_id
  WHERE d."tripId" IS NOT NULL
  GROUP BY d."vehicleId", d.driver_or_unassigned, d."tripId", vt.th_overspeed, vt.th_braking, vt.th_cornering, vt.th_accel, vt.th_rpm, vt.th_maxRpm
  ON CONFLICT ("date", "vehicleId", "driverId", "tripId") WHERE "tripId" IS NOT NULL DO UPDATE SET
    "totalKm" = EXCLUDED."totalKm",
    "totalEngineHours" = EXCLUDED."totalEngineHours",
    "idlingHours" = EXCLUDED."idlingHours",
    "overspeedCount" = EXCLUDED."overspeedCount",
    "overspeedSeverity" = EXCLUDED."overspeedSeverity",
    "brakingCount" = EXCLUDED."brakingCount",
    "brakingSeverity" = EXCLUDED."brakingSeverity",
    "corneringCount" = EXCLUDED."corneringCount",
    "corneringSeverity" = EXCLUDED."corneringSeverity",
    "accelerationCount" = EXCLUDED."accelerationCount",
    "accelerationSeverity" = EXCLUDED."accelerationSeverity",
    "highRpmCount" = EXCLUDED."highRpmCount",
    "highRpmSeverity" = EXCLUDED."highRpmSeverity",
    "coldEngineStrainCount" = EXCLUDED."coldEngineStrainCount",
    "coastingInNeutralCount" = EXCLUDED."coastingInNeutralCount",
    "engineLuggingCount" = EXCLUDED."engineLuggingCount",
    "highLoadStrainCount" = EXCLUDED."highLoadStrainCount",
    "criticalOverheatingCount" = EXCLUDED."criticalOverheatingCount",
    "activeFaultCodesCount" = EXCLUDED."activeFaultCodesCount",
    "deviceUnpluggedCount" = EXCLUDED."deviceUnpluggedCount";

  -- 3. Compute and insert/update rollups for orphan records (tripId IS NULL)
  WITH VehicleThresholds AS (
    SELECT
      v."id" AS vehicle_id,
      v."category" AS vehicle_category,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'OVERSPEEDING'
      ), 110) AS th_overspeed,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HARSH_BRAKING'
      ), 400) AS th_braking,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HARSH_CORNERING'
      ), 300) AS th_cornering,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HARSH_ACCELERATION'
      ), 250) AS th_accel,
      COALESCE((
        SELECT (elem->>'threshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HIGH_RPM'
      ), 3500) AS th_rpm,
      COALESCE((
        SELECT (elem->>'maxThreshold')::numeric
        FROM jsonb_array_elements(sp."rulesEngine"->'rules') elem
        WHERE elem->>'code' = 'HIGH_RPM'
      ), 5000) AS th_maxRpm
    FROM "Vehicle" v
    LEFT JOIN "ScoringProfile" sp ON v."scoringProfileId" = sp."id"
  ),
  TelemetryLag AS (
    SELECT
      t."vehicleId",
      a."driverId" AS driver_or_unassigned,
      t."tripId",
      t."speed", t."rpm", t."ignition", t."status",
      t."harshBraking", t."harshCornering", t."harshAcceleration", 
      t."harshBrakingDuration", t."harshCorneringDuration", t."harshAccelerationDuration",
      t."harshBrakingAverage", t."harshCorneringAverage", t."harshAccelerationAverage",
      t."coolantTemp", t."engineLoad", t."dtcCount",
      t."odometer", t."altitude", t."timestamp",
      t."unplugged",
      
      LAG(t."timestamp") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_time,
      LAG(t."odometer") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_odo,
      LAG(t."altitude") OVER (PARTITION BY t."vehicleId" ORDER BY t."timestamp") AS prev_alt
    FROM "TelemetryLog" t
    
    LEFT JOIN "Assignment" a 
      ON t."vehicleId" = a."vehicleId"
      AND t."timestamp" >= a."from"
      AND (a."to" IS NULL OR t."timestamp" <= a."to")
      
    WHERE t."timestamp" >= (target_date::timestamp AT TIME ZONE 'America/Panama')
      AND t."timestamp" < (target_date::timestamp AT TIME ZONE 'America/Panama' + INTERVAL '1 day')
  ),
  Deltas AS (
    SELECT
      tl."vehicleId",
      tl.driver_or_unassigned,
      tl."tripId",
      EXTRACT(EPOCH FROM (tl."timestamp" - tl.prev_time)) AS time_diff_sec,
      (tl."odometer" - tl.prev_odo) AS odo_diff,
      CASE 
        WHEN (tl."odometer" - tl.prev_odo) >= 0.05 THEN 
          ((tl."altitude" - tl.prev_alt) / ((tl."odometer" - tl.prev_odo) * 1000.0)) * 100.0
        ELSE 0
      END AS slope_pct,
      tl."speed", tl."rpm", tl."ignition", tl."status",
      tl."harshBraking", tl."harshCornering", tl."harshAcceleration", 
      tl."harshBrakingDuration", tl."harshCorneringDuration", tl."harshAccelerationDuration",
      tl."harshBrakingAverage", tl."harshCorneringAverage", tl."harshAccelerationAverage",
      tl."coolantTemp", tl."engineLoad", tl."dtcCount",
      tl."unplugged"
    FROM TelemetryLag tl
    WHERE tl.prev_time IS NOT NULL
  )
  INSERT INTO "DailyTelemetryRollup" (
    "id", "date", "vehicleId", "driverId", "tripId", "totalKm", "totalEngineHours", "idlingHours", 
    "overspeedCount", "overspeedSeverity", "brakingCount", "brakingSeverity",
    "corneringCount", "corneringSeverity", "accelerationCount", "accelerationSeverity",
    "highRpmCount", "highRpmSeverity", "coldEngineStrainCount", "coastingInNeutralCount", 
    "engineLuggingCount", "highLoadStrainCount", "criticalOverheatingCount",
    "activeFaultCodesCount", "deviceUnpluggedCount"
  )
  SELECT
    gen_random_uuid(),
    target_date,
    d."vehicleId",
    d.driver_or_unassigned,
    NULL,
    ROUND(COALESCE(SUM(d.odo_diff) FILTER (WHERE d.odo_diff > 0 AND d.odo_diff < (d.time_diff_sec * 0.05)), 0)::numeric, 3),
    ROUND((COALESCE(SUM(
      CASE 
        WHEN d.time_diff_sec <= 3600 THEN d.time_diff_sec
        WHEN d.odo_diff > 0 AND d.odo_diff < (d.time_diff_sec * 0.05) THEN LEAST(d.odo_diff * 60.0, d.time_diff_sec)
        ELSE 0
      END
    ) FILTER (WHERE d."status" != 'STOPPED'), 0) / 3600.0)::numeric, 3),
    ROUND((COALESCE(SUM(
      CASE 
        WHEN d.time_diff_sec <= 3600 THEN d.time_diff_sec
        ELSE 0
      END
    ) FILTER (WHERE d."status" = 'EXCESSIVE_IDLING'), 0) / 3600.0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."speed" > vt.th_overspeed),
    ROUND(COALESCE(SUM(d."speed" - vt.th_overspeed) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."speed" > vt.th_overspeed), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshBraking" >= vt.th_braking),
    ROUND(COALESCE(SUM((d."harshBraking"::numeric / vt.th_braking::numeric) * (COALESCE(d."harshBrakingAverage", d."harshBraking")::numeric / vt.th_braking::numeric) * (COALESCE(d."harshBrakingDuration", 1000)::numeric / 1000.0)) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshBraking" >= vt.th_braking), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshCornering" >= vt.th_cornering),
    ROUND(COALESCE(SUM((d."harshCornering"::numeric / vt.th_cornering::numeric) * (COALESCE(d."harshCorneringAverage", d."harshCornering")::numeric / vt.th_cornering::numeric) * (COALESCE(d."harshCorneringDuration", 1000)::numeric / 1000.0)) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshCornering" >= vt.th_cornering), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshAcceleration" >= vt.th_accel),
    ROUND(COALESCE(SUM((d."harshAcceleration"::numeric / vt.th_accel::numeric) * (COALESCE(d."harshAccelerationAverage", d."harshAcceleration")::numeric / vt.th_accel::numeric) * (COALESCE(d."harshAccelerationDuration", 1000)::numeric / 1000.0)) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."harshAcceleration" >= vt.th_accel), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND (
      (d."rpm" > vt.th_rpm AND COALESCE(d.slope_pct, 0) <= 6.0) OR 
      (d."rpm" > vt.th_maxRpm)
    )),
    ROUND(COALESCE(SUM(
      CASE 
        WHEN COALESCE(d.slope_pct, 0) <= 6.0 AND d."rpm" > vt.th_rpm THEN d."rpm" - vt.th_rpm
        WHEN COALESCE(d.slope_pct, 0) > 6.0 AND d."rpm" > vt.th_maxRpm THEN d."rpm" - vt.th_maxRpm
        ELSE 0
      END
    ) FILTER (WHERE d."ignition" = true OR d."rpm" > 400), 0)::numeric, 3),
    
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."coolantTemp" > 0 AND d."coolantTemp" < 60 AND d."rpm" > 2500),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."speed" > 50 AND d."rpm" <= 900),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."engineLoad" > 90 AND d."rpm" < 1200 AND d."speed" > 15),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."engineLoad" > 85),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."coolantTemp" >= 105),
    COUNT(*) FILTER (WHERE (d."ignition" = true OR d."rpm" > 400) AND d."dtcCount" > 0),
    CASE WHEN COUNT(*) FILTER (WHERE d."unplugged" = true) > 0 THEN 1 ELSE 0 END
  FROM Deltas d
  JOIN VehicleThresholds vt ON d."vehicleId" = vt.vehicle_id
  WHERE d."tripId" IS NULL
  GROUP BY d."vehicleId", d.driver_or_unassigned, vt.th_overspeed, vt.th_braking, vt.th_cornering, vt.th_accel, vt.th_rpm, vt.th_maxRpm
  ON CONFLICT ("date", "vehicleId", "driverId") WHERE "tripId" IS NULL DO UPDATE SET
    "totalKm" = EXCLUDED."totalKm",
    "totalEngineHours" = EXCLUDED."totalEngineHours",
    "idlingHours" = EXCLUDED."idlingHours",
    "overspeedCount" = EXCLUDED."overspeedCount",
    "overspeedSeverity" = EXCLUDED."overspeedSeverity",
    "brakingCount" = EXCLUDED."brakingCount",
    "brakingSeverity" = EXCLUDED."brakingSeverity",
    "corneringCount" = EXCLUDED."corneringCount",
    "corneringSeverity" = EXCLUDED."corneringSeverity",
    "accelerationCount" = EXCLUDED."accelerationCount",
    "accelerationSeverity" = EXCLUDED."accelerationSeverity",
    "highRpmCount" = EXCLUDED."highRpmCount",
    "highRpmSeverity" = EXCLUDED."highRpmSeverity",
    "coldEngineStrainCount" = EXCLUDED."coldEngineStrainCount",
    "coastingInNeutralCount" = EXCLUDED."coastingInNeutralCount",
    "engineLuggingCount" = EXCLUDED."engineLuggingCount",
    "highLoadStrainCount" = EXCLUDED."highLoadStrainCount",
    "criticalOverheatingCount" = EXCLUDED."criticalOverheatingCount",
    "activeFaultCodesCount" = EXCLUDED."activeFaultCodesCount",
    "deviceUnpluggedCount" = EXCLUDED."deviceUnpluggedCount";
END;
$$ LANGUAGE plpgsql;
