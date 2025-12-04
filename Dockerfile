# Use Debian-based image for easier Typst installation
FROM node:20-bullseye-slim

# Install system dependencies and Typst
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Typst
RUN wget https://github.com/typst/typst/releases/download/v0.12.0/typst-x86_64-unknown-linux-musl.tar.xz \
    && tar -xf typst-x86_64-unknown-linux-musl.tar.xz \
    && mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/ \
    && rm -rf typst-x86_64-unknown-linux-musl* \
    && chmod +x /usr/local/bin/typst

# Verify Typst installation
RUN typst --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with Bun (fallback to npm if needed)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create temp directory for Typst compilation
RUN mkdir -p /app/temp

# Expose health check port (optional)
EXPOSE 3001

# Run the worker
CMD ["node", "dist/index.js"]
