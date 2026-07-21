import { PrismaClient, MapLink } from "@vantx/database";
import { snapPointToLinks, Logger, AvlMapping } from "@vantx/telemetry-parser";
import { getAvlValue } from "./telemetryParser";

const logger = new Logger("SnapTelemetry");

export async function snapTelemetryRecords(
  records: any[],
  prisma: PrismaClient,
  mapping: AvlMapping,
): Promise<any[]> {
  try {
    const validRecords = records.filter(
      (r) => r.latitude !== 0 && r.longitude !== 0,
    );
    if (validRecords.length === 0) return records;

    // Safe check for prisma.mapLink mock compatibility in testing
    if (!(prisma as any).mapLink) return records;

    // Create a new array with cloned objects to avoid mutating original inputs
    const processedRecords = records.map((rec) => ({ ...rec }));
    const validProcessedRecords = processedRecords.filter(
      (r) => r.latitude !== 0 && r.longitude !== 0,
    );

    // Process in chunks of 20 records to keep bounding boxes tight and query sizes small on t3.small
    const CHUNK_SIZE = 20;
    for (let i = 0; i < validProcessedRecords.length; i += CHUNK_SIZE) {
      const chunk = validProcessedRecords.slice(i, i + CHUNK_SIZE);
      const lats = chunk.map((r) => r.latitude);
      const lngs = chunk.map((r) => r.longitude);

      const minLat = Math.min(...lats) - 0.002;
      const maxLat = Math.max(...lats) + 0.002;
      const minLng = Math.min(...lngs) - 0.002;
      const maxLng = Math.max(...lngs) + 0.002;

      // Skip snapping for this chunk if the bounding box is absurdly large (e.g., GPS noise or telemetry jumping)
      if (maxLat - minLat > 0.05 || maxLng - minLng > 0.05) {
        logger.warn(
          `⚠️ Bounding box for chunk too large (${(maxLat - minLat).toFixed(4)}x${(maxLng - minLng).toFixed(4)}), skipping snapping for this segment.`,
        );
        continue;
      }

      const cachedLinks = await (prisma as any).$queryRaw<MapLink[]>`
        SELECT * FROM "MapLink"
        WHERE box(point("minLng", "minLat"), point("maxLng", "maxLat")) && box(point(${minLng}, ${minLat}), point(${maxLng}, ${maxLat}))
      `;

      if (cachedLinks && cachedLinks.length > 0) {
        const parsedLinks = cachedLinks.map((link: any) => {
          const pts = link.geometry.split(";").map((pair: string) => {
            const [lng, lat] = pair.split(",").map(Number);
            return [lng, lat] as [number, number];
          });
          return {
            linkId: link.linkId,
            functionalClass: link.functionalClass,
            speedLimit: link.speedLimit,
            points: pts,
            isBidirectional: link.isBidirectional,
          };
        });

        for (const rec of chunk) {
          // Evitar snapping si la ignición del vehículo está apagada (vehículo apagado)
          const rawRpm = getAvlValue(rec.ioData, mapping.rpm) ?? 0;
          const rawVoltage = getAvlValue(rec.ioData, mapping.voltage) ?? 0;
          const rawIgnitionPin = getAvlValue(rec.ioData, mapping.ignition) === 1;
          
          let isHardwareExcessiveIdling = false;
          const mappedExcessiveIdling = getAvlValue(rec.ioData, mapping.excessiveIdling);
          if (mappedExcessiveIdling !== null) {
            isHardwareExcessiveIdling = mappedExcessiveIdling === 1;
          }

          const trueIgnition =
            rawIgnitionPin ||
            rawRpm > 150 ||
            (mapping.ignition === undefined && rawVoltage > 13200) ||
            isHardwareExcessiveIdling;

          if (
            (rec.satellites !== undefined && rec.satellites < 5) ||
            !trueIgnition
          ) {
            continue;
          }

          const res = snapPointToLinks(
            rec.latitude,
            rec.longitude,
            rec.gpsSpeed ?? 0,
            rec.angle,
            parsedLinks,
            0.035, // 35 meters threshold
          );

          if (res.snapped) {
            rec.latitude = res.latitude;
            rec.longitude = res.longitude;
          }
        }
      }
    }

    return processedRecords;
  } catch (snapError: any) {
    logger.warn(`⚠️ Error in live road snapping logic: ${snapError.message}`);
    return records;
  }
}
