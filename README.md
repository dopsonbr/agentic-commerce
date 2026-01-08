# Agentic Shopping POC (Local-First)

This repository contains a **local-first proof of concept** for demonstrating "agentic shopping" on top of an existing shopping experience. The goal is to validate feasibility and demo value **without investing in a full rewrite** or paid AI services.

The POC is designed to run **entirely on a developer laptop** (or a single local environment) and prove that:
- a chat experience can drive shopping workflows
- the existing SPA orchestration (NgRx) can be reused via a headless browser session
- the system can produce auditable, trustworthy tool outputs (not just "chat text")

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENTIC COMMERCE POC                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐         REST/JSON          ┌──────────────────────────┐  │
│  │              │◄────────────────────────────│                          │  │
│  │   chat-ui    │         Tool Calls          │       mcp-tools          │  │
│  │   (React)    │────────────────────────────►│   (MCP Tool Server)      │  │
│  │   :5173      │         Tool Results        │       :3001              │  │
│  └──────────────┘◄────────────────────────────└──────────────────────────┘  │
│         │                                              │          │         │
│         │ Renders                          Direct API  │          │ Headless│
│         │ tool cards                       (stateless) │          │ dispatch│
│         │ + context                                    ▼          │(stateful│
│         │                                     ┌──────────────┐    │  )      │
│         │                                     │              │    │         │
│         │                                     │   shop-api   │    │         │
│         │                                     │   (Bun)      │◄───┼─────┐   │
│         │                                     │   :3000      │    │     │   │
│         │                                     └──────────────┘    │     │   │
│         │                                                         ▼     │   │
│         │                                     ┌──────────────────────┐  │   │
│         │                                     │  headless-session-   │  │   │
│         │                                     │      manager         │  │   │
│         │                                     │  (Node + Playwright) │  │   │
│         │                                     │       :3002          │  │   │
│         │                                     └──────────────────────┘  │   │
│         │                                              │                │   │
│         │                                              │ Playwright     │   │
│         │                                              │ controls       │   │
│         │                                              ▼                │   │
│         │                                     ┌──────────────────────┐  │   │
│         │                                     │      Headless        │  │   │
│         │                                     │      Chromium        │  │   │
│         │                                     └──────────────────────┘  │   │
│         │                                              │                │   │
│         │                                              │ loads          │   │
│         │                                              ▼                │   │
│         │                                     ┌──────────────────────┐  │   │
│         │                                     │      shop-ui         │──┘   │
│         │                                     │  (Angular + NgRx)    │      │
│         │                                     │  ?automation=1       │      │
│         │                                     │       :4200          │      │
│         │                                     │                      │      │
│         │                                     │  window.__agentBridge│      │
│         │                                     └──────────────────────┘      │
│         │                                                                   │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST FLOW PATTERNS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PATTERN A: Stateless Read (e.g., search_products, get_cart)                │
│  ════════════════════════════════════════════════════════════               │
│                                                                             │
│    User ──► chat-ui ──► mcp-tools ──► shop-api ──► Response                 │
│      │         │            │             │            │                    │
│      │    "show me        tool         GET /api/    product                 │
│      │     hammers"      call          products?    list                    │
│      │                                 search=                              │
│      │                                 hammer                               │
│      │◄────────────────────────────────────────────────┘                    │
│           Rendered as product card in chat                                  │
│                                                                             │
│  PATTERN B: Stateful Action (e.g., add_to_cart)                             │
│  ════════════════════════════════════════════════════════════               │
│                                                                             │
│    User ──► chat-ui ──► mcp-tools ──► headless-session-manager              │
│      │         │            │                    │                          │
│      │    "add hammer    tool call           dispatch                       │
│      │     to cart"                          via bridge                     │
│      │                                           │                          │
│      │                                           ▼                          │
│      │                               ┌─────────────────────┐                │
│      │                               │  Headless Chromium  │                │
│      │                               │    + shop-ui        │                │
│      │                               │                     │                │
│      │                               │  __agentBridge.     │                │
│      │                               │  dispatchAndWait(   │                │
│      │                               │    addToCart(sku)   │                │
│      │                               │  )                  │                │
│      │                               └─────────┬───────────┘                │
│      │                                         │                            │
│      │                                         │ NgRx effect                │
│      │                                         ▼                            │
│      │                                     shop-api                         │
│      │                                   POST /cart/items                   │
│      │                                         │                            │
│      │                                         │ success/failure            │
│      │◄────────────────────────────────────────┘                            │
│           Rendered as confirmation card in chat                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Apps

### 1) `shop-ui`
Existing shopping Angular SPA with NgRx state management.

**POC additions**
- "Automation mode" (`?automation=1`)
- In-page automation bridge (`window.__agentBridge`) to:
  - dispatch NgRx actions
  - await success/failure actions with correlation IDs
  - expose cart/context snapshots

**Stack:** Angular 21, NgRx, pnpm
**Port:** 4200

---

### 2) `shop-api`
REST API layer backing the shopping experience.

**Capabilities**
- Product catalog with search
- Cart management (create, add items, update quantities)
- In-memory storage (no database required)

**Stack:** Bun, TypeScript
**Port:** 3000

---

### 3) `mcp-tools`
MCP-compliant tool server exposing shopping tools to the chat experience.

**Tools**
| Tool | Type | Description |
|------|------|-------------|
| `search_products` | Stateless | Query shop-api for products |
| `get_product_details` | Stateless | Get single product by SKU |
| `add_to_cart` | Stateful | Dispatch NgRx action via headless browser |
| `get_cart` | Stateless | Get current cart contents |
| `set_customer_id` | Session | Set customer context for session |

**Stack:** Bun, @modelcontextprotocol/sdk
**Port:** 3001

---

### 4) `chat-ui`
Chat interface for testing the agentic shopping concept.

**Features**
- Conversation feed with user/assistant messages
- Tool call + result rendering as cards
- Cart summary context panel
- Scripted agent mode (deterministic, no LLM)

**Stack:** Bun, React
**Port:** 5173

---

### 5) `headless-session-manager`
Service managing headless Chromium sessions for stateful browser automation.

**Responsibilities**
- One browser session per chat session
- Execute NgRx actions via automation bridge
- Serialize concurrent requests per session
- Session lifecycle (create, keep warm, destroy)

**Stack:** Node.js, Playwright (Note: Playwright requires Node.js, not Bun)
**Port:** 3002

---

## Demo Scenarios

### Scripted Chat Examples

```
User: "my customer id is 123456"
Assistant: [calls set_customer_id] → "Got it, I've set your customer ID to 123456."

User: "show me info about a hammer"
Assistant: [calls search_products] → [Product Card: Claw Hammer, $24.99, SKU: 100003]

User: "add the hammer to my cart"
Assistant: [calls add_to_cart] → [Confirmation Card: Added Claw Hammer to cart]

User: "what's in my cart"
Assistant: [calls get_cart] → [Cart Card: 1 item, $24.99 total]
```

---

## Local Development

### Prerequisites
- Node.js 20+ (required for Playwright)
- Bun 1.0+ (for shop-api, mcp-tools, chat-ui)
- pnpm (for shop-ui and headless-session-manager)

### Startup Order

```bash
# Terminal 1: Start shop-api
cd shop-api && bun run dev

# Terminal 2: Start shop-ui
cd shop-ui && pnpm start

# Terminal 3: Start headless-session-manager
cd headless-session-manager && pnpm run dev

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
| shop-ui | 4200 | pnpm/ng |
| chat-ui | 5173 | Bun |

---

## What the POC Demonstrates

- **Chat-driven shopping:** Natural language commands execute real shopping workflows
- **Tool-based execution:** Every action is auditable via structured tool calls/results
- **NgRx reuse:** Existing SPA orchestration works without server-side reimplementation
- **Zero-cost operation:** Scripted agent mode requires no paid AI services

---

## Local-First Principles

This POC intentionally prioritizes:
- Simple local startup
- Minimal infrastructure dependencies
- Deterministic demos
- Fast iteration on tool contracts and UX

**Non-goals:**
- Production scalability
- Multi-region deployments
- Full security hardening
- Perfect AI reasoning

---

## POC Acceptance Criteria

A user can:
1. Open `chat-ui`
2. Set their customer ID via chat
3. Search products via natural language
4. Add items to cart via chat command
5. View cart summary
6. Repeat actions using a warm headless session

All runnable **locally** without paid AI services.
