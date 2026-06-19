# CRM API Contracts (crm-api)

The CRM API runs on port 8000 and exposes RESTful endpoints for fleet owners, drivers, and administrators.

---

## 1. Authentication Endpoints (/auth)

- **POST `/auth/login`**
  - **Payload:** `{ email, password }`
  - **Returns:** User object. Issues HttpOnly JWT cookie under `.vantx.app` domain.
- **POST `/auth/logout`**
  - **Returns:** Success status. Clears session cookie.
- **POST `/auth/refresh`**
  - **Returns:** Refreshed session.

---

## 2. Vehicles Endpoints (/vehicles)

- **GET `/vehicles`**
  - **Query Parameters:** `isListed=true/false` (filter market lists)
  - **Returns:** Array of vehicle records.
- **POST `/vehicles`**
  - **Payload:** `{ plateNumber, orgId, imei, deviceModel }`
- **GET `/vehicles/:id`**
- **PATCH `/vehicles/:id`**
- **DELETE `/vehicles/:id`**

---

## 3. Drivers Endpoints (/drivers)

- **GET `/drivers`**
  - **Returns:** Registered drivers and their stats.
- **POST `/drivers`**
  - **Payload:** `{ nationalId, firstName, lastName, phone }`
- **GET `/drivers/:id`**

---

## 4. Assignments Endpoints (/assignments)

- **POST `/assignments`**
  - **Payload:** `{ driverId, vehicleId }`
  - **Returns:** Active operator link.
- **DELETE `/assignments/:id`**
  - **Returns:** Ends operator active session.

---

## 5. Driver Documents (/driver-documents)

- **POST `/driver-documents/presigned-url`**
  - **Returns:** AWS S3 presigned upload URL for license/ID files.
- **POST `/driver-documents/verify`**
  - **Payload:** `{ s3ObjectKey }`
  - **Returns:** Success / Pending manual review based on OCR/QR extraction.
