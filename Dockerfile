FROM node:20-alpine

# Global setup
WORKDIR /app
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
RUN npm install -g pnpm@10.12.4

# Set working directory to actual app location
WORKDIR /app/apps/api

# Install dependencies in the correct context
RUN pnpm install

# Copy all source code AFTER install to cache dependencies
WORKDIR /app
COPY . .

# Back to app dir for build
WORKDIR /app/apps/api
RUN pnpm run build

ENV PORT=3002
EXPOSE 3002

CMD ["pnpm", "run", "start:production"]
