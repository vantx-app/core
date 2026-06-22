# VantX Data Models & Schema

The database is built on **PostgreSQL** and modeled using a partitioned multi-file schema via Prisma's `prismaSchemaFolder` preview feature.

---

## 1. Schema Files Overview

The database models are organized into specific context files inside `packages/database/prisma/schema/`:

- **schema.prisma:** Core datasource and client generator setup.
- **enums.prisma:** Enumeration types (e.g., `Role`, `DriverStatus`, `VehicleStatus`, `SubscriptionTier`).
- **user.prisma:** Auth identity credentials.
- **session.prisma:** User session tracking.
- **organization.prisma:** Fleet owners / logistics entities.
- **org-invitation.prisma:** Team recruitment invitations.
- **driver.prisma:** Driver profile details.
- **driver-document.prisma:** Driver onboarding licenses/documents.
- **driver-global-stats.prisma** & **driver-score-snapshot.prisma:** Score calculations and summaries.
- **vehicle.prisma:** Vehicle specs, listing prices, device parameters (Teltonika FMC003/150/650).
- **vehicle-live-state.prisma:** Real-time updates from telemetry listener (odometer, GPS).
- **vehicle-global-stats.prisma** & **vehicle-score-snapshot.prisma:** Vehicle safety score statistics.
- **assignment.prisma:** Associating drivers to specific vehicles.
- **scoring-profile.prisma:** Multipliers/factors for safety scoring.
- **daily-telemetry-rollup.prisma:** Compact aggregates of daily usage metrics.
- **telemetry-log.prisma:** Raw parsed telemetry packet data logs.
- **tracking-link.prisma:** Shareable map routes tracking.
- **trip.prisma:** Evaluated trip records.
- **system-setting.prisma:** Globals variables.

---

## 2. Core Entities Details

### **2.1 User & Organization**

- **User:** Represents system actors. Has an `email`, `password` (bcrypt hash), `role` (`DRIVER`, `ADMIN`, `FLEET_OWNER`), and is linked optionally to an `Organization`.
- **Organization:** Owns vehicles, manages invitations, and hosts fleet managers.

### **2.2 Driver**

- Linked 1-to-1 with `User`. Holds `nationalId`, `licenseType`, `status` (`ACTIVE`, `INACTIVE`), onboarding `DriverDocument` files, and safety telemetry `DriverGlobalStats`.

### **2.3 Vehicle**

- Contains vehicle identification (`plateNumber`, `vin`, `make`, `model`).
- Configures hardware bindings: `imei` (GSM tracker IMEI) and `deviceModel` (e.g., `FMC003`, `FMC150`, `FMC650`).
- Market properties: `isListed` (boolean), `listingPrice`, `listingDescription`, `hasOptionToBuy`.
- Linked 1-to-1 with `VehicleLiveState` (updated constantly by the ingestor) and many `TelemetryLog` records.

### **2.4 Assignment**

- Links a `Driver` to a `Vehicle` with custom active statuses, representing who is currently operating which vehicle.
