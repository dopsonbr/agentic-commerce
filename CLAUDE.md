# CLAUDE.md

This file provides guidance to Claude Code when working with this monorepo.

## Project Overview

Agentic Commerce is a local-first POC demonstrating "agentic shopping" where a chat experience drives shopping workflows. The system reuses existing SPA orchestration (NgRx) via headless browser sessions to produce auditable, trustworthy tool outputs.

## Monorepo Structure

```
agentic-commerce/
├── shop-ui/                  # Angular 21 SPA with NgRx (npm)
├── shop-api/                 # REST API for products/cart (Bun)
├── chat-ui/                  # Chat interface (Bun + React)
├── mcp-tools/                # MCP tool server (Bun)
├── headless-session-manager/ # Headless Chromium session manager (Node.js + Playwright)
├── IMPLEMENTATION_PLAN.md    # Phased implementation roadmap with subplans
└── README.md                 # Project overview and architecture diagrams
```

## Apps

### shop-ui (Angular + NgRx) - COMPLETE
- **Port:** 4200
- **Package Manager:** npm
- **Commands:** `npm start`, `npm run build`, `npm test`
- **Status:** ✅ Complete - automation bridge implemented
- **POC Addition:** `window.__agentBridge` for programmatic control via `?automation=1`
- **Automation Files:** `src/app/automation/` (types.ts, automation.service.ts, action-mappings.ts)

### shop-api (Bun) - EXISTING
- **Port:** 3000
- **Commands:** `bun run dev`, `bun run start`, `bun test`
- **Status:** Working - products and cart API functional
- **Endpoints:** `/api/products`, `/api/products/:sku`, `/api/cart/:id`

### chat-ui (Bun + React) - STUB
- **Port:** 5173
- **Commands:** `bun run dev`, `bun run start`
- **Status:** Scaffold only - needs implementation
- **Purpose:** Chat interface with scripted agent mode

### mcp-tools (Bun) - COMPLETE
- **Port:** 3001
- **Commands:** `bun run dev`
- **Status:** ✅ Complete - MCP tool server implemented
- **Dependencies:** `zod`
- **Tools:** `search_products`, `get_product_details`, `get_cart`, `add_to_cart`, `set_customer_id`
- **Endpoints:** `/health`, `/tools`, `/tools/:name/call`, `/sessions`

### headless-session-manager (Node.js + Playwright) - COMPLETE
- **Port:** 3002
- **Commands:** `npm run dev`
- **Status:** ✅ Complete - session manager with Playwright
- **Runtime:** Node.js (Playwright incompatible with Bun)
- **Dependencies:** `playwright`, `express`, `cors`
- **Endpoints:** `/health`, `/sessions`, `/sessions/:id/execute`, `/sessions/:id/state`

## Local Development

### Startup Order
```bash
# Terminal 1: Start shop-api
cd shop-api && bun run dev

# Terminal 2: Start shop-ui
cd shop-ui && npm start

# Terminal 3: Start headless-session-manager (Node.js!)
cd headless-session-manager && npm run dev

# Terminal 4: Start mcp-tools
cd mcp-tools && bun run dev

# Terminal 5: Start chat-ui
cd chat-ui && bun run dev
```

### Port Summary
| App | Port | Runtime |
|-----|------|---------|
| shop-api | 3000 | Bun |
| mcp-tools | 3001 | Bun |
| headless-session-manager | 3002 | Node.js |
| shop-ui | 4200 | npm/ng |
| chat-ui | 5173 | Bun |

## Technology Guidelines

### Bun Apps (shop-api, chat-ui, mcp-tools)
- Use `bun` instead of `node`
- Use `bun install` instead of `npm install`
- Use `bun test` for testing
- Use `Bun.serve()` for HTTP servers (not Express)
- Bun auto-loads `.env` files

### Node.js App (headless-session-manager)
- Use `npm` for package management
- Use Express or native http for server
- Required because Playwright is incompatible with Bun

### Angular App (shop-ui)
- Angular 21 with standalone components
- NgRx Store + Effects for state management
- Vitest for testing (not Karma/Jasmine)
- Signals for component state
- `ChangeDetection.OnPush` required

## Key Concepts

### Automation Bridge (shop-ui) - IMPLEMENTED
When `?automation=1` is set, shop-ui exposes `window.__agentBridge`:
```typescript
interface AgentBridge {
  isReady(): boolean;
  getState(): StoreSnapshot;  // Returns { products: ProductsState, cart: CartState }
  dispatchAndWait(
    action: Action,
    successTypes: string[],
    failureTypes: string[],
    timeoutMs?: number  // default: 10000
  ): Promise<BridgeResult>;
}

interface BridgeResult {
  success: boolean;
  action?: Action;      // The action that resolved the operation
  error?: string;       // Error message if failed
  state?: StoreSnapshot; // State after operation
}
```

**Usage from Playwright:**
```typescript
await page.goto('http://localhost:4200?automation=1');
await page.waitForFunction(() => window.__agentBridge?.isReady());
const result = await page.evaluate(() =>
  window.__agentBridge!.dispatchAndWait(
    { type: '[Cart] Add Item', sku: '100003', quantity: 1 },
    ['[Cart] Add Item Success'],
    ['[Cart] Add Item Failure']
  )
);
```

**Action mappings:** See `shop-ui/src/app/automation/action-mappings.ts` for all supported actions.

### MCP Tools
Tools follow the Model Context Protocol:
- `search_products` - Stateless, routes to shop-api
- `get_product_details` - Stateless, routes to shop-api
- `add_to_cart` - Stateful, routes via headless-session-manager
- `get_cart` - Stateless, routes to shop-api
- `set_customer_id` - Session state, local to mcp-tools

### Scripted Agent Mode (chat-ui)
Pattern matching for deterministic tool invocation:
- `customer id is X` → `set_customer_id`
- `show/find/search X` → `search_products`
- `add X to cart` → `add_to_cart`
- `what's in my cart` → `get_cart`

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Local scaffold + repo layout | ✅ Complete |
| 1 | Tool contracts + event model | ✅ Complete (merged into Phase 4) |
| 2 | shop-ui automation bridge | ✅ Complete |
| 3 | Headless session manager | ✅ Complete |
| 4 | MCP tools server | ✅ Complete |
| 5 | Chat UI | Pending |
| 6 | Integration + demo hardening | Pending |

## Detailed Implementation Plans

Each app has its own detailed, self-contained implementation plan:

| App | Implementation Plan | Status |
|-----|---------------------|--------|
| shop-ui | `shop-ui/IMPLEMENTATION_PLAN.md` | ✅ Complete |
| headless-session-manager | `headless-session-manager/IMPLEMENTATION_PLAN.md` | ✅ Complete (converted to Node.js) |
| mcp-tools | `mcp-tools/IMPLEMENTATION_PLAN.md` | ✅ Complete |
| chat-ui | `chat-ui/IMPLEMENTATION_PLAN.md` | Pending |

See `IMPLEMENTATION_PLAN.md` for the overall roadmap, dependency graph, and architecture diagrams.

---

## Development Patterns (from Retros)

### Cross-Service Communication
- All Express servers must include `cors` middleware for cross-origin requests
- Services communicate across different ports (mcp-tools:3001 → headless-session-manager:3002)
- Always add CORS when implementing new Express servers in this project

```typescript
import cors from 'cors';
app.use(cors());
```

### Resource Management
- Browser sessions and other resources must be cleaned up on failure
- Use try/catch/finally pattern for resource lifecycle:

```typescript
let browser: Browser | null = null;
try {
  browser = await chromium.launch();
  // use browser
} catch (error) {
  if (browser) await browser.close();
  throw error;
} finally {
  // cleanup pending state
}
```

- Implement idle timeouts for long-running resources (default: 30min)
- Use cleanup intervals to prevent memory leaks

### Concurrent Operation Guards
- For operations that shouldn't run concurrently for the same ID:

```typescript
private pending = new Set<string>();

async createSession(id: string) {
  if (this.pending.has(id)) {
    // Wait or throw
  }
  this.pending.add(id);
  try {
    // operation
  } finally {
    this.pending.delete(id);
  }
}
```

### Playwright Best Practices
- Always use `waitUntil: 'networkidle'` with `page.goto()` for SPAs
- Wait for bridge/app readiness before interacting:

```typescript
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__agentBridge?.isReady());
```

### State Propagation Across Services
- When setting state that affects multiple services, propagate to all:
  - mcp-tools local sessionStore
  - headless-session-manager (if session exists)
  - shop-ui NgRx store (via bridge action dispatch)
- Trace the full data flow before implementing stateful operations
- Example: `set_customer_id` must update both mcp-tools sessionStore AND dispatch `[Cart] Set Customer ID` to headless

### Session Recovery
- Headless sessions may timeout or be destroyed externally (30min idle timeout)
- Implement retry with session recreation on 404 errors
- Always propagate dependent state (customerId) when recreating sessions

```typescript
// Pattern: retry with session recovery
if (executeResponse.status === 404) {
  await createHeadlessSession(sessionId);
  if (context.customerId) {
    await setCustomerIdInHeadless(sessionId, context.customerId);
  }
  // Retry the original operation
}
```

### Implementation Plan Validation
- **Before implementing**, validate plan assumptions against actual API contracts:
  - Check required vs optional parameters
  - Verify response shapes match expectations
  - Test error codes and edge cases
- Example: mcp-tools plan assumed `customerId` was optional for `get_cart`, but shop-api requires it
- Read dependency source code when plan references external APIs

### Data Flow Tracing
- For stateful operations, trace the complete data flow before implementing:
  ```
  set_customer_id flow:
    1. mcp-tools receives call
    2. Update local sessionStore ✓
    3. If headless session exists:
       → Dispatch [Cart] Set Customer ID to shop-ui NgRx store ✓
    4. On next add_to_cart:
       → cart.effects reads selectCustomerId
       → Creates cart with correct customer (not 'guest')
  ```
- Document which systems need updates for each stateful operation
- Consider downstream effects (NgRx selectors, effects, API calls)

### Testing Patterns
- Write unit tests with fetch mocking for HTTP handlers
- Test error paths and edge cases, not just happy paths
- For session-based handlers, test:
  - Session creation
  - Session recovery (404 → recreate)
  - State propagation on session create/recover
- Run `bun test` in mcp-tools before committing
