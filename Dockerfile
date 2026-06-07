# syntax=docker/dockerfile:1

# ── Stage 1: build the Angular frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist/dccex-frontend/browser

# ── Stage 2: build the TypeScript backend ────────────────────────────────────
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build
# Output: /app/backend/dist

# ── Stage 3: runtime image ───────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Production dependencies only
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Compiled backend + the Angular build it serves as static files (dist/public)
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist/dccex-frontend/browser ./dist/public

# Runtime data (devices/schedules/settings JSON) lives here; mount a volume
VOLUME ["/app/dist/data"]

EXPOSE 3000
CMD ["node", "dist/server.js"]
