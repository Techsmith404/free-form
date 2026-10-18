# Multi-stage Dockerfile for Free Form

# --- Stage 1: Build Frontend and Backend ---
FROM node:22-slim AS builder
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY server ./server
COPY client ./client

# Build shared, client and server
RUN npm run build:shared
RUN npm run build:client
RUN npm run build:server

# --- Stage 2: Production Runner ---
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_DIR=/data
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install system dependencies: tini for PID 1 signal handling, curl for healthcheck, and chromium for PDF export
RUN apt-get update && \
    apt-get install -y --no-install-recommends tini curl chromium fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Create persistent data directory volume and ensure node user owns /data and /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
VOLUME ["/data"]

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/index.js"]
