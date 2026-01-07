# Shop API Client Guide

Base URL: `http://localhost:3000`

## Products API

### List All Products

```http
GET /api/products
```

**Response:**
```json
[
  {
    "sku": "100001",
    "name": "Fiberglass Claw Hammer 16oz",
    "price": 24.99,
    "description": "Professional-grade 16oz claw hammer...",
    "category": "Hand Tools",
    "inventory": 150,
    "imageUrl": "/images/hammer-16oz.jpg"
  }
]
```

### Search Products

Search by SKU or product name using the `search` query parameter.

```http
GET /api/products?search=hammer
```

**Response:** Array of matching products

### Get Product by SKU

```http
GET /api/products/{sku}
```

**Example:**
```http
GET /api/products/100001
```

**Response:**
```json
{
  "sku": "100001",
  "name": "Fiberglass Claw Hammer 16oz",
  "price": 24.99,
  "description": "Professional-grade 16oz claw hammer...",
  "category": "Hand Tools",
  "inventory": 150,
  "imageUrl": "/images/hammer-16oz.jpg"
}
```

**Error (404):**
```json
{ "error": "Product not found" }
```

---

## Cart API

### Create a New Cart

```http
POST /api/cart
Content-Type: application/json

{
  "customerId": "customer-123"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "customer-123",
  "items": [],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Get Cart (Auto-Creates if Not Found)

```http
GET /api/cart/{cart_id}?customerId={customer_id}
```

**Example:**
```http
GET /api/cart/550e8400-e29b-41d4-a716-446655440000?customerId=customer-123
```

If the cart doesn't exist, it will be created automatically with the provided `customerId`.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "customer-123",
  "items": [],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Add Item to Cart

```http
POST /api/cart/{cart_id}/items
Content-Type: application/json

{
  "sku": "100001",
  "quantity": 2
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "customer-123",
  "items": [
    { "sku": "100001", "quantity": 2 }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

If the item already exists in the cart, the quantity is incremented.

### Update Item Quantity

```http
PUT /api/cart/{cart_id}/items/{sku}
Content-Type: application/json

{
  "quantity": 5
}
```

**Response:** Updated cart object

Setting quantity to 0 or less removes the item from the cart.

### Remove Item from Cart

```http
DELETE /api/cart/{cart_id}/items/{sku}
```

**Response:** Updated cart object

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Missing or invalid parameters |
| 404 | Not Found - Resource doesn't exist |

---

## TypeScript Types

```typescript
interface Product {
  sku: string;
  name: string;
  price: number;
  description: string;
  category: string;
  inventory: number;
  imageUrl: string;
}

interface CartItem {
  sku: string;
  quantity: number;
}

interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Example: Complete Shopping Flow

```typescript
// 1. Browse products
const products = await fetch('/api/products').then(r => r.json());

// 2. Search for a specific product
const hammers = await fetch('/api/products?search=hammer').then(r => r.json());

// 3. Create a cart
const cart = await fetch('/api/cart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customerId: 'user-456' })
}).then(r => r.json());

// 4. Add items to cart
const updatedCart = await fetch(`/api/cart/${cart.id}/items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sku: '100001', quantity: 2 })
}).then(r => r.json());

// 5. Update quantity
await fetch(`/api/cart/${cart.id}/items/100001`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quantity: 3 })
});

// 6. Remove item
await fetch(`/api/cart/${cart.id}/items/100001`, {
  method: 'DELETE'
});
```

---

## Available Products (SKUs)

| SKU | Product |
|-----|---------|
| 100001 | Fiberglass Claw Hammer 16oz |
| 100002 | Carpenter's Pencil 12-Pack |
| 100003 | 2x4 Lumber 8ft Premium Grade |
| 100004 | 20V Cordless Power Drill |
| 100005 | Professional Tape Measure 25ft |
| 100006 | Safety Glasses Clear Lens |
| 100007 | Heavy Duty Work Gloves Large |
| 100008 | Torpedo Level 9-inch |
| 100009 | Screwdriver Set 32-Piece |
| 100010 | Box of Nails 2-inch (5lb) |
