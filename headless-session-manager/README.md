# headless-session-manager

Service managing headless Chromium sessions for stateful browser automation.

## Overview

This service runs **one headless Playwright browser per chat session** and executes NgRx actions via the shop-ui automation bridge. It enables stateful shopping operations (like add-to-cart) that require browser context.

## Stack

- **Runtime:** Node.js (required for Playwright compatibility)
- **Browser Automation:** Playwright
- **HTTP Server:** Express or native Node http
- **Port:** 3002

> **Important:** Playwright is not compatible with Bun runtime. This service must run on Node.js.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sessions` | POST | Create new session |
| `/sessions/:id` | DELETE | Destroy session |
| `/sessions/:id/execute` | POST | Execute bridge command |
| `/sessions/:id/state` | GET | Get store snapshot |

## Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Start development server
npm run dev

# Run tests
npm test
```

## Configuration

Environment variables:
```bash
PORT=3002
SHOP_UI_URL=http://localhost:4200
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              headless-session-manager                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                   Session Store                        │ │
│  │   Map<sessionId, { browser, page, queue }>            │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                   REST API                             │ │
│  │  POST /sessions        → Create session                │ │
│  │  POST /sessions/:id/execute → Execute command          │ │
│  │  GET  /sessions/:id/state   → Get state snapshot       │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │             Playwright Browser Pool                    │ │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐              │ │
│  │   │Session 1│  │Session 2│  │Session 3│              │ │
│  │   │ Browser │  │ Browser │  │ Browser │              │ │
│  │   │  Page   │  │  Page   │  │  Page   │              │ │
│  │   └─────────┘  └─────────┘  └─────────┘              │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Bridge Command Format

```typescript
interface BridgeCommand {
  action: {
    type: string;       // NgRx action type
    payload?: unknown;  // Action payload
  };
  successTypes: string[];  // Actions indicating success
  failureTypes: string[];  // Actions indicating failure
  timeout?: number;        // Timeout in ms (default: 10000)
}

interface BridgeResult {
  success: boolean;
  action?: Action;    // The resulting action
  error?: string;     // Error message if failed
  state?: StoreState; // Store snapshot after action
}
```

## Example Usage

```bash
# Create a session
curl -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "chat-123"}'

# Execute add-to-cart
curl -X POST http://localhost:3002/sessions/chat-123/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "type": "[Cart] Add Item",
      "payload": { "sku": "100003", "quantity": 1 }
    },
    "successTypes": ["[Cart] Add Item Success"],
    "failureTypes": ["[Cart] Add Item Failure"]
  }'

# Get state snapshot
curl http://localhost:3002/sessions/chat-123/state
```

## File Structure (Target)

```
headless-session-manager/
├── src/
│   ├── index.ts              # Entry point + HTTP server
│   ├── session-manager.ts    # Session lifecycle management
│   ├── bridge-executor.ts    # Playwright bridge commands
│   └── types.ts              # TypeScript interfaces
├── package.json
└── tsconfig.json
```

## Dependencies

```json
{
  "playwright": "^1.40.0",
  "express": "^4.18.0"
}
```

## Session Lifecycle

1. **Create:** Launch Chromium, navigate to `shop-ui?automation=1`
2. **Ready:** Wait for `window.__agentBridge.isReady()`
3. **Execute:** Process commands via bridge
4. **Destroy:** Close browser, clean up resources

Sessions are kept warm between commands for faster execution.
