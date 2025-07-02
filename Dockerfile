FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install pnpm (your local version)
RUN npm install -g pnpm@10.12.4

# Install dependencies, including devDependencies
RUN pnpm install --config.lockfile=true --config.lockfileOnly=false

# Copy the rest of the code
COPY . .

# Build backend
WORKDIR /app/apps/api
RUN pnpm run build

ENV PORT=3002
EXPOSE 3002

CMD ["pnpm", "run", "start:production"]
