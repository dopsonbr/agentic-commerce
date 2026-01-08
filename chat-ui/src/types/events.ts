export type ChatEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | ErrorEvent;

export interface UserMessageEvent {
  type: 'user_message';
  id: string;
  content: string;
  timestamp: number;
}

export interface AssistantMessageEvent {
  type: 'assistant_message';
  id: string;
  content: string;
  timestamp: number;
}

export interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  callId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  timestamp: number;
}

export interface ErrorEvent {
  type: 'error';
  id: string;
  message: string;
  timestamp: number;
}

// Tool result shapes (matches mcp-tools output schemas)
export interface ProductResult {
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

export interface SearchProductsResult {
  products: ProductResult[];
  total: number;
}

export interface CartItemResult {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export interface AddToCartResult {
  success: boolean;
  cartId: string;
  item: CartItemResult;
}

export interface GetCartResult {
  cartId: string;
  customerId: string | null;
  items: CartItemResult[];
  total: number;
}

export interface SetCustomerIdResult {
  success: boolean;
  customerId: string;
}
