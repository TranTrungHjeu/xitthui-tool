FROM node:20-alpine

# Set to production
ENV NODE_ENV production

WORKDIR /app

# Ensure we have a directory for sessions
RUN mkdir -p data && chown node:node data

COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production

COPY --chown=node:node . .

# Run as non-privileged user
USER node

EXPOSE 4444

CMD ["npm", "start"]
