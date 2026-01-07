import type { Cart, CartItem } from "../types.ts";

const carts = new Map<string, Cart>();

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export function createCart(customerId: string): Cart {
  const cart: Cart = {
    id: generateId(),
    customerId,
    items: [],
    createdAt: now(),
    updatedAt: now(),
  };
  carts.set(cart.id, cart);
  return cart;
}

export function getCart(cartId: string): Cart | undefined {
  return carts.get(cartId);
}

export function getOrCreateCart(cartId: string, customerId: string): Cart {
  let cart = carts.get(cartId);
  if (!cart) {
    cart = {
      id: cartId,
      customerId,
      items: [],
      createdAt: now(),
      updatedAt: now(),
    };
    carts.set(cartId, cart);
  }
  return cart;
}

export function addItem(cartId: string, sku: string, quantity: number): Cart | undefined {
  const cart = carts.get(cartId);
  if (!cart) return undefined;

  const existingItem = cart.items.find((item) => item.sku === sku);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ sku, quantity });
  }
  cart.updatedAt = now();
  return cart;
}

export function updateItem(cartId: string, sku: string, quantity: number): Cart | undefined {
  const cart = carts.get(cartId);
  if (!cart) return undefined;

  const item = cart.items.find((item) => item.sku === sku);
  if (!item) return undefined;

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => item.sku !== sku);
  } else {
    item.quantity = quantity;
  }
  cart.updatedAt = now();
  return cart;
}

export function removeItem(cartId: string, sku: string): Cart | undefined {
  const cart = carts.get(cartId);
  if (!cart) return undefined;

  const itemIndex = cart.items.findIndex((item) => item.sku === sku);
  if (itemIndex === -1) return undefined;

  cart.items.splice(itemIndex, 1);
  cart.updatedAt = now();
  return cart;
}
