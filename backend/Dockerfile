FROM node:20-slim

# Set to production
ENV NODE_ENV=production

WORKDIR /app

# Ensure we have a directory for sessions
RUN mkdir -p data && chown node:node data

# Copy dependency manifests first for better Docker caching
COPY --chown=node:node package.json package-lock.json ./

# Update npm to avoid 'Exit handler never called' bug, then install dependencies
RUN npm install -g npm@latest && \
    npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy the rest of the application source
COPY --chown=node:node . .

# Run as non-privileged user
USER node

EXPOSE 4444

CMD ["node", "src/index.js"]
