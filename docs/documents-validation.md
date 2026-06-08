# Role & Goal

You are an expert backend engineer and software architect. Your goal is to implement a lightweight, efficient, and event-driven document validation pipeline using AWS S3, Node.js/TypeScript, and Prisma ORM. The system must maximize automation (OCR/QR) and minimize manual review without bottlenecking the application server.

---

# Architecture & Data Flow

### 1. Document Upload (Direct-to-S3)

- The client requests an upload link from the backend.
- The backend generates an AWS S3 Presigned URL with strict parameters:
  - Short expiration window (e.g., 10 minutes).
  - Strict `Content-Type` validation (allowing only specific images/PDFs).
  - Destination path prefix: `documents/pending/[userId]/`.
- The client uploads the file directly to S3.

### 2. Processing & Validation (Asynchronous)

- Once the upload completes, the file is processed asynchronously (either via a backend queue or an S3 Event Notification triggering a worker).
- The validation worker attempts to extract data using standard QR code decoding or a cloud OCR service (like AWS Textract).

### 3. Business Logic & Lifecycles

- **Scenario A: Validation SUCCESS**
  - Immediately create/update the database record with `status: "APPROVED"`.
  - Extract and store relevant metadata in the database row.
  - **File Lifecycle:** To ensure privacy and save costs, immediately delete the file from S3 (or move it to a 14-day temporary retention lifecycle bucket).

- **Scenario B: Validation FAILURE (Fallback)**
  - Create/update the database record with `status: "PENDING_MANUAL_REVIEW"`.
  - Store the S3 object URL in the record so an administrator can review it.
  - Trigger an alert or flag the record for a manual review dashboard.

---

# Technical Requirements & Stack

- **Language:** TypeScript
- **Database Access:** Prisma ORM with a PostgreSQL database.
- **Storage SDK:** `@aws-sdk/client-s3` (AWS SDK v3).
- **Validation Tools:** Suggest standard node-compatible packages for lightweight QR reading, or integrated cloud OCR services (like AWS Textract) to extract data.

---

# Tasks to Complete

1. Define a Prisma schema model (e.g., `DocumentValidation`) that tracks `id`, `userId`, `status` (Enum: APPROVED, PENDING_MANUAL_REVIEW), `fileUrl` (nullable), `extractedData` (JSONB), and timestamps.
2. Write the service function to generate secure S3 presigned URLs.
3. Write the core verification worker function that processes the S3 object, runs the validation logic, and updates the database according to the success/failure lifecycle rules outlined above.
