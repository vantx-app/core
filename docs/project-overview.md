# VantX Project Overview

## 1. Project Description & Purpose
VantX is an integrated Fleet Management and Driver/Vehicle Marketplace platform. It allows fleet owners to track vehicle metrics, manage hardware device assignments, run rules engine scoring, and match drivers to vehicles using a unified matching ecosystem.

---

## 2. Monorepo Architecture Classification
VantX is built as a **Turborepo-powered monorepo** utilizing **pnpm workspaces** for code package management, pipeline orchestration, and caching.

- **Repository Structure:** Workspace-based monorepo separating frontend web applications, backend APIs, and shared utility packages.
- **SSO Strategy:** Single Sign-On using shared HttpOnly cookies scoped at `.vantx.app` domain across all subdomains (e.g., `dashboard.vantx.app`, `fleet.vantx.app`).

---

## 3. Technology Stack Summary

| Package/App Path | Type | Framework / Library | Primary Language | Database / Core Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **apps/landing** | Web (Frontend) | Next.js | TypeScript | Tailwind CSS v4, daisyUI |
| **apps/dashboard** | Web (Frontend) | Next.js App Router | TypeScript | Tailwind CSS v4, Mapbox GL, Socket.io-client |
| **apps/marketplace** | Web (Frontend) | Next.js App Router | TypeScript | Tailwind CSS v4, Socket.io-client |
| **apps/crm-api** | Backend API | NestJS | TypeScript | Prisma ORM, AWS SDK v3, Socket.io |
| **apps/marketplace-api** | Backend API | NestJS | TypeScript | Prisma ORM, `@vantx/auth` |
| **apps/telemetry-ingestor**| Backend Ingestor| Node.js service | TypeScript | Raw TCP/UDP Teltonika FMC protocol listener |
| **packages/ui** | Library | Shared UI | TypeScript | Shared daisyUI / Tailwind components |
| **packages/database** | Data | Prisma Schema | TypeScript | Shared Prisma Client & PostgreSQL schemas |
| **packages/telemetry-parser**| Library | Parser | TypeScript | Teltonika packet codecs (FMC003/150/650) |
| **packages/auth** | Library | Auth helper | TypeScript | Cookie authentication & token verification |

---

## 4. Documentation Map
- **Master Index:** [docs/index.md](file:///Users/personal/Projects/vantx-core/docs/index.md)
- **Source Tree Analysis:** [docs/source-tree-analysis.md](file:///Users/personal/Projects/vantx-core/docs/source-tree-analysis.md)
- **Integration Architecture:** [docs/integration-architecture.md](file:///Users/personal/Projects/vantx-core/docs/integration-architecture.md)
- **Database Schema Models:** [docs/data-models-database.md](file:///Users/personal/Projects/vantx-core/docs/data-models-database.md)
- **Development & Deployment Guide:** [docs/development-guide.md](file:///Users/personal/Projects/vantx-core/docs/development-guide.md)

*Detailed architectures:*
- [CRM API Architecture](file:///Users/personal/Projects/vantx-core/docs/architecture-crm-api.md)
- [Dashboard Architecture](file:///Users/personal/Projects/vantx-core/docs/architecture-dashboard.md)
- [Marketplace Architecture](file:///Users/personal/Projects/vantx-core/docs/architecture-marketplace.md)
- [Telemetry Ingestor Architecture](file:///Users/personal/Projects/vantx-core/docs/architecture-telemetry-ingestor.md)
