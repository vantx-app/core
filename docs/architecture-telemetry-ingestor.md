# Telemetry Ingestor Architecture (telemetry-ingestor)

The Telemetry Ingestor is a lightweight, high-performance Node.js service designed to listen to Teltonika GSM GPS trackers.

---

## 1. Protocol Listener (TCP/UDP)

Vehicles communicate raw binary logs to port `9000` via TCP/UDP.

- **Fast Packets Listener:** Handles high-throughput network payloads without keeping slow HTTP connections alive.
- **Teltonika Codec:** Integrates with `@vantx/telemetry-parser` to split frames, validate CRC checksums, and decode:
  - Latitude, Longitude, Altitude, Angle
  - Speed, Odometer, Fuel Levels
  - Eco-driving metrics (Harsh acceleration, harsh braking)

---

## 2. Data Writing Pipeline

```
[ Vehicles ] -> [ Port 9000 TCP/UDP ] -> [ telemetry-ingestor ] -> [ @vantx/telemetry-parser ] -> [ @vantx/database ] -> [ Postgres DB ]
```

- **Database:** Writes parsed points directly into `TelemetryLog` and updates `VehicleLiveState` to provide fast map coordinate lookups.
- **Decoupled Architecture:** Completely separated from web/express apps to guarantee that network spikes in GPS packet streams do not affect user dashboard interactions.
