FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN NODE_OPTIONS=--dns-result-order=ipv4first npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY admin ./admin
COPY seed ./seed

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
