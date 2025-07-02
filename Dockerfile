FROM node:20-alpine

WORKDIR /app

# Copy package files first
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml* ./

# Install pnpm locally
RUN npm install pnpm@latest

# Install all dependencies including devDependencies
RUN npx pnpm install --frozen-lockfile --include-dev

# Copy all source code
COPY . .

# Build the backend inside apps/api
WORKDIR /app/apps/api
RUN npx pnpm run build

ENV PORT=3002
EXPOSE 3002

CMD ["npx", "pnpm", "run", "start:production"]
