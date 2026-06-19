# Marketplace API Contracts (marketplace-api)

The Marketplace API exposes endpoints for matching drivers to vehicle listings and managing driver-owner messaging and escrow agreements.

---

## 1. Matching & Listings Endpoints

- **GET `/listings`**
  - **Returns:** Active driver matching offers.
- **POST `/listings`**
  - **Payload:** `{ title, description, price, vehicleId }`
- **POST `/matches`**
  - **Payload:** `{ listingId, driverId }`
  - **Returns:** Created matchmaking request.
- **PATCH `/matches/:id/accept`**
  - **Returns:** Confirmed status.
- **PATCH `/matches/:id/reject`**
  - **Returns:** Rejected status.
