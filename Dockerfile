# ---- Stage 1: build the React client ----
FROM node:24-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: install server production deps ----
FROM node:24-alpine AS deps
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 3: runtime ----
FROM node:24-alpine
ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/talentflow.db
ENV UPLOADS_DIR=/app/data/uploads
WORKDIR /app

COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

ENV VOLUME_DIR=/app/data
VOLUME ["/app/data"]

CMD ["node", "server/src/index.js"]