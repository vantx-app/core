# CRM API Architecture (crm-api)

The CRM API is the core NestJS backend application that serves fleet administration, driver telemetry stats, scoring profiles, and auth.

---

## 1. System Design

The application follows standard NestJS layered architecture:

```
[ HTTP Requests ] -> [ Controllers ] -> [ Services ] -> [ @vantx/database ] -> [ PostgreSQL ]
                           |
                     [ AuthGuards ]
```

- **Controllers:** Expose endpoints under `/auth`, `/vehicles`, `/drivers`, `/assignments`, etc.
- **Services:** Execute validation, invoke AWS services (S3/Textract), and read/write to database.
- **Guards:** `JwtAuthGuard` and `RolesGuard` manage role-based endpoint permissions.

---

## 2. Key Integration Modules

- **Auth Module:** Uses `@nestjs/passport` and JWT. Sets HTTP cookie session tokens.
- **Telemetry Module:** Exposes WebSockets via Socket.io custom adapters to communicate live vehicle coordinates to dashboard users.
- **Billing Module:** Integrated with Stripe payments.
- **AWS Integration:** Uses `@aws-sdk/client-s3` and `@aws-sdk/client-textract` to automate driver license/document uploads and validation processing.
