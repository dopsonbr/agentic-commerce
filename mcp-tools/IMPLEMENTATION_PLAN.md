# mcp-tools Implementation Plan

This plan details implementing the MCP-compliant tool server that exposes shopping tools to the chat-ui.

## Overview

The mcp-tools service implements the [Model Context Protocol](https://modelcontextprotocol.io/) to provide a standardized interface for shopping operations. It routes requests to:
- **shop-api** for stateless reads (search, get cart)
- **headless-session-manager** for stateful actions (add to cart)

## Prerequisites

- Bun installed
- shop-api running at `http://localhost:3000`
- headless-session-manager running at `http://localhost:3002` (for stateful tools)

## Dependencies

- Depends on: **shop-api** (existing, working)
- Depends on: **headless-session-manager** (for `add_to_cart` tool)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              mcp-tools (:3001)                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         HTTP REST API                                  │ │
│  │                                                                        │ │
│  │   GET  /health           → Health check                                │ │
│  │   GET  /tools            → List available tools                        │ │
│  │   POST /tools/:name/call → Execute tool                                │ │
│  │   POST /sessions         → Create chat session                         │ │
│  │   DELETE /sessions/:id   → Destroy chat session                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         Tool Registry                                  │ │
│  │                                                                        │ │
│  │   search_products      → Stateless  → shop-api                         │ │
│  │   get_product_details  → Stateless  → shop-api                         │ │
│  │   get_cart             → Stateless  → shop-api                         │ │
│  │   add_to_cart          → Stateful   → headless-session-manager         │ │
│  │   set_customer_id      → Session    → local state                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     Session Context Store                              │ │
│  │                                                                        │ │
│  │   Map<chatSessionId, {                                                 │ │
│  │     customerId: string | null,                                         │ │
│  │     cartId: string | null,                                             │ │
│  │     headlessSessionId: string | null                                   │ │
│  │   }>                                                                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Update package.json

**File:** `package.json`

```json
{
  "name": "mcp-tools",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Step 2: Create Type Definitions

**File:** `src/types.ts`

```typescript
import { z } from 'zod';

// Product schemas
export const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.string(),
  inStock: z.boolean(),
});

export type Product = z.infer<typeof ProductSchema>;

// Cart schemas
export const CartItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  id: z.string(),
  customerId: z.string().nullable(),
  items: z.array(CartItemSchema),
  total: z.number(),
});

export type Cart = z.infer<typeof CartSchema>;

// Session context
export interface SessionContext {
  customerId: string | null;
  cartId: string | null;
  headlessSessionId: string | null;
}

// Tool definitions
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (args: unknown, sessionId: string) => Promise<unknown>;
}

// Tool call request/response
export interface ToolCallRequest {
  sessionId: string;
  args: unknown;
}

export interface ToolCallResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}
```

### Step 3: Create Tool Schemas

**File:** `src/schemas/tools.ts`

```typescript
import { z } from 'zod';
import { ProductSchema, CartItemSchema } from '../types.js';

// search_products
export const searchProductsInput = z.object({
  query: z.string().describe('Search term for products'),
  limit: z.number().optional().default(10).describe('Maximum results to return'),
});

export const searchProductsOutput = z.object({
  products: z.array(ProductSchema),
  total: z.number(),
});

// get_product_details
export const getProductDetailsInput = z.object({
  sku: z.string().describe('Product SKU'),
});

export const getProductDetailsOutput = ProductSchema;

// add_to_cart
export const addToCartInput = z.object({
  sku: z.string().describe('Product SKU to add'),
  quantity: z.number().optional().default(1).describe('Quantity to add'),
});

export const addToCartOutput = z.object({
  success: z.boolean(),
  cartId: z.string(),
  item: CartItemSchema,
});

// get_cart
export const getCartInput = z.object({});

export const getCartOutput = z.object({
  cartId: z.string(),
  customerId: z.string().nullable(),
  items: z.array(CartItemSchema),
  total: z.number(),
});

// set_customer_id
export const setCustomerIdInput = z.object({
  customerId: z.string().describe('Customer ID to set for session'),
});

export const setCustomerIdOutput = z.object({
  success: z.boolean(),
  customerId: z.string(),
});
```

### Step 4: Create Session Context Store

**File:** `src/session-context.ts`

```typescript
import type { SessionContext } from './types.js';

class SessionContextStore {
  private sessions = new Map<string, SessionContext>();

  getOrCreate(sessionId: string): SessionContext {
    let context = this.sessions.get(sessionId);
    if (!context) {
      context = {
        customerId: null,
        cartId: null,
        headlessSessionId: null,
      };
      this.sessions.set(sessionId, context);
    }
    return context;
  }

  get(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  update(sessionId: string, updates: Partial<SessionContext>): void {
    const context = this.getOrCreate(sessionId);
    Object.assign(context, updates);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

export const sessionStore = new SessionContextStore();
```

### Step 5: Create Tool Handlers

**File:** `src/handlers/search-products.ts`

```typescript
import { searchProductsInput, searchProductsOutput } from '../schemas/tools.js';

const SHOP_API_URL = process.env.SHOP_API_URL || 'http://localhost:3000';

export async function handleSearchProducts(args: unknown, sessionId: string) {
  const input = searchProductsInput.parse(args);

  const url = new URL('/api/products', SHOP_API_URL);
  if (input.query) {
    url.searchParams.set('search', input.query);
  }
  url.searchParams.set('limit', String(input.limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`shop-api error: ${response.status}`);
  }

  const products = await response.json();

  return searchProductsOutput.parse({
    products: Array.isArray(products) ? products : [],
    total: Array.isArray(products) ? products.length : 0,
  });
}
```

**File:** `src/handlers/get-product-details.ts`

```typescript
import { getProductDetailsInput, getProductDetailsOutput } from '../schemas/tools.js';

const SHOP_API_URL = process.env.SHOP_API_URL || 'http://localhost:3000';

export async function handleGetProductDetails(args: unknown, sessionId: string) {
  const input = getProductDetailsInput.parse(args);

  const response = await fetch(`${SHOP_API_URL}/api/products/${input.sku}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Product not found: ${input.sku}`);
    }
    throw new Error(`shop-api error: ${response.status}`);
  }

  const product = await response.json();
  return getProductDetailsOutput.parse(product);
}
```

**File:** `src/handlers/get-cart.ts`

```typescript
import { getCartInput, getCartOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';

const SHOP_API_URL = process.env.SHOP_API_URL || 'http://localhost:3000';

export async function handleGetCart(args: unknown, sessionId: string) {
  getCartInput.parse(args); // Validate (empty object)

  const context = sessionStore.getOrCreate(sessionId);

  // If no cart yet, return empty
  if (!context.cartId) {
    return getCartOutput.parse({
      cartId: '',
      customerId: context.customerId,
      items: [],
      total: 0,
    });
  }

  const url = new URL(`/api/cart/${context.cartId}`, SHOP_API_URL);
  if (context.customerId) {
    url.searchParams.set('customerId', context.customerId);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`shop-api error: ${response.status}`);
  }

  const cart = await response.json();

  // Calculate total
  const total = cart.items?.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  ) ?? 0;

  return getCartOutput.parse({
    cartId: cart.id,
    customerId: cart.customerId,
    items: cart.items ?? [],
    total,
  });
}
```

**File:** `src/handlers/add-to-cart.ts`

```typescript
import { addToCartInput, addToCartOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';

const HEADLESS_URL = process.env.HEADLESS_URL || 'http://localhost:3002';
const SHOP_API_URL = process.env.SHOP_API_URL || 'http://localhost:3000';

export async function handleAddToCart(args: unknown, sessionId: string) {
  const input = addToCartInput.parse(args);
  const context = sessionStore.getOrCreate(sessionId);

  // Ensure headless session exists
  if (!context.headlessSessionId) {
    context.headlessSessionId = sessionId;
    await createHeadlessSession(sessionId);
  }

  // First, get product details for the response
  const productResponse = await fetch(`${SHOP_API_URL}/api/products/${input.sku}`);
  if (!productResponse.ok) {
    throw new Error(`Product not found: ${input.sku}`);
  }
  const product = await productResponse.json();

  // Execute via headless browser
  const executeResponse = await fetch(
    `${HEADLESS_URL}/sessions/${context.headlessSessionId}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: {
          type: '[Cart] Add Item',
          sku: input.sku,
          quantity: input.quantity,
        },
        successTypes: ['[Cart] Add Item Success'],
        failureTypes: ['[Cart] Add Item Failure'],
        timeout: 10000,
      }),
    }
  );

  if (!executeResponse.ok) {
    throw new Error(`Headless execution failed: ${executeResponse.status}`);
  }

  const result = await executeResponse.json();

  if (!result.success) {
    throw new Error(result.error || 'Add to cart failed');
  }

  // Extract cart ID from state if available
  if (result.state?.cart?.id) {
    context.cartId = result.state.cart.id;
  }

  return addToCartOutput.parse({
    success: true,
    cartId: context.cartId || 'pending',
    item: {
      sku: input.sku,
      name: product.name,
      price: product.price,
      quantity: input.quantity,
    },
  });
}

async function createHeadlessSession(sessionId: string): Promise<void> {
  const response = await fetch(`${HEADLESS_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok && response.status !== 409) {
    // 409 = already exists, which is fine
    throw new Error(`Failed to create headless session: ${response.status}`);
  }
}
```

**File:** `src/handlers/set-customer-id.ts`

```typescript
import { setCustomerIdInput, setCustomerIdOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';

export async function handleSetCustomerId(args: unknown, sessionId: string) {
  const input = setCustomerIdInput.parse(args);

  sessionStore.update(sessionId, { customerId: input.customerId });

  return setCustomerIdOutput.parse({
    success: true,
    customerId: input.customerId,
  });
}
```

### Step 6: Create Tool Registry

**File:** `src/tool-registry.ts`

```typescript
import type { ToolDefinition } from './types.js';
import * as schemas from './schemas/tools.js';
import { handleSearchProducts } from './handlers/search-products.js';
import { handleGetProductDetails } from './handlers/get-product-details.js';
import { handleGetCart } from './handlers/get-cart.js';
import { handleAddToCart } from './handlers/add-to-cart.js';
import { handleSetCustomerId } from './handlers/set-customer-id.js';

export const tools: ToolDefinition[] = [
  {
    name: 'search_products',
    description: 'Search for products by keyword. Returns matching products with details.',
    inputSchema: schemas.searchProductsInput,
    handler: handleSearchProducts,
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product by SKU.',
    inputSchema: schemas.getProductDetailsInput,
    handler: handleGetProductDetails,
  },
  {
    name: 'get_cart',
    description: 'Get the current shopping cart contents and total.',
    inputSchema: schemas.getCartInput,
    handler: handleGetCart,
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart. Requires product SKU.',
    inputSchema: schemas.addToCartInput,
    handler: handleAddToCart,
  },
  {
    name: 'set_customer_id',
    description: 'Set the customer ID for this chat session.',
    inputSchema: schemas.setCustomerIdInput,
    handler: handleSetCustomerId,
  },
];

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}

export function listTools() {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
```

### Step 7: Create Main Server

**File:** `src/index.ts`

```typescript
import { tools, getTool, listTools } from './tool-registry.js';
import { sessionStore } from './session-context.js';
import type { ToolCallRequest } from './types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Health check
      if (url.pathname === '/health' && method === 'GET') {
        return Response.json({ status: 'ok', tools: tools.length }, { headers });
      }

      // List tools
      if (url.pathname === '/tools' && method === 'GET') {
        return Response.json(listTools(), { headers });
      }

      // Call tool
      const toolMatch = url.pathname.match(/^\/tools\/([^/]+)\/call$/);
      if (toolMatch && method === 'POST') {
        const toolName = toolMatch[1];
        const tool = getTool(toolName);

        if (!tool) {
          return Response.json(
            { success: false, error: `Unknown tool: ${toolName}` },
            { status: 404, headers }
          );
        }

        const body = await req.json() as ToolCallRequest;
        const sessionId = body.sessionId || 'default';

        try {
          const result = await tool.handler(body.args, sessionId);
          return Response.json({ success: true, result }, { headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          return Response.json({ success: false, error: message }, { status: 400, headers });
        }
      }

      // Create session
      if (url.pathname === '/sessions' && method === 'POST') {
        const body = await req.json() as { sessionId: string };
        sessionStore.getOrCreate(body.sessionId);
        return Response.json({ sessionId: body.sessionId, status: 'created' }, { status: 201, headers });
      }

      // Delete session
      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
      if (sessionMatch && method === 'DELETE') {
        const sessionId = sessionMatch[1];
        sessionStore.delete(sessionId);
        return Response.json({ sessionId, status: 'deleted' }, { headers });
      }

      // 404
      return Response.json({ error: 'Not found' }, { status: 404, headers });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      return Response.json({ error: message }, { status: 500, headers });
    }
  },
});

console.log(`[mcp-tools] Server running on http://localhost:${PORT}`);
console.log(`[mcp-tools] Available tools: ${tools.map(t => t.name).join(', ')}`);
```

---

## File Structure

```
mcp-tools/
├── src/
│   ├── index.ts              # Bun server entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── tool-registry.ts      # Tool registration
│   ├── session-context.ts    # Session state management
│   ├── schemas/
│   │   └── tools.ts          # Zod schemas for all tools
│   └── handlers/
│       ├── search-products.ts
│       ├── get-product-details.ts
│       ├── get-cart.ts
│       ├── add-to-cart.ts
│       └── set-customer-id.ts
├── package.json
├── tsconfig.json
└── IMPLEMENTATION_PLAN.md
```

---

## API Reference

### GET /health
Health check.

### GET /tools
List all available tools with schemas.

### POST /tools/:name/call
Execute a tool.

**Request:**
```json
{
  "sessionId": "chat-123",
  "args": { "query": "hammer" }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "products": [...],
    "total": 3
  }
}
```

### POST /sessions
Create a chat session context.

### DELETE /sessions/:id
Delete a chat session context.

---

## Testing

```bash
# Start dependencies first
cd ../shop-api && bun run dev &
cd ../headless-session-manager && npm run dev &

# Start mcp-tools
bun run dev

# Test search
curl -X POST http://localhost:3001/tools/search_products/call \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "args": {"query": "hammer"}}'

# Test set customer ID
curl -X POST http://localhost:3001/tools/set_customer_id/call \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "args": {"customerId": "123456"}}'

# Test add to cart (requires headless-session-manager)
curl -X POST http://localhost:3001/tools/add_to_cart/call \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "args": {"sku": "100003", "quantity": 1}}'

# Test get cart
curl -X POST http://localhost:3001/tools/get_cart/call \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "args": {}}'
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `SHOP_API_URL` | `http://localhost:3000` | shop-api base URL |
| `HEADLESS_URL` | `http://localhost:3002` | headless-session-manager URL |

---

## Acceptance Criteria

- [ ] All 5 tools are registered and callable
- [ ] `search_products` returns products from shop-api
- [ ] `get_product_details` returns single product
- [ ] `set_customer_id` stores customer in session
- [ ] `add_to_cart` executes via headless-session-manager
- [ ] `get_cart` returns cart contents
- [ ] Session context persists across tool calls
- [ ] Errors are handled gracefully with clear messages

---

## Integration Points

### With chat-ui

chat-ui will call mcp-tools via REST:
```typescript
// In chat-ui
const response = await fetch('http://localhost:3001/tools/search_products/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: chatSessionId,
    args: { query: userSearchTerm },
  }),
});
const { result } = await response.json();
```
