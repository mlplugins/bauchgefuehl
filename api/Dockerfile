FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src

# Datenbank liegt im Volume /data und gehört dem unprivilegierten Benutzer «node»
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/bauchgefuehl.db

USER node
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
