# === STAGE 1: Prune ===
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune --scope=@vantx/marketplace --docker

# === STAGE 2: Build ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm install
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

ARG NEXT_PUBLIC_DASHBOARD_URL
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL

ARG NEXT_PUBLIC_LANDING_URL
ENV NEXT_PUBLIC_LANDING_URL=$NEXT_PUBLIC_LANDING_URL

RUN npm run build -- --filter=@vantx/marketplace

# === STAGE 3: Runner ===
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build and static assets
COPY --from=builder /app/apps/marketplace/public ./apps/marketplace/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/marketplace/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/marketplace/.next/static ./apps/marketplace/.next/static

USER nextjs

EXPOSE 3002
ENV PORT=3002

CMD ["node", "apps/marketplace/server.js"]
