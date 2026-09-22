# Multi-stage Dockerfile for Free Form

# --- Stage 1: Build Frontend and Backend ---
FROM node:22-slim AS builder
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

# Copy source files
COPY server ./server
COPY client ./client

# Build client and server
RUN npm run build:client
RUN npm run build:server

# --- Stage 2: Production Runner ---
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

# Install production dependencies only
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Create persistent data directory volume
RUN mkdir -p /data/uploads
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
