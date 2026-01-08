FROM oven/bun:1.2-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Build args for frontend config
ARG VITE_FARO_COLLECTOR_URL=http://localhost:12347/collect
ARG VITE_MCP_TOOLS_URL=http://localhost:3001

ENV VITE_FARO_COLLECTOR_URL=$VITE_FARO_COLLECTOR_URL
ENV VITE_MCP_TOOLS_URL=$VITE_MCP_TOOLS_URL

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q --spider http://localhost:5173 || exit 1

# Run
CMD ["bun", "run", "start"]
