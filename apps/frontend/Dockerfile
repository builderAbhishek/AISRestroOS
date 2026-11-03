FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy dependency manifests
COPY package.json ./

# Install npm dependencies
RUN npm install

# Copy application sources
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173 || exit 1

# Start Vite server with host bound to all network interfaces for container access
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
