# Multi-stage Dockerfile for Crypton production container
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# Production runner image
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets and server backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Expose server port
EXPOSE 3001

# Run backend server
CMD ["node", "server/index.js"]
