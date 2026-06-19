# VantX Development Guide

This guide describes local environment setup, build pipelines, and workspace CLI commands for VantX.

---

## 1. Prerequisites

- **Node.js:** v20+ / npm v11+
- **Database:** PostgreSQL (can be launched via Docker)
- **Tooling:** Turborepo (`npm i -g turbo`)

---

## 2. Environment Configuration

Copy the template environment file to `.env` in the root:
```bash
cp .env.template .env
```
Ensure `DATABASE_URL` is set to point to your local PostgreSQL instance:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vantx_db?schema=public"
```

---

## 3. Workspace CLI Commands

The root uses **Turborepo** to orchestrate workspace tasks. Run commands from the project root:

- **Install Dependencies:**
  ```bash
  npm install
  ```
- **Run Local Dev Servers (All Apps):**
  ```bash
  npm run dev
  ```
- **Build All Components:**
  ```bash
  npm run build
  ```
- **Run Tests:**
  ```bash
  npm run test
  ```
- **Run Code Quality Linting:**
  ```bash
  npm run lint
  ```
- **Run Specific Component Task:**
  To run a command in a specific workspace:
  ```bash
  npm --workspace=@vantx/crm-api run dev
  ```

---

## 4. Prisma Database Commands

Run Prisma commands relative to the `packages/database` directory:

- **Generate Prisma Client:**
  ```bash
  npm --workspace=@vantx/database run prisma:generate
  ```
- **Apply Migrations:**
  ```bash
  npm --workspace=@vantx/database run prisma:migrate:deploy
  ```
