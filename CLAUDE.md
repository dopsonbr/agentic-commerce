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

### shop-ui (Angular + NgRx) - EXISTING
- **Port:** 4200
- **Package Manager:** npm
- **Commands:** `npm start`, `npm run build`, `npm test`
- **Status:** Working - needs automation bridge added
- **POC Addition:** `window.__agentBridge` for programmatic control via `?automation=1`

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

### mcp-tools (Bun) - STUB
- **Port:** 3001
- **Commands:** `bun run dev`
- **Status:** Scaffold only - needs implementation
- **Dependencies:** `@modelcontextprotocol/sdk`, `zod`

### headless-session-manager (Node.js + Playwright) - STUB
- **Port:** 3002
- **Commands:** `npm run dev`
- **Status:** Scaffold only - needs implementation
- **Runtime:** Node.js (Playwright incompatible with Bun)
- **Dependencies:** `playwright`, `express`

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

### Automation Bridge (shop-ui)
When `?automation=1` is set, shop-ui exposes `window.__agentBridge`:
```typescript
interface AgentBridge {
  isReady(): boolean;
  getState(): StoreState;
  dispatchAndWait(action, successTypes, failureTypes, timeout): Promise<BridgeResult>;
}
```

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
| 0 | Local scaffold + repo layout | Complete |
| 1 | Tool contracts + event model | Pending |
| 2 | shop-ui automation bridge | Pending |
| 3 | Headless session manager | Pending |
| 4 | MCP tools server | Pending |
| 5 | Chat UI | Pending |
| 6 | Integration + demo hardening | Pending |

## Detailed Implementation Plans

Each app has its own detailed, self-contained implementation plan:

| App | Implementation Plan | Key Notes |
|-----|---------------------|-----------|
| shop-ui | `shop-ui/IMPLEMENTATION_PLAN.md` | Add `window.__agentBridge` automation bridge |
| headless-session-manager | `headless-session-manager/IMPLEMENTATION_PLAN.md` | **Must convert from Bun to Node.js** (Playwright incompatibility) |
| mcp-tools | `mcp-tools/IMPLEMENTATION_PLAN.md` | MCP tool server with Zod schemas |
| chat-ui | `chat-ui/IMPLEMENTATION_PLAN.md` | Scripted agent mode, React components |

> ⚠️ **Critical:** Before implementing `headless-session-manager`, you must convert it from Bun to Node.js. See its IMPLEMENTATION_PLAN.md for conversion steps.

See `IMPLEMENTATION_PLAN.md` for the overall roadmap, dependency graph, and architecture diagrams.
