# syntax=docker/dockerfile:1
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine

WORKDIR /app

# Install dependencies for the monorepo
COPY package*.json ./
COPY apps/crm-api/package.json ./apps/crm-api/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/telemetry-ingestor/package.json ./apps/telemetry-ingestor/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/telemetry-parser/package.json ./packages/telemetry-parser/package.json

RUN npm ci

# Copy the source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=./packages/database/prisma/schema

EXPOSE 8000

# Run migrations + start dev server (NestJS API watch mode)
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./packages/database/prisma/schema && npm run dev --workspace=@vantx/crm-api"]
