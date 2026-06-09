FROM node:20-slim

# Set to production
ENV NODE_ENV production

WORKDIR /app

# Ensure we have a directory for sessions
RUN mkdir -p data && chown node:node data

COPY package*.json ./
# Install only production dependencies (using install instead of ci to avoid ENOLOCK error if package-lock is missing)
RUN npm install --omit=dev

COPY --chown=node:node . .

# Run as non-privileged user
USER node

EXPOSE 4444

CMD ["npm", "start"]
