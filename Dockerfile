# Cloud Run image. Build and deploy: see "Deploy on Google Cloud" in README.md
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/bale2brick.db TRUST_PROXY=1
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 8080
CMD ["node", "--no-warnings", "server.js"]
