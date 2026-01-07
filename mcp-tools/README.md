# mcp-tools

MCP-compliant tool server exposing shopping tools to the chat experience.

## Overview

This service implements the [Model Context Protocol](https://modelcontextprotocol.io/) to expose shopping tools that can be invoked by the chat-ui. It routes requests to either:
- **shop-api** for stateless reads (search, get cart)
- **headless-session-manager** for stateful actions (add to cart)

## Stack

- **Runtime:** Bun
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Schema Validation:** Zod
- **Port:** 3001

## Tools

| Tool | Type | Route To | Description |
|------|------|----------|-------------|
| `search_products` | Stateless | shop-api | Search products by keyword |
| `get_product_details` | Stateless | shop-api | Get product by SKU |
| `get_cart` | Stateless | shop-api | Get cart contents |
| `add_to_cart` | Stateful | headless-session-manager | Add item via NgRx action |
| `set_customer_id` | Session | local | Set customer context |

## API Endpoints

```
GET  /health              # Health check
GET  /tools               # List available tools
POST /tools/:name/call    # Execute a tool
POST /sessions            # Create chat session
```

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run tests
bun test
```

## Configuration

Environment variables:
```bash
PORT=3001
SHOP_API_URL=http://localhost:3000
HEADLESS_URL=http://localhost:3002
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 mcp-tools                       │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │            MCP Server (SDK)               │ │
│  │  • Tool registration                      │ │
│  │  • Schema validation                      │ │
│  │  • Request/response handling              │ │
│  └───────────────────────────────────────────┘ │
│                      │                          │
│                      ▼                          │
│  ┌───────────────────────────────────────────┐ │
│  │            Tool Router                    │ │
│  │                                           │ │
│  │  Stateless ──► shop-api                   │ │
│  │  Stateful  ──► headless-session-manager   │ │
│  └───────────────────────────────────────────┘ │
│                      │                          │
│                      ▼                          │
│  ┌───────────────────────────────────────────┐ │
│  │         Session Context Store             │ │
│  │  Map<sessionId, { customerId, cartId }>   │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## File Structure (Target)

```
mcp-tools/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # MCP server setup
│   ├── http-transport.ts     # REST API wrapper
│   ├── session-context.ts    # Session state management
│   ├── handlers/
│   │   ├── search-products.ts
│   │   ├── get-product-details.ts
│   │   ├── get-cart.ts
│   │   ├── add-to-cart.ts
│   │   └── set-customer-id.ts
│   └── schemas/
│       ├── tools.ts          # Tool definitions
│       └── events.ts         # Event types
├── package.json
└── tsconfig.json
```

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "latest",
  "zod": "^3.25"
}
```

## Tool Schemas

### search_products
```typescript
{
  input: { query: string, limit?: number },
  output: { products: Product[], total: number }
}
```

### add_to_cart
```typescript
{
  input: { sku: string, quantity?: number },
  output: { success: boolean, cartId: string, item: CartItem }
}
```

### get_cart
```typescript
{
  input: {},
  output: { cartId: string, items: CartItem[], total: number }
}
```

### set_customer_id
```typescript
{
  input: { customerId: string },
  output: { success: boolean, customerId: string }
}
```
