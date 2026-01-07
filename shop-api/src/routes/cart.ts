import {
  createCart,
  getCart,
  getOrCreateCart,
  addItem,
  updateItem,
  removeItem,
} from "../store/cart-store.ts";
import { json } from "../cors.ts";

export const cartRoutes = {
  "/api/cart": {
    POST: async (req: Request) => {
      const body = await req.json();
      const { customerId } = body;

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

      const body = await req.json();
      const { sku, quantity } = body;

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

      const body = await req.json();
      const { quantity } = body;

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
