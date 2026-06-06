# **VantX Monorepo & Shared Authentication Architecture**

**Date:** June 2026  
**Author:** Solo Developer / VantX Architecture

## ---

**1\. Executive Summary**

As VantX scales from two separate codebases into a unified fleet management and marketplace ecosystem, migrating to a monorepo architecture solves code duplication, type safety across boundaries, and pipeline management overhead. This document serves as the structural blueprint for transitioning to a Turborepo-powered monorepo, with a dedicated focus on maintaining a seamless, secure shared authentication strategy across multiple subdomains using HttpOnly cross-subdomain cookies.

## ---

**2\. Monorepo Directory Structure**

The repository uses a workspace-based structure to completely decouple the high-throughput hardware ingestor from user-facing web applications while maximizing code reuse for shared schemas, UI components, and authentication layers.  
`vantx-monorepo/`  
`├── apps/`  
`│   ├── landing/                 # Next.js (Marketing, SEO optimized) [vantx.app]`  
`│   ├── dashboard/               # Next.js App Router (CRM & Fleet Tracking UI) [dashboard.vantx.app]`  
`│   ├── marketplace/             # Next.js App Router (Driver/Vehicle Matchmaking UI) [fleet.vantx.app]`  
`│   ├── crm-api/                 # NestJS / Node.js (Core business logic & CRM endpoints)`  
`│   ├── marketplace-api/         # NestJS / Node.js (Matching, escrow, messaging)`  
`│   └── telemetry-ingestor/      # Lightweight Node.js/Fastify service (High-throughput Teltonika TCP/UDP parsing)`  
`├── packages/`  
`│   ├── auth/                    # Shared auth token verification & cookie configuration`  
`│   ├── database/                # Master Prisma schema, migrations, and global PrismaClient`  
`│   ├── telemetry-parser/        # Teltonika codec (FMC003, FMC150, FMC650 packet parsing logic)`  
`│   ├── ui/                      # Shared React components + Tailwind CSS & daisyUI design system`  
`│   └── ts-config/               # Shared TypeScript base configurations`  
`├── package.json`  
`└── turbo.json                   # Pipeline caching and task orchestration configuration`

## ---

**3\. Subdomain Cookie Authentication Strategy**

To deliver a Single Sign-On (SSO) experience where a user logs in once and seamlessly navigates between dashboard.vantx.app and fleet.vantx.app, VantX utilizes a shared cross-subdomain HttpOnly cookie strategy.

### **3.1 Core Mechanics**

* **The Root Domain Scope:** Instead of issuing cookies restricted to a single host (e.g., dashboard.vantx.app), the authentication endpoint explicitly scopes the session cookie to the wildcard root domain: .vantx.app (noting the leading dot). This permits the browser to automatically attach the cookie to any subsequent HTTP requests sent to any subdomain under vantx.app.  
* **Security Flags:** To prevent token theft, the cookie must be strictly configured with the following parameters:  
  * HttpOnly: True (Prevents client-side JavaScript from accessing the token, neutralizing Cross-Site Scripting (XSS) extraction attacks).  
  * Secure: True (Enforces transmission exclusively over encrypted HTTPS channels).  
  * SameSite: Lax (Ensures the cookie is sent on standard cross-site navigations like clicking a link to cross subdomains, while maintaining CSRF protection).

### **3.2 Authentication Flow Table**

| Step | Actor / Component | Action Description | Security / State Impact   |
| :---- | :---- | :---- | :---- |
| **1** | User (Driver / Owner) | Submits credentials on the unified login form (pointing to the shared auth endpoint). | Credentials sent securely over HTTPS. |
| **2** | Authentication API | Validates credentials against the database (or Didit ID platform) and generates a JWT/session. | Verifies identity and compliance status. |
| **3** | Authentication API | Issues response with headers: Set-Cookie: token=...; Domain=.vantx.app; HttpOnly; Secure; SameSite=Lax | Browser securely stores the cookie globally for all VantX subdomains. |
| **4** | Client Navigation | User navigates from dashboard.vantx.app to fleet.vantx.app. | No re-authentication required; browser natively appends the cookie. |
| **5** | Marketplace / CRM API | Shared middleware inside packages/auth extracts and decodes the cookie payload. | Stateless, fast session verification across both backends. |

## ---

**4\. Workspace Packages Breakdown**

### **4.1 Database Layer (packages/database)**

Maintains a single source of truth for the entire business. Both the CRM API and the Marketplace API import this package directly to ensure complete compile-time type safety over database models.

* Handles User identities and roles.  
* Tracks vehicle metrics, hardware assignments (Teltonika FMC003/150/650 devices), and ECAN02 adapter configurations.  
* Manages marketplace Listings and bidirectional Match/Contract arrangements.

### **4.2 Telemetry Separation (apps/telemetry-ingestor & packages/telemetry-parser)**

The telemetry data stream operates completely isolated from the web layers to protect user application performance from high-throughput network spikes.

* **The Ingestor:** A highly optimized TCP/UDP socket server that handles continuous, raw binary data packets from vehicles.  
* **The Parser:** A shared codec library package parsing GPS, OBDII, and CAN-bus metrics (fuel levels, odometer, driver behavior scoring) before saving to the database pipeline.

### **4.3 Core UI System (packages/ui)**

Houses standard React primitives, layouts, forms, and thematic configurations using Tailwind CSS and daisyUI. This guarantees that whether a user is looking at a premium fleet tracking dashboard or a driver marketplace profile, the visual brand elements and inputs remain completely identical.

## ---

**5\. Development & Pipeline Orchestration**

To manage this architecture locally and in continuous integration, the workspace depends on **Turborepo** combined with **pnpm** workspaces.

* **Zero-Duplication Store:** pnpm utilizes a global hard-link store, meaning shared third-party modules (like Next.js, React, or NestJS) are only downloaded once across all 6+ applications, conserving gigabytes of storage and slashing installation times.  
* **Intelligent Caching:** Turborepo maps the internal graph of dependencies. If an engineer modifies code solely inside apps/marketplace, running a global build will skip checking or compiling unchanged spaces like the telemetry-ingestor, accelerating pipeline feedback.