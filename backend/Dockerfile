# Build context: repository root (docker-compose.yml → context: ., dockerfile: backend/Dockerfile)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    FRONTEND_DIR=/app/frontend \
    UPLOADS_DIR=/app/uploads

COPY backend/package.json backend/package-lock.json ./
RUN NODE_OPTIONS=--dns-result-order=ipv4first npm ci --omit=dev --no-audit --no-fund

COPY backend/src ./src
COPY backend/admin ./admin
COPY backend/seed ./seed
# Storefront pages: templates for the server-rendered <head> (SEO)
COPY frontend/*.html ./frontend/

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
