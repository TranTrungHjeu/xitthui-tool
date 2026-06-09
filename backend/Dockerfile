FROM node:20-slim

# Set to production
ENV NODE_ENV=production

WORKDIR /app

# Ensure we have a directory for sessions
RUN mkdir -p data && chown node:node data

# Copy package files and install dependencies first (leverages Docker cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application
COPY --chown=node:node . .

# Run as non-privileged user
USER node

EXPOSE 4444

CMD ["npm", "start"]
