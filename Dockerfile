FROM node:20-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy root pnpm files (pnpm-lock.yaml, package.json, pnpm-workspace.yaml if exists)
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml* ./

# Install all dependencies including devDependencies for entire workspace
RUN pnpm install --frozen-lockfile --include-dev

# Copy full source code
COPY . .

# Build the backend directly inside its folder
WORKDIR /app/apps/api
RUN pnpm run build

# Expose backend port
ENV PORT=3002
EXPOSE 3002

# Start backend
CMD ["pnpm", "run", "start:production"]
