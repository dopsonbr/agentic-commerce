FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install pnpm via npm (corepack has signature issues with @latest)
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (tsx needed for TypeScript execution)
RUN pnpm install --frozen-lockfile

# Install Playwright browsers (chromium only to save space)
RUN pnpm exec playwright install chromium

# Copy source
COPY . .

# Expose port
EXPOSE 3002

# No healthcheck - Playwright startup is slow and session creation is on-demand

# Run
CMD ["pnpm", "run", "start"]
