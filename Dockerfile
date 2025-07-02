FROM node:18-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy only package files needed for install
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install dependencies only for api
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api

# Build api project (adjust build script if needed)
RUN pnpm --filter @firecrawl/api build

# Expose port 3002
EXPOSE 3002

# Start the api in production mode
CMD ["pnpm", "--filter", "@firecrawl/api", "start:production"]
