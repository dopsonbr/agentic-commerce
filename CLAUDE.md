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
├── mcp-tools/                # Tool server for shopping tools (Bun)
├── headless-session-manager/ # Headless Chromium session manager (Bun)
├── IMPLEMENTATION_PLAN.md    # Phased implementation roadmap
└── README.md                 # Project overview and architecture
```

## Apps

### shop-ui (Angular + NgRx)
- **Port:** 4200
- **Package Manager:** npm
- **Commands:** `npm start`, `npm run build`, `npm test`
- **Purpose:** Existing shopping SPA with automation mode (`?automation=1`) and `window.__agentBridge` for programmatic control

### shop-api (Bun)
- **Port:** 3000
- **Commands:** `bun run dev`, `bun run start`, `bun test`
- **Purpose:** REST API for products and cart management (in-memory storage)
- **Endpoints:** `/api/products`, `/api/cart/:id`

### chat-ui (Bun + React)
- **Port:** TBD
- **Commands:** `bun run dev`, `bun run start`
- **Purpose:** Chat interface rendering messages, tool calls, and context panels

### mcp-tools (Bun)
- **Purpose:** Tool server exposing shopping tools (`search_products`, `add_to_cart`, `get_cart_summary`)
- **Routes:** Direct to shop-api for reads, via headless-session-manager for stateful actions

### headless-session-manager (Bun)
- **Purpose:** Manages one headless Chromium session per chat session, executes NgRx actions via automation bridge

## Local Development

### Startup Order
1. `shop-api` - `cd shop-api && bun run dev`
2. `shop-ui` - `cd shop-ui && npm start`
3. `headless-session-manager` - `cd headless-session-manager && bun run index.ts`
4. `mcp-tools` - `cd mcp-tools && bun run index.ts`
5. `chat-ui` - `cd chat-ui && bun run dev`

### Default Ports
| App | Port |
|-----|------|
| shop-ui | 4200 |
| shop-api | 3000 |
| chat-ui | TBD |
| mcp-tools | TBD |
| headless-session-manager | TBD |

## Technology Stack

### Bun Apps (shop-api, chat-ui, mcp-tools, headless-session-manager)
- Use `bun` instead of `node`
- Use `bun install` instead of `npm install`
- Use `bun test` for testing
- Use `Bun.serve()` for HTTP servers (not Express)
- Bun auto-loads `.env` files

### Angular App (shop-ui)
- Angular 21 with standalone components
- NgRx Store + Effects for state management
- Vitest for testing (not Karma/Jasmine)
- Signals for component state
- `ChangeDetection.OnPush` required

## Architecture Flow

```
chat-ui ⇄ mcp-tools
mcp-tools → shop-api (stateless reads)
mcp-tools → headless-session-manager (stateful flows)
headless-session-manager → Chromium → shop-ui?automation=1 → NgRx → shop-api
```

## Key Concepts

### Automation Bridge (shop-ui)
When `?automation=1` is set, shop-ui exposes `window.__agentBridge`:
- `dispatchAndWait(action, okTypes, errTypes, correlationId)` - Dispatch NgRx action and await result

### Tool Cards (chat-ui)
Tool results are rendered as structured cards, not raw text, for auditability.

### Zero-Cost Modes
- **Scripted agent mode:** Deterministic responses without LLM
- **Operator mode:** Human-in-the-loop control

## Implementation Phases

See `IMPLEMENTATION_PLAN.md` for detailed phases:
- Phase 0: Local scaffold
- Phase 1: Tool contracts + UI event model
- Phase 2: shop-ui automation bridge
- Phase 3: Headless session manager
- Phase 4: mcp-tools routing
- Phase 5: chat-ui POC experience
- Phase 6: Demo hardening
- Phase 7: (Optional) Smarter brain integration
