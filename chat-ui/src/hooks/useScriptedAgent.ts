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
    response: (result: unknown) => {
      const r = result as { customerId: string };
      return `Got it! I've set your customer ID to ${r.customerId}.`;
    },
  },
  // Get cart (MUST come before search_products to avoid "show cart" matching search)
  {
    match: /(?:what'?s?\s+in\s+my\s+cart|show\s+(?:my\s+)?cart|cart\s+contents|view\s+cart)/i,
    tool: 'get_cart',
    extractArgs: () => ({}),
    response: (result: unknown) => {
      const r = result as { items: unknown[]; total: number };
      const items = r.items?.length ?? 0;
      if (items === 0) return `Your cart is empty.`;
      return `Your cart has ${items} item${items > 1 ? 's' : ''} totaling $${r.total?.toFixed(2) || '0.00'}.`;
    },
  },
  // Add to cart
  {
    match: /add\s+(?:the\s+)?(?:(.+?)\s+)?to\s+(?:my\s+)?cart/i,
    tool: 'add_to_cart',
    extractArgs: (_match, context) => {
      if (!context.lastProductSku) {
        // Will trigger an error - handled in response
        return { sku: '', quantity: 1 };
      }
      return {
        sku: context.lastProductSku,
        quantity: 1,
      };
    },
    response: (result: unknown) => {
      const r = result as { success: boolean; item?: { name: string } };
      return r.success
        ? `Added ${r.item?.name || 'item'} to your cart.`
        : `Sorry, I couldn't add that to your cart. Try searching for a product first.`;
    },
  },
  // Search products (handles "show me X", "find X", "search for X", "look for X", "get X")
  {
    match: /(?:show|find|get)\s+(?:me\s+)?(?:info\s+(?:about|on)\s+)?(?:a\s+)?(.+?)(?:\s+please)?$/i,
    tool: 'search_products',
    extractArgs: (match) => ({ query: match[1]?.trim() ?? '', limit: 5 }),
    response: (result: unknown) => {
      const r = result as { products: unknown[]; total: number };
      const count = r.products?.length ?? 0;
      return count > 0
        ? `I found ${count} product${count > 1 ? 's' : ''} matching your search.`
        : `I couldn't find any products matching that search.`;
    },
  },
  // Search products with "for" (handles "search for X", "look for X")
  {
    match: /(?:search|look)\s+for\s+(?:a\s+)?(.+?)(?:\s+please)?$/i,
    tool: 'search_products',
    extractArgs: (match) => ({ query: match[1]?.trim() ?? '', limit: 5 }),
    response: (result: unknown) => {
      const r = result as { products: unknown[]; total: number };
      const count = r.products?.length ?? 0;
      return count > 0
        ? `I found ${count} product${count > 1 ? 's' : ''} matching your search.`
        : `I couldn't find any products matching that search.`;
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
- **Search products**: "show me hammers" or "find screwdrivers"
- **Add to cart**: "add the hammer to my cart"
- **View cart**: "what's in my cart"
- **Set customer ID**: "my customer id is 123456"`;
  }

  return "I'm not sure how to help with that. Try searching for a product or asking what's in your cart.";
}
