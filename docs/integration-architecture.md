# VantX Integration Architecture

## 1. Single Sign-On (SSO) & Cookie Authentication

To provide a seamless user experience across the VantX subdomains (`dashboard.vantx.app`, `fleet.vantx.app`), a shared HttpOnly cross-subdomain cookie strategy is utilized.

```mermaid
sequenceDiagram
    autonumber
    actor User as Driver / Owner
    participant Web as dashboard.vantx.app
    participant Auth as @vantx/auth
    participant API as apps/crm-api
    participant DB as packages/database

    User->>Web: Enter Credentials & Submit
    Web->>API: POST /auth/login
    API->>DB: Verify User & Role
    DB-->>API: User Record
    API->>API: Sign JWT token
    API-->>Web: Set-Cookie: token=jwt; Domain=.vantx.app; HttpOnly; Secure; SameSite=Lax
    Web-->>User: Redirect to Dashboard Panel
    User->>Web: Navigate to fleet.vantx.app
    Note over User, Web: Browser automatically appends the token cookie
    Web->>API: GET /listings (includes token)
    API->>Auth: Extract & Verify Token
    Auth-->>API: Valid session (userId, role)
    API-->>Web: Return Listings Data
```

### **1.1 Cookie Security Requirements**

- **HttpOnly:** Must be set to `true` to block JavaScript access (`document.cookie`), preventing XSS token harvesting.
- **Secure:** Must be set to `true` (enforces HTTPS) in production, but configured as `secure: false` in native localhost dev environments.
- **Domain:** Scoped explicitly to `.vantx.app` so all subdomains can access it.
- **SameSite:** `Lax` to allow cookies to be transmitted on standard cross-subdomain navigations.

---

## 2. Docker Network Architecture

In production (`docker-compose.prod.yml`), the services are organized under a single bridge network called `vantx-network`.

- **Internal Service Names:** Next.js frontend apps communicate with the backend using the internal Docker hostnames.
  - Landing, Dashboard, and Marketplace environment variables point to `INTERNAL_API_URL=http://vantx_server:8000`.
- **Public Port Access:** Only ports mapped on the host machine are accessible publicly.
  - `3000` -> Landing UI (`vantx.app`)
  - `3001` -> Dashboard UI (`dashboard.vantx.app`)
  - `3002` -> Marketplace UI (`fleet.vantx.app`)
  - `8000` -> Backend CRM API (mapped internally/externally as needed)
  - `9000` -> Telemetry TCP/UDP Port (accessible from vehicles/devices globally)

---

## 3. Telemetry Stream Flow

The telemetry data path is isolated from web applications to keep high-throughput binary network packets from degrading user response times.

1. **Vehicles (Teltonika FMC003/150/650):** Stream binary packets over TCP/UDP to `vantx_ingestor:9000`.
2. **telemetry-ingestor:** Receives binary data, streams it to `packages/telemetry-parser`.
3. **telemetry-parser:** Parses GPS, OBDII, and CAN-bus metrics (fuel levels, odometer, speed).
4. **database package:** Ingestor writes parsed data directly to the Postgres database (`vantx_db`).
5. **crm-api:** Periodically queries database records to evaluate vehicle metrics or serve dashboard maps.
