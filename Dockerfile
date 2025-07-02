FROM node:20-alpine

# Set working directory to app subfolder
WORKDIR /app/apps/api

# Copy only package.json and lockfile for caching install
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install pnpm globally (and match local version)
RUN npm install -g pnpm@10.12.4

# Install dependencies inside the right folder
RUN pnpm install

# Go back and copy full source code
WORKDIR /app
COPY . .

# Build your app
WORKDIR /app/apps/api
RUN pnpm run build

ENV PORT=3002
EXPOSE 3002

CMD ["pnpm", "run", "start:production"]
