FROM node:20-alpine

WORKDIR /app

# Copy only package files first for efficient caching
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install specific pnpm version matching your local (pinning to 10.12.4 here)
RUN npm install -g pnpm@10.12.4

# Install dependencies using frozen lockfile (lockfile must match pnpm version)
RUN pnpm install --frozen-lockfile

# Copy rest of the source code
COPY . .

# Build backend inside apps/api
WORKDIR /app/apps/api
RUN pnpm run build

ENV PORT=3002
EXPOSE 3002

CMD ["pnpm", "run", "start:production"]
