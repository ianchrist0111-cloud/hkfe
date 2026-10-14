# ============================================================
# HKFES All-in-One Production Dockerfile
# Single container hosting Frontend (React PWA), Backend (Express REST),
# and WebSocket Live Price Stream (/ws/prices) on Port 4000.
# Optimized for free cloud hosting (Northflank, Render, Koyeb, Docker).
# ============================================================

# ── Stage 1: Build React Frontend ───────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Backend & Pre-Seed Database ──────────────
FROM node:20-slim AS backend-builder
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --legacy-peer-deps

COPY backend/ ./
RUN npx prisma generate
RUN npx prisma db push --skip-generate
RUN npx ts-node prisma/seed.ts || true
RUN npm run build

# ── Stage 3: Minimal Production Runner ───────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV JWT_SECRET="hkfes-production-jwt-master-key-secure-2026-v1-supersecret"
ENV JWT_REFRESH_SECRET="hkfes-production-jwt-refresh-master-key-secure-2026-v1-supersecret"
ENV CORS_ORIGIN="*"

# Install production dependencies only
COPY backend/package.json ./package.json
COPY backend/package-lock.json ./package-lock.json
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled backend output
COPY --from=backend-builder /app/backend/dist ./dist

# Copy Prisma schema, generated client, and pre-seeded database
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma

# Copy compiled frontend dist into public-web folder
COPY --from=frontend-builder /app/frontend/dist ./public-web

# Expose unified application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

# Launch full-stack platform
CMD ["node", "dist/src/index.js"]
