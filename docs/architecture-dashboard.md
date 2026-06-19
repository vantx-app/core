# Dashboard UI Architecture (dashboard)

The Dashboard is a Next.js App Router frontend application built for fleet operations managers and owners.

---

## 1. System Design

The application structure utilizes Next.js App Router for server components, file-system routing, and client context caching.

- **Routing:**
  - `(dashboard)/` group: Layout and primary subpages (Overview, Vehicles list, Drivers list).
  - `track/` route: Map visualization rendering live vehicle positions.
  - `offline/` route: Fallback rendering when no network connectivity is present.
- **State Management:**
  - Handled via standard React Context (e.g. `AuthContext` to manage local SSO credentials extracted from cookies).
- **Libraries:**
  - Styling: Tailwind CSS v4, daisyUI.
  - Interactive Map: Mapbox GL (`mapbox-gl`).
  - Scanning: HTML5 QR code reader (`html5-qrcode`).
  - Drawer panels: Vaul.

---

## 2. Integration Points

- **Authentication:** Relies on cookie SSO. If the user navigates from another VantX subdomain, the `.vantx.app` cookie is already preset and verified by the server.
- **Real-Time Data:** Socket.io client establishes persistent WebSocket links to `crm-api:8000` to stream real-time Teltonika GPS locations.
