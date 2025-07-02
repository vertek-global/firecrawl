FROM node:20-alpine

WORKDIR /app

# Copy package files from the actual location
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install pnpm locally
RUN npm install pnpm@latest

# Install dependencies including devDependencies
RUN npx pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Build backend inside apps/api
WORKDIR /app/apps/api
RUN npx pnpm run build

ENV PORT=3002
EXPOSE 3002

CMD ["npx", "pnpm", "run", "start:production"]
