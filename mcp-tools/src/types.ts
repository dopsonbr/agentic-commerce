import { z } from 'zod';

// Product schemas - aligned with shop-api
export const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  inventory: z.number(),
  imageUrl: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

// Cart item schemas
export const CartItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

// Raw cart item from shop-api (only sku and quantity)
export const RawCartItemSchema = z.object({
  sku: z.string(),
  quantity: z.number(),
});

export type RawCartItem = z.infer<typeof RawCartItemSchema>;

// Cart schema from shop-api
export const CartSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  items: z.array(RawCartItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Cart = z.infer<typeof CartSchema>;

// Session context for managing chat sessions
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

// Bridge result from headless-session-manager
export interface BridgeResult {
  success: boolean;
  action?: Record<string, unknown>;
  error?: string;
  state?: {
    products: {
      items: unknown[];
      loading: boolean;
      error: string | null;
    };
    cart: {
      id: string | null;
      customerId: string | null;
      items: unknown[];
      loading: boolean;
      error: string | null;
    };
  };
}
