# VantX Source Tree Analysis

## 1. Directory Structure

Below is the directory mapping of the VantX Monorepo workspace:

```
vantx-core/
├── apps/                        # Application Services & UIs
│   ├── crm-api/                 # NestJS Core Business Logic & CRM API
│   │   ├── src/                 # Application modules (auth, users, vehicles, drivers)
│   │   └── test/                # E2E & unit specs
│   ├── dashboard/               # Next.js App Router (CRM & Fleet Tracking UI)
│   │   ├── src/app/             # (dashboard), track/, offline/ page routes
│   │   └── src/components/      # UI components (dashboard/, ui/, account/)
│   ├── landing/                 # Next.js Marketing & Public Site [vantx.app]
│   │   └── src/app/             # login/, register/, contact/, how-it-works/
│   ├── marketplace/             # Next.js App Router (Driver & Vehicle matchmaking UI)
│   │   └── src/app/drivers/     # Marketplace matching views
│   ├── marketplace-api/         # NestJS matching logic service
│   └── telemetry-ingestor/      # Node.js service (high-throughput TCP/UDP parser listener)
│       └── src/                 # Ingestor entry and packet processing loop
├── packages/                    # Shared workspace libraries
│   ├── auth/                    # Shared HttpOnly cookie parsing & JWT token validation
│   ├── database/                # Master Prisma configuration & migrations
│   │   └── prisma/schema/       # Multi-file Prisma schemas (enums, assignment, vehicle, etc.)
│   ├── telemetry-parser/        # Teltonika pack/frame codec parsing logic
│   ├── ui/                      # Shared React primitives & Design System (Tailwind + daisyUI)
│   └── tsconfig/                # Base TypeScript configurations
├── turbo.json                   # Turborepo task dependencies config
├── package.json                 # Monorepo workspace configuration
└── docker-compose.prod.yml      # Production environment multi-service orchestrator
```

---

## 2. Key Directories & Entry Points

- **apps/crm-api:** Core backend service. Entry point: [apps/crm-api/src/main.ts](file:///Users/personal/Projects/vantx-core/apps/crm-api/src/main.ts). Listening on port 8000.
- **apps/dashboard:** Fleet administrator panel. Entry point: [apps/dashboard/src/app/page.tsx](file:///Users/personal/Projects/vantx-core/apps/dashboard/src/app/page.tsx). Listening on port 3001 in production container.
- **apps/landing:** Landing site. Entry point: [apps/landing/src/app/page.tsx](file:///Users/personal/Projects/vantx-core/apps/landing/src/app/page.tsx). Listening on port 3000 in production container.
- **apps/marketplace:** Vehicle renting/matchmaking platform. Entry point: [apps/marketplace/src/app/page.tsx](file:///Users/personal/Projects/vantx-core/apps/marketplace/src/app/page.tsx). Listening on port 3002 in production container.
- **apps/telemetry-ingestor:** Fast TCP/UDP packet listener. Entry point: [apps/telemetry-ingestor/src/index.ts](file:///Users/personal/Projects/vantx-core/apps/telemetry-ingestor/src/index.ts). Listening on port 9000.
- **packages/database:** Shared database ORM. Config: [packages/database/prisma/schema/schema.prisma](file:///Users/personal/Projects/vantx-core/packages/database/prisma/schema/schema.prisma).
- **packages/auth:** Shared auth. Entry: [packages/auth/src/index.ts](file:///Users/personal/Projects/vantx-core/packages/auth/src/index.ts).
