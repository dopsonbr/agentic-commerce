FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Install Playwright browsers (chromium only to save space)
RUN npx playwright install chromium

# Copy source
COPY . .

# Expose port
EXPOSE 3002

# No healthcheck - Playwright startup is slow and session creation is on-demand

# Run
CMD ["npm", "run", "start"]
