# Shop API

A REST API for product catalog and shopping cart management, built with Bun and TypeScript.

## Features

- **Products API** - Browse and search product catalog
- **Cart API** - Create and manage shopping carts with customer tracking
- **In-memory storage** - No database required (proof of concept)
- **OpenAPI spec** - Full API documentation in `openapi.yaml`

## Quick Start

```bash
# Install dependencies
bun install

# Run with hot reload (development)
bun run dev

# Run production
bun run start
```

Server runs at `http://localhost:3000`

## API Endpoints

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products?search=keyword` | Search by SKU or name |
| GET | `/api/products/:sku` | Get product by SKU |

### Cart

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cart` | Create new cart |
| GET | `/api/cart/:id?customerId=` | Get or auto-create cart |
| POST | `/api/cart/:id/items` | Add item to cart |
| PUT | `/api/cart/:id/items/:sku` | Update item quantity |
| DELETE | `/api/cart/:id/items/:sku` | Remove item from cart |

## Documentation

- **[CLIENT_GUIDE.md](./CLIENT_GUIDE.md)** - Frontend developer guide with examples
- **[openapi.yaml](./openapi.yaml)** - OpenAPI 3.0 specification

## Project Structure

```
shop-api/
├── index.ts                 # Server entry point
├── src/
│   ├── types.ts             # TypeScript interfaces
│   ├── data/
│   │   └── products.json    # Seed data (10 products)
│   ├── routes/
│   │   ├── products.ts      # Product endpoints
│   │   └── cart.ts          # Cart endpoints
│   └── store/
│       └── cart-store.ts    # In-memory cart storage
├── openapi.yaml             # API specification
└── CLIENT_GUIDE.md          # Frontend guide
```

## Tech Stack

- [Bun](https://bun.sh) - JavaScript runtime and toolkit
- TypeScript - Type safety
- `Bun.serve()` - HTTP server with built-in routing
