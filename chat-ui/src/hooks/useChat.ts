import { useState, useCallback } from 'react';
import type { ChatEvent, GetCartResult, SearchProductsResult, AddToCartResult, SetCustomerIdResult } from '../types/events';
import { callTool } from '../services/mcp-client';
import { useScriptedAgent } from './useScriptedAgent';
import {
  logUserMessage,
  logPatternMatch,
  logToolInvocation,
  logToolResult,
} from '../observability/faro';

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

  const updateStateFromToolResult = useCallback((toolName: string, result: unknown) => {
    switch (toolName) {
      case 'set_customer_id': {
        const r = result as SetCustomerIdResult;
        setCustomerId(r.customerId);
        break;
      }
      case 'search_products': {
        const r = result as SearchProductsResult;
        const firstProduct = r.products?.[0];
        if (firstProduct) {
          setLastProductSku(firstProduct.sku);
          setLastProductName(firstProduct.name);
        }
        break;
      }
      case 'add_to_cart': {
        const r = result as AddToCartResult;
        // Update cart with add result, then fetch full cart
        if (r.success) {
          setCart(prev => {
            if (!prev) {
              return {
                cartId: r.cartId,
                customerId: customerId,
                items: [r.item],
                total: r.item.price * r.item.quantity,
              };
            }
            // Check if item already exists
            const existingIndex = prev.items.findIndex(i => i.sku === r.item.sku);
            if (existingIndex >= 0) {
              const newItems = [...prev.items];
              const existingItem = newItems[existingIndex];
              if (existingItem) {
                newItems[existingIndex] = {
                  ...existingItem,
                  quantity: existingItem.quantity + r.item.quantity,
                };
              }
              return {
                ...prev,
                items: newItems,
                total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
              };
            }
            const newItems = [...prev.items, r.item];
            return {
              ...prev,
              items: newItems,
              total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
            };
          });
        }
        break;
      }
      case 'get_cart': {
        const r = result as GetCartResult;
        setCart(r);
        break;
      }
    }
  }, [customerId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isProcessing) return;

    setIsProcessing(true);

    // Log user message to Faro
    logUserMessage(content, sessionId);

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

    // Log pattern match result
    logPatternMatch(content, decision.tool, sessionId);

    if (decision.tool) {
      // Log tool invocation
      logToolInvocation(decision.tool, decision.args, sessionId);

      // Execute tool
      const callId = generateId();
      const startTime = Date.now();

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

      const durationMs = Date.now() - startTime;

      // Log tool result
      logToolResult(decision.tool, result.success, durationMs, sessionId, result.error);

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
  }, [isProcessing, sessionId, customerId, lastProductSku, lastProductName, processMessage, getResponseForResult, addEvent, updateStateFromToolResult]);

  const refreshCart = useCallback(async () => {
    const result = await callTool<GetCartResult>('get_cart', {}, sessionId);
    if (result.success && result.result) {
      setCart(result.result);
    }
  }, [sessionId]);

  const resetSession = useCallback(() => {
    setEvents([]);
    setCustomerId(null);
    setCart(null);
    setLastProductSku(null);
    setLastProductName(null);
  }, []);

  return {
    events,
    sessionId,
    customerId,
    cart,
    isProcessing,
    sendMessage,
    refreshCart,
    resetSession,
  };
}
