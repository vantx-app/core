# Marketplace Architecture (marketplace)

The Marketplace is a Next.js App Router application designed for matching drivers to vehicle listing contracts.

---

## 1. System Design

- **App Router Layout:**
  - `drivers/` routes: Search vehicle listings, review driver profiles, and submit matchmaking contracts.
- **Styling:**
  - Built with Tailwind CSS v4 and daisyUI component primitives.
- **Client Libraries:**
  - Uses Axios for communication.
  - Handled via React Hook Form for matchmaking applications.

---

## 2. API Integration

- **Authentication:** Validated via the shared SSO cookie mechanism.
- **Data Flow:** Requests for listing indexes or matching state query `/listings` and `/matches` on backend APIs.
- **Sockets:** Connects to WebSocket streams for chat notifications during negotiations.
