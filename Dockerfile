# Use Node 20 base image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Install global dependencies
RUN npm install -g pnpm

# Copy only the package files first to leverage Docker cache
COPY apps/api/package.json apps/api/pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the full backend source code
COPY apps/api ./apps/api

# Build the backend (runs tsc compiler)
RUN pnpm --filter firecrawl-scraper-js build

# Expose port Firecrawl listens on
ENV PORT=3002
EXPOSE 3002

# Start the backend in production mode (compile + run)
CMD ["pnpm", "--filter", "firecrawl-scraper-js", "start:production"]
