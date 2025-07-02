FROM node:20-alpine

# Set working directory to app subfolder
WORKDIR /app/apps/api

# Copy only package files
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install global pnpm
RUN npm install -g pnpm@10.12.4

# Set production mode to skip devDependencies
ENV NODE_ENV=production

# Install dependencies (devDependencies skipped)
RUN pnpm install

# Go back and copy full source
WORKDIR /app
COPY . .

# Build the app
WORKDIR /app/apps/api
RUN pnpm run build

ENV PORT=8080
EXPOSE 8080

CMD ["pnpm", "run", "start:production"]
