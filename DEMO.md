# Agentic Commerce POC - Demo Script

This document provides step-by-step instructions for running the Agentic Commerce demo.

---

## Prerequisites

Ensure you have the following installed:
- **Bun** 1.0+ (`bun --version`)
- **Node.js** 20+ (`node --version`)
- **npm** (`npm --version`)

For headless-session-manager, you'll need Playwright browsers installed:
```bash
cd headless-session-manager && npm run playwright:install
```

---

## Quick Start

### Option 1: Start All Services (Recommended)

From the repository root:

```bash
./start-all.sh
```

This will:
1. Start all 5 services
2. Wait for each service to be healthy
3. Display the URL for the chat interface

To stop all services:
```bash
./stop-all.sh
```

### Option 2: Start Services Manually

Open 5 terminal windows and run each service:

```bash
# Terminal 1: shop-api (port 3000)
cd shop-api && bun run dev

# Terminal 2: shop-ui (port 4200)
cd shop-ui && npm start

# Terminal 3: headless-session-manager (port 3002)
cd headless-session-manager && npm run dev

# Terminal 4: mcp-tools (port 3001)
cd mcp-tools && bun run dev

# Terminal 5: chat-ui (port 5173)
cd chat-ui && bun run dev
```

---

## Demo Flow

### 1. Open the Chat Interface

Open your browser to: **http://localhost:5173**

You'll see:
- A chat panel on the left
- A context panel on the right (cart summary, session info, quick tips)

### 2. Set Your Customer ID

Type:
```
my customer id is 123456
```

**Expected result:**
- Assistant responds with confirmation
- Session Info panel updates to show "Customer: 123456"

### 3. Search for Products

Type:
```
show me hammers
```

**Expected result:**
- Assistant invokes the `search_products` tool
- Product cards appear showing hammer products from the catalog
- Each card displays: name, price, SKU, and stock status

### 4. Add Item to Cart

Type:
```
add it to my cart
```

**Expected result:**
- Assistant invokes the `add_to_cart` tool
- This triggers a headless browser session that:
  - Loads shop-ui in automation mode
  - Dispatches an NgRx action via the automation bridge
  - Waits for success/failure response
- Confirmation card shows the added item
- Cart Summary panel updates with the new item

### 5. View Cart Contents

Type:
```
what's in my cart
```

**Expected result:**
- Assistant invokes the `get_cart` tool
- Cart contents card shows all items, quantities, and total

### 6. Continue Shopping

Try additional commands:
- `"find screwdrivers"` - Search for more products
- `"add the screwdriver to cart"` - Add another item
- `"show me power tools"` - Browse different categories

---

## Demo Commands Reference

| Command | Tool Invoked | Description |
|---------|--------------|-------------|
| `my customer id is X` | `set_customer_id` | Set customer context |
| `show me [product]` | `search_products` | Search product catalog |
| `find [product]` | `search_products` | Search product catalog |
| `search for [product]` | `search_products` | Search product catalog |
| `add it to my cart` | `add_to_cart` | Add last viewed product |
| `add [product] to cart` | `add_to_cart` | Add specific product |
| `what's in my cart` | `get_cart` | View cart contents |
| `show my cart` | `get_cart` | View cart contents |

---

## Resetting the Demo

1. Click the **Reset Session** button in the Session Info panel
2. This clears the conversation and cart state
3. You can start a fresh demo flow

---

## Troubleshooting

### Services won't start
- Check if ports are already in use: `lsof -i :3000 -i :3001 -i :3002 -i :4200 -i :5173`
- Run `./stop-all.sh` to stop existing services
- Check logs in `.logs/` directory

### Chat UI shows "Cannot connect to tool server"
- Ensure mcp-tools is running: `curl http://localhost:3001/health`
- Check mcp-tools logs: `cat .logs/mcp-tools.log`

### Add to cart fails
- Ensure headless-session-manager is running: `curl http://localhost:3002/health`
- Ensure shop-ui is running: `curl http://localhost:4200`
- Playwright browsers must be installed: `cd headless-session-manager && npm run playwright:install`

### Products not found
- Ensure shop-api is running: `curl http://localhost:3000/health`
- Check available products: `curl http://localhost:3000/api/products`

---

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| chat-ui | http://localhost:5173 | Main chat interface |
| shop-ui | http://localhost:4200 | Angular shopping SPA |
| shop-ui (automation) | http://localhost:4200?automation=1 | SPA with agent bridge |
| shop-api | http://localhost:3000 | Products & cart REST API |
| mcp-tools | http://localhost:3001 | MCP tool server |
| headless-session-manager | http://localhost:3002 | Headless browser manager |

---

## What This Demo Proves

1. **Chat-driven shopping**: Natural language commands execute real shopping workflows
2. **Tool-based execution**: Every action is auditable via structured tool calls/results
3. **NgRx reuse**: Existing SPA orchestration works without server-side reimplementation
4. **Zero-cost operation**: Scripted agent mode requires no paid AI services
5. **Deterministic demos**: Pattern matching ensures consistent, repeatable results

---

## Architecture Highlights

The demo showcases a unique architecture where:

1. **Stateless tools** (search, get cart) route directly to shop-api
2. **Stateful tools** (add to cart) route through headless-session-manager
3. The headless browser runs the real Angular SPA with NgRx
4. Actions dispatch through `window.__agentBridge.dispatchAndWait()`
5. Results propagate back through the tool chain to the chat UI

This proves that AI-powered shopping can reuse existing frontend orchestration without rebuilding backend logic.
