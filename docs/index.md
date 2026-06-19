# VantX Project Documentation Index

This directory serves as the primary entry point for AI-assisted development and engineering onboarding.

---

## 1. Project Overview

- **Type:** Monorepo with 10 parts (6 apps, 4 packages)
- **Primary Language:** TypeScript
- **Architecture:** Turborepo / pnpm workspaces

---

## 2. Quick Reference by Part

### Applications (apps/)

#### crm-api
- **Type:** Backend API (NestJS 11)
- **Root:** [apps/crm-api/](file:///Users/personal/Projects/vantx-core/apps/crm-api)
- **Port:** 8000

#### dashboard
- **Type:** Web Frontend (Next.js App Router)
- **Root:** [apps/dashboard/](file:///Users/personal/Projects/vantx-core/apps/dashboard)
- **Port:** 3001

#### landing
- **Type:** Web Frontend (Next.js SEO site)
- **Root:** [apps/landing/](file:///Users/personal/Projects/vantx-core/apps/landing)
- **Port:** 3000

#### marketplace
- **Type:** Web Frontend (Next.js matching UI)
- **Root:** [apps/marketplace/](file:///Users/personal/Projects/vantx-core/apps/marketplace)
- **Port:** 3002

#### marketplace-api
- **Type:** Backend API (NestJS matching service)
- **Root:** [apps/marketplace-api/](file:///Users/personal/Projects/vantx-core/apps/marketplace-api)

#### telemetry-ingestor
- **Type:** Telemetry receiver service (Node.js)
- **Root:** [apps/telemetry-ingestor/](file:///Users/personal/Projects/vantx-core/apps/telemetry-ingestor)
- **Port:** 9000 (TCP/UDP)

### Packages (packages/)

#### ui
- **Type:** Shared UI Library (Tailwind + daisyUI)
- **Root:** [packages/ui/](file:///Users/personal/Projects/vantx-core/packages/ui)

#### database
- **Type:** Shared database client (Prisma Schema Folder)
- **Root:** [packages/database/](file:///Users/personal/Projects/vantx-core/packages/database)

#### telemetry-parser
- **Type:** Shared Teltonika Frame codec parser
- **Root:** [packages/telemetry-parser/](file:///Users/personal/Projects/vantx-core/packages/telemetry-parser)

#### auth
- **Type:** Shared token session verify & cookies
- **Root:** [packages/auth/](file:///Users/personal/Projects/vantx-core/packages/auth)

---

## 3. Generated Documentation

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Integration Architecture](./integration-architecture.md)
- [Database Schema Models](./data-models-database.md)
- [Development & Onboarding Guide](./development-guide.md)

### Detailed Architecture Guides
- [CRM API Architecture](./architecture-crm-api.md)
- [Dashboard Architecture](./architecture-dashboard.md)
- [Marketplace Architecture](./architecture-marketplace.md)
- [Telemetry Ingestor Architecture](./architecture-telemetry-ingestor.md)
- [Landing Architecture](./architecture-landing.md)
- [Marketplace API Architecture](./architecture-marketplace-api.md)

### API Contracts
- [CRM API Contracts](./api-contracts-crm-api.md)
- [Marketplace API Contracts](./api-contracts-marketplace-api.md)

---

## 4. Existing Project Documentation

- [DB Migration Reset Instructions](./db-migration-reset-instructions.md) - Baselining guide for production PostgreSQL containers.
- [Document Validation Specification](./documents-validation.md) - S3 and AWS Textract asynchronous upload verification architecture.

---

## 5. Getting Started

To spin up all services in development mode, run:
```bash
npm install
npm run dev
```
For production deployment, utilize:
```bash
docker compose -f docker-compose.prod.yml up -d
```
