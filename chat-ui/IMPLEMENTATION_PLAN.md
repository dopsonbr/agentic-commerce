# chat-ui Implementation Plan

This plan details implementing the chat interface with scripted agent mode for the agentic shopping POC.

## Overview

The chat-ui provides a conversational interface where users interact with shopping tools via natural language. It features a **scripted agent mode** that uses pattern matching to invoke tools without requiring an LLM.

## Prerequisites

- Bun installed
- mcp-tools running at `http://localhost:3001`
- Existing React/Bun scaffold in place

## Dependencies

- Depends on: **mcp-tools** (for tool execution)
- mcp-tools depends on: **shop-api** and **headless-session-manager**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              chat-ui (:5173)                                │
│                                                                             │
│  ┌─────────────────────────────────────┬───────────────────────────────┐   │
│  │        Conversation Panel           │        Context Panel          │   │
│  │                                     │                               │   │
│  │  ┌───────────────────────────────┐ │  ┌─────────────────────────┐  │   │
│  │  │      MessageList              │ │  │      CartSummary        │  │   │
│  │  │                               │ │  │                         │  │   │
│  │  │  ┌─────────────────────────┐  │ │  │  Items: 2               │  │   │
│  │  │  │ UserMessage             │  │ │  │  Total: $49.98          │  │   │
│  │  │  └─────────────────────────┘  │ │  │                         │  │   │
│  │  │  ┌─────────────────────────┐  │ │  │  ┌───────────────────┐  │  │   │
│  │  │  │ ToolCallCard            │  │ │  │  │ CartItem          │  │  │   │
│  │  │  │  └─ ToolResultCard      │  │ │  │  │ CartItem          │  │  │   │
│  │  │  └─────────────────────────┘  │ │  │  └───────────────────┘  │  │   │
│  │  │  ┌─────────────────────────┐  │ │  └─────────────────────────┘  │   │
│  │  │  │ AssistantMessage        │  │ │                               │   │
│  │  │  └─────────────────────────┘  │ │  ┌─────────────────────────┐  │   │
│  │  └───────────────────────────────┘ │  │      SessionInfo        │  │   │
│  │                                     │  │                         │  │   │
│  │  ┌───────────────────────────────┐ │  │  Customer: 123456       │  │   │
│  │  │      MessageInput             │ │  │  Session: abc-xyz       │  │   │
│  │  └───────────────────────────────┘ │  └─────────────────────────┘  │   │
│  └─────────────────────────────────────┴───────────────────────────────┘   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         State Management                               │ │
│  │                                                                        │ │
│  │   useChat()           → events[], sessionId, customerId, cart          │ │
│  │   useScriptedAgent()  → processMessage(text) → tool + args             │ │
│  │   useToolExecution()  → callTool(name, args) → result                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Event Types

**File:** `src/types/events.ts`

```typescript
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

// Tool result shapes
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
```

### Step 2: Create MCP Client Service

**File:** `src/services/mcp-client.ts`

```typescript
const MCP_TOOLS_URL = 'http://localhost:3001';

export interface ToolCallResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

export async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string
): Promise<ToolCallResult<T>> {
  try {
    const response = await fetch(`${MCP_TOOLS_URL}/tools/${toolName}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, args }),
    });

    const data = await response.json();
    return data as ToolCallResult<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function listTools(): Promise<unknown[]> {
  try {
    const response = await fetch(`${MCP_TOOLS_URL}/tools`);
    return response.json();
  } catch {
    return [];
  }
}
```

### Step 3: Create Scripted Agent Hook

**File:** `src/hooks/useScriptedAgent.ts`

```typescript
interface AgentPattern {
  match: RegExp;
  tool: string;
  extractArgs: (match: RegExpMatchArray, context: AgentContext) => Record<string, unknown>;
  response: (result: unknown) => string;
}

interface AgentContext {
  lastProductSku: string | null;
  lastProductName: string | null;
  customerId: string | null;
}

interface AgentDecision {
  tool: string | null;
  args: Record<string, unknown>;
  fallbackMessage: string | null;
}

const patterns: AgentPattern[] = [
  // Set customer ID
  {
    match: /(?:my\s+)?customer\s*(?:id\s*)?(?:is\s+)?(\d+)/i,
    tool: 'set_customer_id',
    extractArgs: (match) => ({ customerId: match[1] }),
    response: (result: any) => `Got it! I've set your customer ID to ${result.customerId}.`,
  },
  // Search products
  {
    match: /(?:show|find|search|look\s+for|get)\s+(?:me\s+)?(?:info\s+(?:about|on)\s+)?(?:a\s+)?(.+?)(?:\s+please)?$/i,
    tool: 'search_products',
    extractArgs: (match) => ({ query: match[1].trim(), limit: 5 }),
    response: (result: any) => {
      const count = result.products?.length ?? 0;
      return count > 0
        ? `I found ${count} product${count > 1 ? 's' : ''} matching your search.`
        : `I couldn't find any products matching that search.`;
    },
  },
  // Add to cart
  {
    match: /add\s+(?:the\s+)?(?:(.+?)\s+)?to\s+(?:my\s+)?cart/i,
    tool: 'add_to_cart',
    extractArgs: (match, context) => ({
      sku: context.lastProductSku || '',
      quantity: 1,
    }),
    response: (result: any) =>
      result.success
        ? `Added ${result.item?.name || 'item'} to your cart.`
        : `Sorry, I couldn't add that to your cart.`,
  },
  // Get cart
  {
    match: /(?:what'?s?\s+in\s+my\s+cart|show\s+(?:my\s+)?cart|cart\s+contents|view\s+cart)/i,
    tool: 'get_cart',
    extractArgs: () => ({}),
    response: (result: any) => {
      const items = result.items?.length ?? 0;
      if (items === 0) return `Your cart is empty.`;
      return `Your cart has ${items} item${items > 1 ? 's' : ''} totaling $${result.total?.toFixed(2) || '0.00'}.`;
    },
  },
];

export function useScriptedAgent() {
  function processMessage(
    message: string,
    context: AgentContext
  ): AgentDecision {
    const normalizedMessage = message.trim();

    for (const pattern of patterns) {
      const match = normalizedMessage.match(pattern.match);
      if (match) {
        return {
          tool: pattern.tool,
          args: pattern.extractArgs(match, context),
          fallbackMessage: null,
        };
      }
    }

    return {
      tool: null,
      args: {},
      fallbackMessage: getDefaultResponse(normalizedMessage),
    };
  }

  function getResponseForResult(toolName: string, result: unknown): string {
    const pattern = patterns.find(p => p.tool === toolName);
    return pattern?.response(result) ?? 'Done.';
  }

  return { processMessage, getResponseForResult };
}

function getDefaultResponse(message: string): string {
  const greetings = /^(hi|hello|hey|howdy)/i;
  const help = /^(help|what can you do)/i;

  if (greetings.test(message)) {
    return "Hello! I can help you search for products, add items to your cart, and view your cart. What would you like to do?";
  }

  if (help.test(message)) {
    return `I can help you with:
• **Search products**: "show me hammers" or "find screwdrivers"
• **Add to cart**: "add the hammer to my cart"
• **View cart**: "what's in my cart"
• **Set customer ID**: "my customer id is 123456"`;
  }

  return "I'm not sure how to help with that. Try searching for a product or asking what's in your cart.";
}
```

### Step 4: Create Chat State Hook

**File:** `src/hooks/useChat.ts`

```typescript
import { useState, useCallback } from 'react';
import type { ChatEvent, GetCartResult } from '../types/events';
import { callTool } from '../services/mcp-client';
import { useScriptedAgent } from './useScriptedAgent';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function useChat() {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [sessionId] = useState(() => `chat-${generateId()}`);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [cart, setCart] = useState<GetCartResult | null>(null);
  const [lastProductSku, setLastProductSku] = useState<string | null>(null);
  const [lastProductName, setLastProductName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { processMessage, getResponseForResult } = useScriptedAgent();

  const addEvent = useCallback((event: ChatEvent) => {
    setEvents(prev => [...prev, event]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isProcessing) return;

    setIsProcessing(true);

    // Add user message
    const userEvent: ChatEvent = {
      type: 'user_message',
      id: generateId(),
      content,
      timestamp: Date.now(),
    };
    addEvent(userEvent);

    // Process with scripted agent
    const context = { lastProductSku, lastProductName, customerId };
    const decision = processMessage(content, context);

    if (decision.tool) {
      // Execute tool
      const callId = generateId();

      // Add tool call event
      const toolCallEvent: ChatEvent = {
        type: 'tool_call',
        id: generateId(),
        callId,
        toolName: decision.tool,
        args: decision.args,
        timestamp: Date.now(),
      };
      addEvent(toolCallEvent);

      // Call the tool
      const result = await callTool(decision.tool, decision.args, sessionId);

      // Add tool result event
      const toolResultEvent: ChatEvent = {
        type: 'tool_result',
        id: generateId(),
        callId,
        toolName: decision.tool,
        success: result.success,
        result: result.result,
        error: result.error,
        timestamp: Date.now(),
      };
      addEvent(toolResultEvent);

      // Update local state based on tool
      if (result.success && result.result) {
        updateStateFromToolResult(decision.tool, result.result);
      }

      // Add assistant response
      const responseMessage = result.success
        ? getResponseForResult(decision.tool, result.result)
        : `Sorry, something went wrong: ${result.error}`;

      const assistantEvent: ChatEvent = {
        type: 'assistant_message',
        id: generateId(),
        content: responseMessage,
        timestamp: Date.now(),
      };
      addEvent(assistantEvent);
    } else {
      // No tool matched, use fallback response
      const assistantEvent: ChatEvent = {
        type: 'assistant_message',
        id: generateId(),
        content: decision.fallbackMessage || "I'm not sure how to help with that.",
        timestamp: Date.now(),
      };
      addEvent(assistantEvent);
    }

    setIsProcessing(false);
  }, [isProcessing, sessionId, customerId, lastProductSku, lastProductName, processMessage, getResponseForResult, addEvent]);

  const updateStateFromToolResult = useCallback((toolName: string, result: unknown) => {
    switch (toolName) {
      case 'set_customer_id':
        setCustomerId((result as any).customerId);
        break;
      case 'search_products':
        const products = (result as any).products;
        if (products?.length > 0) {
          setLastProductSku(products[0].sku);
          setLastProductName(products[0].name);
        }
        break;
      case 'add_to_cart':
      case 'get_cart':
        setCart(result as GetCartResult);
        break;
    }
  }, []);

  const refreshCart = useCallback(async () => {
    const result = await callTool<GetCartResult>('get_cart', {}, sessionId);
    if (result.success && result.result) {
      setCart(result.result);
    }
  }, [sessionId]);

  return {
    events,
    sessionId,
    customerId,
    cart,
    isProcessing,
    sendMessage,
    refreshCart,
  };
}
```

### Step 5: Create UI Components

**File:** `src/components/MessageList.tsx`

```tsx
import React from 'react';
import type { ChatEvent } from '../types/events';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ToolCallCard } from './ToolCallCard';

interface Props {
  events: ChatEvent[];
}

export function MessageList({ events }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {events.map(event => {
        switch (event.type) {
          case 'user_message':
            return <UserMessage key={event.id} content={event.content} />;
          case 'assistant_message':
            return <AssistantMessage key={event.id} content={event.content} />;
          case 'tool_call':
            // Find matching result
            const result = events.find(
              e => e.type === 'tool_result' && e.callId === event.callId
            );
            return (
              <ToolCallCard
                key={event.id}
                toolName={event.toolName}
                args={event.args}
                result={result?.type === 'tool_result' ? result : undefined}
              />
            );
          case 'tool_result':
            return null; // Rendered with tool_call
          case 'error':
            return (
              <div key={event.id} className="text-red-500 p-2">
                Error: {event.message}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
```

**File:** `src/components/UserMessage.tsx`

```tsx
import React from 'react';

interface Props {
  content: string;
}

export function UserMessage({ content }: Props) {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[80%]">
        {content}
      </div>
    </div>
  );
}
```

**File:** `src/components/AssistantMessage.tsx`

```tsx
import React from 'react';

interface Props {
  content: string;
}

export function AssistantMessage({ content }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-[80%]">
        {content}
      </div>
    </div>
  );
}
```

**File:** `src/components/ToolCallCard.tsx`

```tsx
import React from 'react';
import type { ToolResultEvent } from '../types/events';
import { ProductCard } from './ProductCard';
import { CartCard } from './CartCard';

interface Props {
  toolName: string;
  args: Record<string, unknown>;
  result?: ToolResultEvent;
}

export function ToolCallCard({ toolName, args, result }: Props) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="text-xs text-gray-500 mb-2">
        🔧 Tool: <span className="font-mono">{toolName}</span>
      </div>

      {result ? (
        result.success ? (
          <ToolResultRenderer toolName={toolName} result={result.result} />
        ) : (
          <div className="text-red-500">Error: {result.error}</div>
        )
      ) : (
        <div className="text-gray-400">Loading...</div>
      )}
    </div>
  );
}

function ToolResultRenderer({ toolName, result }: { toolName: string; result: unknown }) {
  switch (toolName) {
    case 'search_products':
      const searchResult = result as { products: any[]; total: number };
      return (
        <div className="space-y-2">
          {searchResult.products.map(product => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </div>
      );

    case 'get_product_details':
      return <ProductCard product={result as any} />;

    case 'add_to_cart':
      const addResult = result as { success: boolean; item: any };
      return (
        <div className="text-green-600">
          ✓ Added {addResult.item.name} (${addResult.item.price})
        </div>
      );

    case 'get_cart':
      return <CartCard cart={result as any} />;

    case 'set_customer_id':
      const idResult = result as { customerId: string };
      return <div className="text-green-600">✓ Customer ID set to {idResult.customerId}</div>;

    default:
      return <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>;
  }
}
```

**File:** `src/components/ProductCard.tsx`

```tsx
import React from 'react';

interface Props {
  product: {
    sku: string;
    name: string;
    description: string;
    price: number;
    category: string;
    inStock: boolean;
  };
}

export function ProductCard({ product }: Props) {
  return (
    <div className="border rounded p-3 bg-white">
      <div className="font-medium">{product.name}</div>
      <div className="text-sm text-gray-600">{product.description}</div>
      <div className="flex justify-between items-center mt-2">
        <span className="font-bold">${product.price.toFixed(2)}</span>
        <span className="text-xs text-gray-500">SKU: {product.sku}</span>
      </div>
      <div className={`text-xs mt-1 ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
        {product.inStock ? 'In Stock' : 'Out of Stock'}
      </div>
    </div>
  );
}
```

**File:** `src/components/CartCard.tsx`

```tsx
import React from 'react';

interface Props {
  cart: {
    cartId: string;
    items: Array<{
      sku: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    total: number;
  };
}

export function CartCard({ cart }: Props) {
  if (cart.items.length === 0) {
    return <div className="text-gray-500">Your cart is empty</div>;
  }

  return (
    <div className="space-y-2">
      {cart.items.map(item => (
        <div key={item.sku} className="flex justify-between text-sm">
          <span>{item.name} x{item.quantity}</span>
          <span>${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      ))}
      <div className="border-t pt-2 flex justify-between font-bold">
        <span>Total</span>
        <span>${cart.total.toFixed(2)}</span>
      </div>
    </div>
  );
}
```

**File:** `src/components/MessageInput.tsx`

```tsx
import React, { useState } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value);
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
```

**File:** `src/components/CartSummary.tsx`

```tsx
import React from 'react';
import type { GetCartResult } from '../types/events';

interface Props {
  cart: GetCartResult | null;
}

export function CartSummary({ cart }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-bold mb-3">🛒 Cart</h3>

      {!cart || cart.items.length === 0 ? (
        <div className="text-gray-500 text-sm">Empty</div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {cart.items.map(item => (
              <div key={item.sku} className="text-sm flex justify-between">
                <span>{item.name} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 font-bold flex justify-between">
            <span>Total</span>
            <span>${cart.total.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
```

**File:** `src/components/SessionInfo.tsx`

```tsx
import React from 'react';

interface Props {
  sessionId: string;
  customerId: string | null;
}

export function SessionInfo({ sessionId, customerId }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-bold mb-3">📋 Session</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Session:</span>
          <span className="font-mono text-xs">{sessionId.slice(0, 12)}...</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Customer:</span>
          <span>{customerId || '—'}</span>
        </div>
      </div>
    </div>
  );
}
```

### Step 6: Create Main Chat Container

**File:** `src/components/ChatContainer.tsx`

```tsx
import React from 'react';
import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { CartSummary } from './CartSummary';
import { SessionInfo } from './SessionInfo';

export function ChatContainer() {
  const { events, sessionId, customerId, cart, isProcessing, sendMessage } = useChat();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Conversation Panel */}
      <div className="flex-1 flex flex-col bg-white">
        <header className="border-b p-4">
          <h1 className="text-xl font-bold">Agentic Shopping Chat</h1>
          <p className="text-sm text-gray-500">Scripted Agent Mode</p>
        </header>

        <div className="flex-1 overflow-y-auto">
          <MessageList events={events} />
        </div>

        <MessageInput onSend={sendMessage} disabled={isProcessing} />
      </div>

      {/* Context Panel */}
      <div className="w-80 border-l bg-gray-50 p-4 space-y-4">
        <CartSummary cart={cart} />
        <SessionInfo sessionId={sessionId} customerId={customerId} />
      </div>
    </div>
  );
}
```

### Step 7: Update App Entry

**File:** `src/App.tsx`

```tsx
import React from 'react';
import { ChatContainer } from './components/ChatContainer';

export default function App() {
  return <ChatContainer />;
}
```

---

## File Structure

```
chat-ui/
├── src/
│   ├── index.ts              # Server entry (Bun.serve)
│   ├── index.html            # HTML entry
│   ├── frontend.tsx          # React entry
│   ├── App.tsx               # Main app component
│   ├── types/
│   │   └── events.ts         # Event type definitions
│   ├── services/
│   │   └── mcp-client.ts     # MCP tools API client
│   ├── hooks/
│   │   ├── useChat.ts        # Chat state management
│   │   └── useScriptedAgent.ts  # Pattern matching agent
│   └── components/
│       ├── ChatContainer.tsx
│       ├── MessageList.tsx
│       ├── MessageInput.tsx
│       ├── UserMessage.tsx
│       ├── AssistantMessage.tsx
│       ├── ToolCallCard.tsx
│       ├── ProductCard.tsx
│       ├── CartCard.tsx
│       ├── CartSummary.tsx
│       └── SessionInfo.tsx
├── styles/
│   └── globals.css
├── package.json
└── IMPLEMENTATION_PLAN.md
```

---

## Scripted Agent Patterns

| Input Pattern | Tool Called | Example Input |
|--------------|-------------|---------------|
| `customer id is X` | `set_customer_id` | "my customer id is 123456" |
| `show/find/search X` | `search_products` | "show me hammers" |
| `add X to cart` | `add_to_cart` | "add the hammer to my cart" |
| `what's in my cart` | `get_cart` | "what's in my cart" |
| `help` | (none) | "help" |
| `hello/hi` | (none) | "hello" |

---

## Testing

```bash
# Start dependencies
cd ../shop-api && bun run dev &
cd ../headless-session-manager && npm run dev &
cd ../mcp-tools && bun run dev &

# Start chat-ui
bun run dev

# Open http://localhost:5173
```

### Test Script

1. Type: "my customer id is 123456" → Should set customer ID
2. Type: "show me hammers" → Should display product cards
3. Type: "add it to my cart" → Should show confirmation
4. Type: "what's in my cart" → Should display cart contents

---

## Acceptance Criteria

- [x] Chat interface renders with conversation and context panels
- [x] User messages appear in chat
- [x] Scripted agent matches patterns correctly
- [x] Tool calls display with loading state
- [x] Tool results render appropriate cards
- [x] Cart summary updates after add_to_cart
- [x] Session info shows customer ID
- [x] Help/greeting messages work

## Additional Features Implemented

- [x] Auto-scroll to latest message
- [x] Session reset button
- [x] Quick tips panel for user guidance
- [x] Tool args displayed in tool call cards
- [x] Defensive error handling for empty SKU
- [x] Pattern priority fix (get_cart before search_products)

## Unit Tests

- [x] Pattern matching tests (25 tests)
- [x] MCP client tests with fetch mocking (10 tests)
- [x] Cart state logic tests (16 tests)
- All 51 tests passing

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5173` | Dev server port |
| `MCP_TOOLS_URL` | `http://localhost:3001` | mcp-tools API URL |
