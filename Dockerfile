FROM node:20-alpine

# Set working directory to app subfolder
WORKDIR /app/apps/api

# Copy only package files to install dependencies
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./

# Install global pnpm
RUN npm install -g pnpm@10.12.4

# Set production mode to skip devDependencies
ENV NODE_ENV=production

# Install production dependencies
RUN pnpm install

# Go back and copy full source code
WORKDIR /app
COPY . .

# Set back to API app dir
WORKDIR /app/apps/api

# Build the app (TypeScript -> JavaScript in /dist/src)
RUN pnpm run build

# Expose the desired port
ENV PORT=8080
EXPOSE 8080

# Start the app using the production script
CMD ["pnpm", "run", "start:production"]
