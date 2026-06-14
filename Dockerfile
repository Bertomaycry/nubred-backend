# Stage 1: Dependencies and Build
FROM node:20 AS builder
WORKDIR /app

# Write npmrc before install so retries are guaranteed active
RUN echo "fetch-retries=5" >> /root/.npmrc \
    && echo "fetch-retry-mintimeout=20000" >> /root/.npmrc \
    && echo "fetch-retry-maxtimeout=120000" >> /root/.npmrc \
    && echo "fetch-timeout=300000" >> /root/.npmrc

COPY package*.json ./
COPY prisma ./prisma/

# Cap Node heap to prevent OOM kill during install
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Use BuildKit cache mount to avoid re-downloading packages on every build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
    || (cat /root/.npm/_logs/*.log 2>/dev/null && exit 1)

RUN npx prisma generate

# Stage 2: Production Runtime
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pm2

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY src ./src
COPY ecosystem.config.cjs ./

EXPOSE 8080

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]