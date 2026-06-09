# Step 1: Base image
FROM node:20-alpine AS base

# Step 2: Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Copy package.json and package-lock.json if available
COPY package*.json ./
# Install Yarn globally and use it to avoid OOM issues in CI/CD runners
RUN npm install -g yarn --force
RUN yarn install --frozen-lockfile || yarn install
# Next.js development requires this in the intermediate target if we use it in compose
EXPOSE 3333

# Step 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1
# Limit RAM usage to prevent Exit handler never called (OOM)
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN yarn build

# Step 4: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

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
ENV PORT 3333
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
