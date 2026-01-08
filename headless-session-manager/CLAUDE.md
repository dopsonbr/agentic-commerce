# headless-session-manager

This service requires **Node.js runtime** (Playwright is incompatible with Bun).

## Package Manager: pnpm

- Use `pnpm install` to install dependencies
- Use `pnpm run <script>` to run scripts
- Use `pnpm exec playwright install chromium` to install browser binaries

## Commands

```bash
pnpm run dev              # Start dev server with hot reload (port 3002)
pnpm run start            # Start production server
pnpm test                 # Run tests with Vitest
pnpm run playwright:install  # Install Chromium for Playwright
```

## Stack

- **Runtime:** Node.js (required for Playwright compatibility)
- **Browser Automation:** Playwright
- **HTTP Server:** Express
- **Port:** 3002

## Key Files

- `src/index.ts` - Express HTTP server entry point
- `src/session-manager.ts` - Playwright session lifecycle management
- `src/types.ts` - TypeScript interfaces
