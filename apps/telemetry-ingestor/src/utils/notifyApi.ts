/* eslint-disable @typescript-eslint/no-unsafe-member-access */

const { API_HOST, API_PORT, INGESTOR_SECRET } = process.env;
const API_WEBHOOK_URL = `http://${API_HOST}:${API_PORT}/api/internal/telemetry`;

export async function notifyApi(vehicle: any, latestRecord: any) {
  const payload = {
    vehicleId: vehicle.id,
    vehicleAlias: vehicle.alias,
    orgId: vehicle.orgId,
    latitude: latestRecord.latitude,
    longitude: latestRecord.longitude,
    speed: latestRecord.speed,
    ignition: latestRecord.ignition,
    timestamp: latestRecord.timestamp,
    status: latestRecord.status,
    angle: latestRecord.angle,
    odometer: latestRecord.odometer,
  };

  await fetch(API_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": INGESTOR_SECRET || "local-dev",
    },
    body: JSON.stringify(payload),
  });
}
