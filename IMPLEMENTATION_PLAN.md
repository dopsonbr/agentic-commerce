# Implementation Plan — Agentic Commerce POC

This plan is optimized for running everything on a single developer machine with a happy-path demo focus.

---

## Detailed Implementation Plans

Each app has its own detailed, self-contained implementation plan with step-by-step code examples:

| App | Plan | Status | Runtime |
|-----|------|--------|---------|
| **shop-ui** | [`shop-ui/IMPLEMENTATION_PLAN.md`](./shop-ui/IMPLEMENTATION_PLAN.md) | ✅ Done | npm (Angular) |
| **headless-session-manager** | [`headless-session-manager/IMPLEMENTATION_PLAN.md`](./headless-session-manager/IMPLEMENTATION_PLAN.md) | ✅ Done | Node.js (converted from Bun) |
| **mcp-tools** | [`mcp-tools/IMPLEMENTATION_PLAN.md`](./mcp-tools/IMPLEMENTATION_PLAN.md) | ✅ Done | Bun |
| **chat-ui** | [`chat-ui/IMPLEMENTATION_PLAN.md`](./chat-ui/IMPLEMENTATION_PLAN.md) | ✅ Done | Bun |
| **shop-api** | N/A (already implemented) | ✅ Done | Bun |

---

## Implementation Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION DEPENDENCIES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │   shop-api      │ ◄──── DONE (products + cart API working)               │
│  │   (existing)    │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ provides product/cart data                                      │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │   shop-ui       │ ◄──── DONE (Angular + NgRx working)                    │
│  │   (existing)    │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ ✅ automation bridge DONE                                       │
│           ▼                                                                 │
│  ┌─────────────────┐      ┌─────────────────┐                               │
│  │  shop-ui        │      │  Tool Contracts │ ◄──── Define first            │
│  │  automation     │ ✅   │  (schemas)      │                               │
│  │  bridge DONE    │      └────────┬────────┘                               │
│  └────────┬────────┘               │                                        │
│           │                        │                                        │
│           │                        │ shapes tool I/O                        │
│           │                        ▼                                        │
│           │              ┌─────────────────┐                                │
│           │              │   mcp-tools     │                                │
│           │              │   server        │                                │
│           │              └────────┬────────┘                                │
│           │                       │                                         │
│           │ bridge API            │ needs headless for stateful             │
│           ▼                       ▼                                         │
│  ┌─────────────────────────────────────────┐                                │
│  │      headless-session-manager           │                                │
│  │      (Playwright + session mgmt)        │                                │
│  └────────────────────┬────────────────────┘                                │
│                       │                                                     │
│                       │ exposes tool execution                              │
│                       ▼                                                     │
│  ┌─────────────────────────────────────────┐                                │
│  │      chat-ui                            │                                │
│  │      (scripted agent + rendering)       │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Path

```
Tool Contracts ──► shop-ui bridge ──► headless-session-manager ──► mcp-tools ──► chat-ui
     │                   │                      │                      │            │
     │                   │                      │                      │            │
     ▼                   ▼                      ▼                      ▼            ▼
  Phase 1            Phase 2               Phase 3                Phase 4      Phase 5
  (merged)           ✅ DONE              ✅ DONE                ✅ DONE      ✅ DONE
```

---

## Phase 0 — Local Scaffold + Repo Layout (DONE)

- [x] Unified monorepo structure
- [x] All apps have basic scaffold
- [x] Ports defined (3000, 3001, 3002, 4200, 5173)
- [x] CLAUDE.md for development guidance

**Status:** Complete

---

## Phase 1 — Tool Contracts + Event Model

### Goal
Define the interface contracts before implementation to enable parallel work.

### Deliverables

#### 1.1 Tool Schemas (Zod + MCP format)

```typescript
// tools/search_products.ts
{
  name: "search_products",
  description: "Search for products by keyword",
  inputSchema: z.object({
    query: z.string().describe("Search term"),
    limit: z.number().optional().default(10)
  }),
  outputSchema: z.object({
    products: z.array(ProductSchema),
    total: z.number()
  })
}

// tools/add_to_cart.ts
{
  name: "add_to_cart",
  description: "Add a product to the shopping cart",
  inputSchema: z.object({
    sku: z.string().describe("Product SKU"),
    quantity: z.number().optional().default(1)
  }),
  outputSchema: z.object({
    success: z.boolean(),
    cartId: z.string(),
    item: CartItemSchema
  })
}

// tools/get_cart.ts
{
  name: "get_cart",
  description: "Get current cart contents",
  inputSchema: z.object({}),
  outputSchema: z.object({
    cartId: z.string(),
    customerId: z.string().nullable(),
    items: z.array(CartItemSchema),
    total: z.number()
  })
}

// tools/set_customer_id.ts
{
  name: "set_customer_id",
  description: "Set the customer ID for this session",
  inputSchema: z.object({
    customerId: z.string()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    customerId: z.string()
  })
}

// tools/get_product_details.ts
{
  name: "get_product_details",
  description: "Get details for a specific product",
  inputSchema: z.object({
    sku: z.string()
  }),
  outputSchema: ProductSchema
}
```

#### 1.2 Chat Event Model

```typescript
type ChatEvent =
  | { type: "user_message"; content: string; timestamp: number }
  | { type: "assistant_message"; content: string; timestamp: number }
  | { type: "tool_call"; toolName: string; args: unknown; callId: string; timestamp: number }
  | { type: "tool_result"; callId: string; result: unknown; timestamp: number }
  | { type: "error"; message: string; timestamp: number };

type SessionState = {
  sessionId: string;
  customerId: string | null;
  cartId: string | null;
  events: ChatEvent[];
};
```

#### 1.3 Scripted Agent Patterns

```typescript
// Pattern matching for scripted responses
const patterns = [
  {
    match: /customer\s*id\s*(?:is\s*)?(\d+)/i,
    tool: "set_customer_id",
    extractArgs: (match) => ({ customerId: match[1] })
  },
  {
    match: /(?:show|find|search|look for)\s+(.+)/i,
    tool: "search_products",
    extractArgs: (match) => ({ query: match[1] })
  },
  {
    match: /add\s+(?:the\s+)?(.+?)\s+to\s+(?:my\s+)?cart/i,
    tool: "add_to_cart",
    extractArgs: (match, context) => ({ sku: context.lastProductSku })
  },
  {
    match: /(?:what'?s?\s+in\s+my\s+cart|show\s+cart|cart\s+contents)/i,
    tool: "get_cart",
    extractArgs: () => ({})
  }
];
```

### Files to Create
- `mcp-tools/src/schemas/tools.ts` - Tool definitions
- `mcp-tools/src/schemas/events.ts` - Event types
- `chat-ui/src/types/events.ts` - Shared types

---

## Phase 2 — shop-ui Automation Bridge ✅ COMPLETE

> **Completed:** 2026-01-07 | **Tests:** 15 passing | **See:** [`shop-ui/IMPLEMENTATION_PLAN.md`](./shop-ui/IMPLEMENTATION_PLAN.md)

### Goal
Enable programmatic control of the Angular app via injected JavaScript bridge.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      shop-ui                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    NgRx Store                         │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐               │  │
│  │  │Products │  │  Cart   │  │  User   │               │  │
│  │  │  State  │  │  State  │  │  State  │               │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘               │  │
│  │       │            │            │                     │  │
│  │       └────────────┼────────────┘                     │  │
│  │                    │                                  │  │
│  │                    ▼                                  │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │           window.__agentBridge                  │ │  │
│  │  │                                                 │ │  │
│  │  │  • dispatchAndWait(action, successTypes,        │ │  │
│  │  │                    failureTypes, timeout)       │ │  │
│  │  │  • getState() → current store snapshot          │ │  │
│  │  │  • isReady() → boolean                          │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Activated when: ?automation=1                              │
└─────────────────────────────────────────────────────────────┘
```

### Deliverables

#### 2.1 Automation Mode Detection

```typescript
// shop-ui/src/app/automation/automation.service.ts
@Injectable({ providedIn: 'root' })
export class AutomationService {
  private enabled = signal(false);

  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.enabled.set(params.get('automation') === '1');

    if (this.enabled()) {
      this.initBridge();
    }
  }
}
```

#### 2.2 Agent Bridge Implementation

```typescript
// shop-ui/src/app/automation/agent-bridge.ts
interface AgentBridge {
  isReady(): boolean;
  getState(): StoreState;
  dispatchAndWait(
    action: Action,
    successTypes: string[],
    failureTypes: string[],
    timeoutMs?: number
  ): Promise<{ success: boolean; action?: Action; error?: string }>;
}

// Exposed as window.__agentBridge
```

#### 2.3 Action Success/Failure Mapping

| Action | Success Action | Failure Action |
|--------|---------------|----------------|
| `addToCart` | `[Cart] Add Item Success` | `[Cart] Add Item Failure` |
| `loadProducts` | `[Products] Load Success` | `[Products] Load Failure` |
| `loadCart` | `[Cart] Load Success` | `[Cart] Load Failure` |

### Files to Create/Modify
- `shop-ui/src/app/automation/automation.service.ts`
- `shop-ui/src/app/automation/agent-bridge.ts`
- `shop-ui/src/app/app.config.ts` - Register automation service

---

## Phase 3 — Headless Session Manager

### Goal
Manage Playwright browser instances that can execute commands via the automation bridge.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     headless-session-manager                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Session Store                                │   │
│  │    Map<sessionId, { browser, page, queue, customerId, cartId }>     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        REST API (:3002)                              │   │
│  │                                                                      │   │
│  │  POST /sessions              → Create new session                    │   │
│  │  DELETE /sessions/:id        → Destroy session                       │   │
│  │  POST /sessions/:id/execute  → Execute bridge command                │   │
│  │  GET /sessions/:id/state     → Get current store state               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Playwright Browser Pool                           │   │
│  │                                                                      │   │
│  │   Session 1          Session 2          Session 3                    │   │
│  │  ┌─────────┐        ┌─────────┐        ┌─────────┐                  │   │
│  │  │ Browser │        │ Browser │        │ Browser │                  │   │
│  │  │  Page   │        │  Page   │        │  Page   │                  │   │
│  │  │ shop-ui │        │ shop-ui │        │ shop-ui │                  │   │
│  │  └─────────┘        └─────────┘        └─────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deliverables

#### 3.1 Session Manager Service

```typescript
// headless-session-manager/src/session-manager.ts
class SessionManager {
  private sessions = new Map<string, BrowserSession>();

  async createSession(sessionId: string): Promise<void>;
  async destroySession(sessionId: string): Promise<void>;
  async executeCommand(sessionId: string, command: BridgeCommand): Promise<BridgeResult>;
  async getState(sessionId: string): Promise<StoreState>;
}
```

#### 3.2 Bridge Command Executor

```typescript
// headless-session-manager/src/bridge-executor.ts
async function executeBridgeCommand(
  page: Page,
  command: BridgeCommand
): Promise<BridgeResult> {
  // Wait for bridge ready
  await page.waitForFunction(() => window.__agentBridge?.isReady());

  // Execute via bridge
  return page.evaluate(async (cmd) => {
    return window.__agentBridge.dispatchAndWait(
      cmd.action,
      cmd.successTypes,
      cmd.failureTypes,
      cmd.timeout
    );
  }, command);
}
```

#### 3.3 REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions` | POST | Create session, returns sessionId |
| `/sessions/:id` | DELETE | Destroy session |
| `/sessions/:id/execute` | POST | Execute bridge command |
| `/sessions/:id/state` | GET | Get store snapshot |
| `/health` | GET | Service health check |

### Files to Create
- `headless-session-manager/src/index.ts` - HTTP server
- `headless-session-manager/src/session-manager.ts` - Session lifecycle
- `headless-session-manager/src/bridge-executor.ts` - Playwright bridge
- `headless-session-manager/src/types.ts` - TypeScript types
- `headless-session-manager/package.json` - Update for Node.js + Playwright

---

## Phase 4 — MCP Tools Server ✅ COMPLETE

> **Completed:** 2026-01-08 | **See:** [`mcp-tools/IMPLEMENTATION_PLAN.md`](./mcp-tools/IMPLEMENTATION_PLAN.md)

### Goal
Implement MCP-compliant tool server that routes to shop-api or headless-session-manager.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           mcp-tools (:3001)                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      MCP Server (SDK)                                │   │
│  │                                                                      │   │
│  │   @modelcontextprotocol/sdk                                          │   │
│  │   • Tool registration                                                │   │
│  │   • Schema validation (Zod)                                          │   │
│  │   • Request/response handling                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Tool Router                                    │   │
│  │                                                                      │   │
│  │   search_products ────────► shop-api (GET /api/products)             │   │
│  │   get_product_details ────► shop-api (GET /api/products/:sku)        │   │
│  │   get_cart ───────────────► shop-api (GET /api/cart/:id)             │   │
│  │   add_to_cart ────────────► headless-session-manager                 │   │
│  │   set_customer_id ────────► session state (local)                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Session Context Store                             │   │
│  │                                                                      │   │
│  │   Map<chatSessionId, { headlessSessionId, customerId, cartId }>     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deliverables

#### 4.1 MCP Server Setup

```typescript
// mcp-tools/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "agentic-commerce-tools",
  version: "1.0.0"
});

// Register tools
server.tool("search_products", searchProductsSchema, handleSearchProducts);
server.tool("add_to_cart", addToCartSchema, handleAddToCart);
// ...
```

#### 4.2 Tool Handlers

```typescript
// mcp-tools/src/handlers/search-products.ts
async function handleSearchProducts(
  args: { query: string; limit?: number },
  context: ToolContext
): Promise<ToolResult> {
  const response = await fetch(
    `${SHOP_API_URL}/api/products?search=${args.query}&limit=${args.limit}`
  );
  return { products: await response.json() };
}

// mcp-tools/src/handlers/add-to-cart.ts
async function handleAddToCart(
  args: { sku: string; quantity?: number },
  context: ToolContext
): Promise<ToolResult> {
  // Ensure headless session exists
  const sessionId = await ensureHeadlessSession(context.chatSessionId);

  // Execute via headless
  const result = await fetch(`${HEADLESS_URL}/sessions/${sessionId}/execute`, {
    method: "POST",
    body: JSON.stringify({
      action: { type: "[Cart] Add Item", payload: { sku: args.sku, quantity: args.quantity } },
      successTypes: ["[Cart] Add Item Success"],
      failureTypes: ["[Cart] Add Item Failure"]
    })
  });

  return result.json();
}
```

#### 4.3 HTTP Transport (for chat-ui)

```typescript
// mcp-tools/src/http-transport.ts
// Simple REST wrapper around MCP tools for chat-ui consumption

Bun.serve({
  port: 3001,
  routes: {
    "/tools": {
      GET: () => Response.json(server.listTools())
    },
    "/tools/:name/call": {
      POST: async (req) => {
        const { name } = req.params;
        const args = await req.json();
        const result = await server.callTool(name, args);
        return Response.json(result);
      }
    }
  }
});
```

### Files to Create
- `mcp-tools/src/index.ts` - Server entry
- `mcp-tools/src/server.ts` - MCP server setup
- `mcp-tools/src/http-transport.ts` - REST API wrapper
- `mcp-tools/src/handlers/*.ts` - Tool handlers
- `mcp-tools/src/session-context.ts` - Session management

---

## Phase 5 — Chat UI ✅ COMPLETE

> **Completed:** 2026-01-08 | **See:** [`chat-ui/IMPLEMENTATION_PLAN.md`](./chat-ui/IMPLEMENTATION_PLAN.md)

### Goal
Build the chat interface with scripted agent mode and tool result rendering.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           chat-ui (:5173)                                   │
│                                                                             │
│  ┌───────────────────────────────────────┬─────────────────────────────┐   │
│  │          Conversation Panel           │      Context Panel          │   │
│  │                                       │                             │   │
│  │  ┌─────────────────────────────────┐ │  ┌───────────────────────┐  │   │
│  │  │ User: show me hammers           │ │  │    Cart Summary       │  │   │
│  │  └─────────────────────────────────┘ │  │                       │  │   │
│  │  ┌─────────────────────────────────┐ │  │  Items: 2             │  │   │
│  │  │ [Tool: search_products]         │ │  │  Total: $49.98        │  │   │
│  │  │ ┌─────────────────────────────┐ │ │  │                       │  │   │
│  │  │ │ 🔨 Claw Hammer     $24.99   │ │ │  │  ┌─────────────────┐  │  │   │
│  │  │ │    SKU: 100003              │ │ │  │  │ Claw Hammer x1  │  │  │   │
│  │  │ └─────────────────────────────┘ │ │  │  │ Screwdriver x1  │  │  │   │
│  │  └─────────────────────────────────┘ │  │  └─────────────────┘  │  │   │
│  │  ┌─────────────────────────────────┐ │  │                       │  │   │
│  │  │ User: add it to my cart         │ │  └───────────────────────┘  │   │
│  │  └─────────────────────────────────┘ │                             │   │
│  │  ┌─────────────────────────────────┐ │  ┌───────────────────────┐  │   │
│  │  │ [Tool: add_to_cart]             │ │  │   Session Info        │  │   │
│  │  │ ✓ Added Claw Hammer to cart     │ │  │                       │  │   │
│  │  └─────────────────────────────────┘ │  │  Customer: 123456     │  │   │
│  │                                       │  │  Session: abc-123     │  │   │
│  │  ┌─────────────────────────────────┐ │  └───────────────────────┘  │   │
│  │  │ [Input: Type a message...]      │ │                             │   │
│  │  └─────────────────────────────────┘ │                             │   │
│  └───────────────────────────────────────┴─────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deliverables

#### 5.1 Core Components

```
chat-ui/src/
├── components/
│   ├── ChatContainer.tsx      # Main layout
│   ├── MessageList.tsx        # Conversation feed
│   ├── MessageInput.tsx       # User input
│   ├── ToolCallCard.tsx       # Tool invocation display
│   ├── ToolResultCard.tsx     # Tool result display
│   ├── ProductCard.tsx        # Product display
│   ├── CartSummary.tsx        # Context panel cart
│   └── SessionInfo.tsx        # Session details
├── hooks/
│   ├── useChat.ts             # Chat state management
│   ├── useScriptedAgent.ts    # Pattern matching agent
│   └── useToolExecution.ts    # Tool API calls
├── services/
│   ├── mcp-client.ts          # mcp-tools API client
│   └── session.ts             # Session management
└── types/
    └── events.ts              # Shared types
```

#### 5.2 Scripted Agent Hook

```typescript
// chat-ui/src/hooks/useScriptedAgent.ts
function useScriptedAgent() {
  const patterns = [...]; // From Phase 1

  function processMessage(message: string, context: ChatContext): AgentResponse {
    for (const pattern of patterns) {
      const match = message.match(pattern.match);
      if (match) {
        return {
          tool: pattern.tool,
          args: pattern.extractArgs(match, context)
        };
      }
    }
    return { message: "I'm not sure how to help with that." };
  }

  return { processMessage };
}
```

#### 5.3 Tool Result Renderers

```typescript
// chat-ui/src/components/ToolResultCard.tsx
function ToolResultCard({ toolName, result }) {
  switch (toolName) {
    case "search_products":
      return <ProductListCard products={result.products} />;
    case "add_to_cart":
      return <CartConfirmationCard item={result.item} />;
    case "get_cart":
      return <CartContentsCard cart={result} />;
    default:
      return <JsonCard data={result} />;
  }
}
```

### Files to Create
- `chat-ui/src/components/*.tsx` - UI components
- `chat-ui/src/hooks/*.ts` - React hooks
- `chat-ui/src/services/*.ts` - API clients
- `chat-ui/src/App.tsx` - Main app (update)

---

## Phase 6 — Integration + Demo Hardening ✅ COMPLETE

> **Completed:** 2026-01-08 | **See:** [`DEMO.md`](./DEMO.md)

### Goal
Ensure reliable end-to-end demo experience.

### Deliverables

- [x] Root `start-all.sh` script
- [x] Session reset button in chat-ui
- [x] Health check endpoints for all services
- [x] Demo script documentation
- [x] Console error suppression in headless mode

### Demo Script

```markdown
## Demo Flow

1. Start all services (./start-all.sh)
2. Open http://localhost:5173
3. Enter: "my customer id is 123456"
   → See: Session info updates
4. Enter: "show me info about a hammer"
   → See: Product card with hammer details
5. Enter: "add the hammer to my cart"
   → See: Confirmation card, cart summary updates
6. Enter: "what's in my cart"
   → See: Cart contents card
```

---

## Implementation Schedule

```
Week 1:
├── Day 1-2: Phase 1 (Tool Contracts)
├── Day 3-4: Phase 2 (shop-ui Bridge)
└── Day 5: Phase 2 testing

Week 2:
├── Day 1-3: Phase 3 (Headless Session Manager)
├── Day 4-5: Phase 4 (MCP Tools)

Week 3:
├── Day 1-3: Phase 5 (Chat UI)
├── Day 4-5: Phase 6 (Integration)
```

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP SDK | `@modelcontextprotocol/sdk` | Official TypeScript SDK, Zod integration |
| Headless browser | Playwright | Better API than Puppeteer, but requires Node.js |
| headless-session-manager runtime | Node.js | Playwright incompatible with Bun |
| Chat-mcp communication | REST | Simpler than WebSocket for demo |
| State management (chat-ui) | React hooks + signals | Lightweight, no Redux needed |

---

## Acceptance Criteria ✅ ALL PASSED

- [x] All 5 services start with single command (`./start-all.sh`)
- [x] "my customer id is X" sets session context
- [x] "show me [product]" returns product cards
- [x] "add [product] to cart" executes via headless browser
- [x] "what's in my cart" shows cart contents
- [x] Cart panel updates after add_to_cart
- [x] Demo repeatable without manual intervention (`./stop-all.sh && ./start-all.sh`)
