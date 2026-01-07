# headless-session-manager Implementation Plan

This plan details implementing the headless browser session manager using Node.js and Playwright.

## ⚠️ CRITICAL: Runtime Conversion Required

**This project must be converted from Bun to Node.js.**

Playwright is **not compatible with Bun runtime** due to:
- Missing Node.js APIs that Playwright depends on
- Process management incompatibilities
- Known issues: [microsoft/playwright#27139](https://github.com/microsoft/playwright/issues/27139)

### Conversion Steps

1. Delete `bun.lock` (if exists)
2. Replace `package.json` with Node.js version (see below)
3. Create `package-lock.json` via `npm install`
4. Use `npm` commands instead of `bun`
5. Use Express instead of `Bun.serve()`

---

## Overview

The headless-session-manager runs **one headless Chromium browser per chat session**. It:
- Launches browsers with shop-ui loaded in automation mode
- Executes NgRx actions via the `window.__agentBridge`
- Serializes concurrent requests per session
- Manages session lifecycle (create, keep warm, destroy)

## Prerequisites

- Node.js 20+ installed
- shop-ui with automation bridge implemented (see `shop-ui/IMPLEMENTATION_PLAN.md`)
- shop-ui running at `http://localhost:4200`

## Dependencies

Depends on: **shop-ui automation bridge** (Phase 2)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      headless-session-manager                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         Session Store                                  │ │
│  │                                                                        │ │
│  │   Map<sessionId, {                                                     │ │
│  │     browser: Browser,                                                  │ │
│  │     page: Page,                                                        │ │
│  │     queue: AsyncQueue,                                                 │ │
│  │     createdAt: Date                                                    │ │
│  │   }>                                                                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      Express REST API (:3002)                          │ │
│  │                                                                        │ │
│  │   POST   /sessions              → createSession(sessionId)             │ │
│  │   DELETE /sessions/:id          → destroySession(sessionId)            │ │
│  │   POST   /sessions/:id/execute  → executeCommand(sessionId, command)   │ │
│  │   GET    /sessions/:id/state    → getState(sessionId)                  │ │
│  │   GET    /health                → healthCheck()                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    Playwright Browser Pool                             │ │
│  │                                                                        │ │
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │ │
│  │   │   Session: abc   │  │   Session: def   │  │   Session: ghi   │   │ │
│  │   │   ┌──────────┐   │  │   ┌──────────┐   │  │   ┌──────────┐   │   │ │
│  │   │   │ Chromium │   │  │   │ Chromium │   │  │   │ Chromium │   │   │ │
│  │   │   │   Page   │   │  │   │   Page   │   │  │   │   Page   │   │   │ │
│  │   │   │ shop-ui  │   │  │   │ shop-ui  │   │  │   │ shop-ui  │   │   │ │
│  │   │   └──────────┘   │  │   └──────────┘   │  │   └──────────┘   │   │ │
│  │   └──────────────────┘  └──────────────────┘  └──────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 0: Convert to Node.js

**Delete existing Bun files:**
```bash
rm -f bun.lock index.ts
```

**Create new `package.json`:**

```json
{
  "name": "headless-session-manager",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --loader tsx src/index.ts",
    "test": "vitest",
    "playwright:install": "playwright install chromium"
  },
  "dependencies": {
    "express": "^4.21.0",
    "playwright": "^1.48.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

**Create `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Install dependencies:**
```bash
npm install
npm run playwright:install
```

---

### Step 1: Create Type Definitions

**File:** `src/types.ts`

```typescript
import type { Browser, Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  page: Page;
  queue: AsyncQueue;
  createdAt: Date;
  lastActivity: Date;
}

export interface BridgeCommand {
  action: {
    type: string;
    [key: string]: unknown;
  };
  successTypes: string[];
  failureTypes: string[];
  timeout?: number;
}

export interface BridgeResult {
  success: boolean;
  action?: Record<string, unknown>;
  error?: string;
  state?: StoreSnapshot;
}

export interface StoreSnapshot {
  products: {
    items: unknown[];
    loading: boolean;
    error: string | null;
  };
  cart: {
    id: string | null;
    customerId: string | null;
    items: unknown[];
    loading: boolean;
    error: string | null;
  };
}

export interface CreateSessionRequest {
  sessionId: string;
}

export interface ExecuteCommandRequest {
  action: BridgeCommand['action'];
  successTypes: string[];
  failureTypes: string[];
  timeout?: number;
}

// Simple async queue for serializing requests
export class AsyncQueue {
  private queue: Promise<void> = Promise.resolve();

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    let result: T;
    this.queue = this.queue
      .then(async () => {
        result = await fn();
      })
      .catch(() => {}); // Prevent unhandled rejection

    await this.queue;
    return result!;
  }
}
```

---

### Step 2: Create Session Manager

**File:** `src/session-manager.ts`

```typescript
import { chromium, Browser, Page } from 'playwright';
import { BrowserSession, BridgeCommand, BridgeResult, StoreSnapshot, AsyncQueue } from './types.js';

const SHOP_UI_URL = process.env.SHOP_UI_URL || 'http://localhost:4200';
const BRIDGE_READY_TIMEOUT = 30000;
const DEFAULT_COMMAND_TIMEOUT = 10000;

export class SessionManager {
  private sessions = new Map<string, BrowserSession>();

  async createSession(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      console.log(`[SessionManager] Session ${sessionId} already exists, reusing`);
      return;
    }

    console.log(`[SessionManager] Creating session: ${sessionId}`);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Navigate to shop-ui in automation mode
    const url = `${SHOP_UI_URL}?automation=1`;
    console.log(`[SessionManager] Navigating to: ${url}`);
    await page.goto(url);

    // Wait for bridge to be ready
    console.log(`[SessionManager] Waiting for bridge...`);
    await page.waitForFunction(
      () => (window as any).__agentBridge?.isReady() === true,
      { timeout: BRIDGE_READY_TIMEOUT }
    );
    console.log(`[SessionManager] Bridge ready for session: ${sessionId}`);

    const session: BrowserSession = {
      browser,
      page,
      queue: new AsyncQueue(),
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    console.log(`[SessionManager] Destroying session: ${sessionId}`);
    await session.browser.close();
    this.sessions.delete(sessionId);
    return true;
  }

  async executeCommand(sessionId: string, command: BridgeCommand): Promise<BridgeResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: `Session not found: ${sessionId}` };
    }

    // Serialize execution through the queue
    return session.queue.enqueue(async () => {
      session.lastActivity = new Date();
      return this.executeOnPage(session.page, command);
    });
  }

  private async executeOnPage(page: Page, command: BridgeCommand): Promise<BridgeResult> {
    const timeout = command.timeout ?? DEFAULT_COMMAND_TIMEOUT;

    console.log(`[SessionManager] Executing command: ${command.action.type}`);

    try {
      const result = await page.evaluate(
        async ({ action, successTypes, failureTypes, timeout }) => {
          const bridge = (window as any).__agentBridge;
          if (!bridge) {
            return { success: false, error: 'Bridge not available' };
          }
          return bridge.dispatchAndWait(action, successTypes, failureTypes, timeout);
        },
        { ...command, timeout }
      );

      console.log(`[SessionManager] Command result:`, result);
      return result as BridgeResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SessionManager] Command error:`, message);
      return { success: false, error: message };
    }
  }

  async getState(sessionId: string): Promise<StoreSnapshot | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return session.queue.enqueue(async () => {
      session.lastActivity = new Date();
      return session.page.evaluate(() => {
        const bridge = (window as any).__agentBridge;
        return bridge?.getState() ?? null;
      });
    });
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  async destroyAllSessions(): Promise<void> {
    console.log(`[SessionManager] Destroying all ${this.sessions.size} sessions`);
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.destroySession(id)));
  }
}
```

---

### Step 3: Create Express Server

**File:** `src/index.ts`

```typescript
import express from 'express';
import { SessionManager } from './session-manager.js';
import type { CreateSessionRequest, ExecuteCommandRequest } from './types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const sessionManager = new SessionManager();

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessions: sessionManager.getSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

// Create session
app.post('/sessions', async (req, res) => {
  const { sessionId } = req.body as CreateSessionRequest;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    await sessionManager.createSession(sessionId);
    res.status(201).json({ sessionId, status: 'created' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session';
    console.error(`[API] Create session error:`, message);
    res.status(500).json({ error: message });
  }
});

// Destroy session
app.delete('/sessions/:id', async (req, res) => {
  const { id } = req.params;

  const destroyed = await sessionManager.destroySession(id);
  if (destroyed) {
    res.json({ sessionId: id, status: 'destroyed' });
  } else {
    res.status(404).json({ error: `Session not found: ${id}` });
  }
});

// Execute command
app.post('/sessions/:id/execute', async (req, res) => {
  const { id } = req.params;
  const { action, successTypes, failureTypes, timeout } = req.body as ExecuteCommandRequest;

  if (!action || !successTypes || !failureTypes) {
    return res.status(400).json({
      error: 'action, successTypes, and failureTypes are required',
    });
  }

  if (!sessionManager.hasSession(id)) {
    return res.status(404).json({ error: `Session not found: ${id}` });
  }

  try {
    const result = await sessionManager.executeCommand(id, {
      action,
      successTypes,
      failureTypes,
      timeout,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution failed';
    res.status(500).json({ success: false, error: message });
  }
});

// Get state
app.get('/sessions/:id/state', async (req, res) => {
  const { id } = req.params;

  const state = await sessionManager.getState(id);
  if (state === null) {
    return res.status(404).json({ error: `Session not found: ${id}` });
  }

  res.json(state);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await sessionManager.destroyAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Terminating...');
  await sessionManager.destroyAllSessions();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] headless-session-manager running on http://localhost:${PORT}`);
  console.log(`[Server] Endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  POST /sessions`);
  console.log(`  DELETE /sessions/:id`);
  console.log(`  POST /sessions/:id/execute`);
  console.log(`  GET  /sessions/:id/state`);
});
```

---

## File Structure

```
headless-session-manager/
├── src/
│   ├── index.ts           # Express server entry point
│   ├── session-manager.ts # Browser session management
│   └── types.ts           # TypeScript interfaces
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript config
└── IMPLEMENTATION_PLAN.md # This file
```

---

## API Reference

### POST /sessions

Create a new browser session.

**Request:**
```json
{
  "sessionId": "chat-123"
}
```

**Response (201):**
```json
{
  "sessionId": "chat-123",
  "status": "created"
}
```

### DELETE /sessions/:id

Destroy a browser session.

**Response (200):**
```json
{
  "sessionId": "chat-123",
  "status": "destroyed"
}
```

### POST /sessions/:id/execute

Execute an NgRx action via the bridge.

**Request:**
```json
{
  "action": {
    "type": "[Cart] Add Item",
    "sku": "100003",
    "quantity": 1
  },
  "successTypes": ["[Cart] Add Item Success"],
  "failureTypes": ["[Cart] Add Item Failure"],
  "timeout": 10000
}
```

**Response (200):**
```json
{
  "success": true,
  "action": {
    "type": "[Cart] Add Item Success",
    "item": { "sku": "100003", "name": "Hammer", "quantity": 1 }
  },
  "state": { ... }
}
```

### GET /sessions/:id/state

Get current store snapshot.

**Response (200):**
```json
{
  "products": { "items": [...], "loading": false, "error": null },
  "cart": { "id": "cart-1", "items": [...], "loading": false, "error": null }
}
```

### GET /health

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "sessions": 2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Testing

### Manual Testing

```bash
# Start the service
npm run dev

# Create a session
curl -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-123"}'

# Execute add-to-cart
curl -X POST http://localhost:3002/sessions/test-123/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"type": "[Cart] Add Item", "sku": "100003", "quantity": 1},
    "successTypes": ["[Cart] Add Item Success"],
    "failureTypes": ["[Cart] Add Item Failure"]
  }'

# Get state
curl http://localhost:3002/sessions/test-123/state

# Destroy session
curl -X DELETE http://localhost:3002/sessions/test-123
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `SHOP_UI_URL` | `http://localhost:4200` | shop-ui base URL |

---

## Acceptance Criteria

- [ ] Project converted from Bun to Node.js
- [ ] Playwright browsers launch successfully
- [ ] Sessions are created with shop-ui loaded
- [ ] Bridge is detected and ready
- [ ] Commands execute via bridge
- [ ] Commands are serialized per session
- [ ] State snapshots are returned
- [ ] Sessions are properly destroyed
- [ ] Graceful shutdown closes all browsers

---

## Integration Points

### With mcp-tools

The mcp-tools service will:
1. Create a headless session when handling `add_to_cart`
2. Execute bridge commands
3. Return results to chat-ui

### Example mcp-tools Usage

```typescript
// In mcp-tools
const HEADLESS_URL = 'http://localhost:3002';

async function addToCart(sessionId: string, sku: string, quantity: number) {
  // Ensure session exists
  await fetch(`${HEADLESS_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  // Execute add-to-cart
  const response = await fetch(`${HEADLESS_URL}/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: { type: '[Cart] Add Item', sku, quantity },
      successTypes: ['[Cart] Add Item Success'],
      failureTypes: ['[Cart] Add Item Failure'],
    }),
  });

  return response.json();
}
```
