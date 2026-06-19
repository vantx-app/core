# Marketplace API Architecture (marketplace-api)

The Marketplace API is a NestJS application managing listing contracts and matching driver profiles to fleets.

---

## 1. System Design

- **Architecture:** Standard NestJS controllers and services structure.
- **Dependencies:** Imports the `@vantx/database` shared client package for database writes, and `@vantx/auth` for cookie validation.
- **Scope:** Manages listing matching negotiations, message routes, and escrow triggers.
