# Use official Node.js image
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy the API source code
COPY apps/api ./apps/api

# Build the API
RUN pnpm --filter @firecrawl/api build

# Expose port
EXPOSE 3002

# Run the API server (or run workers as needed)
CMD ["pnpm", "--filter", "@firecrawl/api", "start:production"]
