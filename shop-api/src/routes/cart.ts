import {
  createCart,
  getCart,
  getOrCreateCart,
  addItem,
  updateItem,
  removeItem,
} from "../store/cart-store.ts";
import { json } from "../cors.ts";

// Helper to safely parse JSON body
async function parseJsonBody<T extends object>(req: Request): Promise<{ data: T } | { error: Response }> {
  try {
    const data = await req.json();
    // Validate that the body is an object (not null, array, or primitive)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { error: json({ error: "Request body must be a JSON object" }, { status: 400 }) };
    }
    return { data: data as T };
  } catch {
    return { error: json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

export const cartRoutes = {
  "/api/cart": {
    POST: async (req: Request) => {
      const parsed = await parseJsonBody<{ customerId?: string }>(req);
      if ('error' in parsed) return parsed.error;
      const { customerId } = parsed.data;

      if (!customerId) {
        return json({ error: "customerId is required" }, { status: 400 });
      }

      const cart = createCart(customerId);
      return json(cart, { status: 201 });
    },
  },
  "/api/cart/:cart_id": {
    GET: (req: Request & { params: { cart_id: string } }) => {
      const url = new URL(req.url);
      const customerId = url.searchParams.get("customerId");

      if (!customerId) {
        return json(
          { error: "customerId query parameter is required" },
          { status: 400 }
        );
      }

      const cart = getOrCreateCart(req.params.cart_id, customerId);
      return json(cart);
    },
  },
  "/api/cart/:cart_id/items": {
    POST: async (req: Request & { params: { cart_id: string } }) => {
      const cart = getCart(req.params.cart_id);
      if (!cart) {
        return json({ error: "Cart not found" }, { status: 404 });
      }

      const parsed = await parseJsonBody<{ sku?: string; quantity?: number }>(req);
      if ('error' in parsed) return parsed.error;
      const { sku, quantity } = parsed.data;

      if (!sku || typeof quantity !== "number" || quantity <= 0) {
        return json(
          { error: "sku and positive quantity are required" },
          { status: 400 }
        );
      }

      const updatedCart = addItem(req.params.cart_id, sku, quantity);
      return json(updatedCart);
    },
  },
  "/api/cart/:cart_id/items/:sku": {
    PUT: async (req: Request & { params: { cart_id: string; sku: string } }) => {
      const cart = getCart(req.params.cart_id);
      if (!cart) {
        return json({ error: "Cart not found" }, { status: 404 });
      }

      const parsed = await parseJsonBody<{ quantity?: number }>(req);
      if ('error' in parsed) return parsed.error;
      const { quantity } = parsed.data;

      if (typeof quantity !== "number") {
        return json({ error: "quantity is required" }, { status: 400 });
      }

      const updatedCart = updateItem(req.params.cart_id, req.params.sku, quantity);
      if (!updatedCart) {
        return json({ error: "Item not found in cart" }, { status: 404 });
      }

      return json(updatedCart);
    },
    DELETE: (req: Request & { params: { cart_id: string; sku: string } }) => {
      const cart = getCart(req.params.cart_id);
      if (!cart) {
        return json({ error: "Cart not found" }, { status: 404 });
      }

      const updatedCart = removeItem(req.params.cart_id, req.params.sku);
      if (!updatedCart) {
        return json({ error: "Item not found in cart" }, { status: 404 });
      }

      return json(updatedCart);
    },
  },
};
