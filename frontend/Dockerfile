# Step 1: Base image
FROM node:20-slim AS base

# Corepack needs to be enabled for modern yarn/pnpm usage, but npm install -g yarn is safer for slim
RUN npm install -g yarn --force

# Step 2: Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./

# Use yarn instead of npm to prevent OOM (Out Of Memory) crashes on Gitlab Runners free tier
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN yarn install --network-timeout 1000000

# Next.js development requires this in the intermediate target if we use it in compose
EXPOSE 3333

# Step 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dynamic API URL from build arguments
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Limit RAM during build to avoid OOM crash
ENV NODE_OPTIONS="--max-old-space-size=1536"
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

# Step 4: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3333
ENV PORT=3333
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
