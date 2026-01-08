import { describe, test, expect } from 'bun:test';

// Extract the pattern matching logic for testing without React hooks
// We test the core logic directly

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

// Replicate the patterns from useScriptedAgent.ts for testing
// Order matters! get_cart must come before search_products
const patterns = [
  {
    match: /(?:my\s+)?customer\s*(?:id\s*)?(?:is\s+)?(\d+)/i,
    tool: 'set_customer_id',
    extractArgs: (match: RegExpMatchArray) => ({ customerId: match[1] }),
  },
  // Get cart (MUST come before search_products)
  {
    match: /(?:what'?s?\s+in\s+my\s+cart|show\s+(?:my\s+)?cart|cart\s+contents|view\s+cart)/i,
    tool: 'get_cart',
    extractArgs: () => ({}),
  },
  {
    match: /add\s+(?:the\s+)?(?:(.+?)\s+)?to\s+(?:my\s+)?cart/i,
    tool: 'add_to_cart',
    extractArgs: (_match: RegExpMatchArray, context: AgentContext) => {
      if (!context.lastProductSku) {
        return { sku: '', quantity: 1 };
      }
      return { sku: context.lastProductSku, quantity: 1 };
    },
  },
  // Search products (show/find/get without "for")
  {
    match: /(?:show|find|get)\s+(?:me\s+)?(?:info\s+(?:about|on)\s+)?(?:a\s+)?(.+?)(?:\s+please)?$/i,
    tool: 'search_products',
    extractArgs: (match: RegExpMatchArray) => ({ query: match[1]?.trim() ?? '', limit: 5 }),
  },
  // Search products with "for" (search for X, look for X)
  {
    match: /(?:search|look)\s+for\s+(?:a\s+)?(.+?)(?:\s+please)?$/i,
    tool: 'search_products',
    extractArgs: (match: RegExpMatchArray) => ({ query: match[1]?.trim() ?? '', limit: 5 }),
  },
];

function processMessage(message: string, context: AgentContext): AgentDecision {
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
    fallbackMessage: "I'm not sure how to help with that.",
  };
}

const emptyContext: AgentContext = {
  lastProductSku: null,
  lastProductName: null,
  customerId: null,
};

describe('useScriptedAgent - Pattern Matching', () => {
  describe('set_customer_id patterns', () => {
    test('matches "my customer id is 123456"', () => {
      const result = processMessage('my customer id is 123456', emptyContext);
      expect(result.tool).toBe('set_customer_id');
      expect(result.args).toEqual({ customerId: '123456' });
    });

    test('matches "customer id is 789"', () => {
      const result = processMessage('customer id is 789', emptyContext);
      expect(result.tool).toBe('set_customer_id');
      expect(result.args).toEqual({ customerId: '789' });
    });

    test('matches "customer id 42"', () => {
      const result = processMessage('customer id 42', emptyContext);
      expect(result.tool).toBe('set_customer_id');
      expect(result.args).toEqual({ customerId: '42' });
    });

    test('does not match non-numeric customer id', () => {
      const result = processMessage('my customer id is abc', emptyContext);
      expect(result.tool).not.toBe('set_customer_id');
    });
  });

  describe('search_products patterns', () => {
    test('matches "show me hammers"', () => {
      const result = processMessage('show me hammers', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'hammers', limit: 5 });
    });

    test('matches "find screwdrivers"', () => {
      const result = processMessage('find screwdrivers', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'screwdrivers', limit: 5 });
    });

    test('matches "search for power tools"', () => {
      const result = processMessage('search for power tools', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'power tools', limit: 5 });
    });

    test('matches "look for nails"', () => {
      const result = processMessage('look for nails', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'nails', limit: 5 });
    });

    test('matches "get me a wrench"', () => {
      const result = processMessage('get me a wrench', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'wrench', limit: 5 });
    });

    test('matches "show me info about drills"', () => {
      const result = processMessage('show me info about drills', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'drills', limit: 5 });
    });

    test('matches with "please" suffix', () => {
      const result = processMessage('find hammers please', emptyContext);
      expect(result.tool).toBe('search_products');
      expect(result.args).toEqual({ query: 'hammers', limit: 5 });
    });

    test('trims whitespace from query', () => {
      const result = processMessage('show me   hammers  ', emptyContext);
      expect(result.tool).toBe('search_products');
      expect((result.args as { query: string }).query).toBe('hammers');
    });
  });

  describe('add_to_cart patterns', () => {
    const contextWithProduct: AgentContext = {
      lastProductSku: '100003',
      lastProductName: 'Claw Hammer',
      customerId: '123',
    };

    test('matches "add it to my cart" with context', () => {
      const result = processMessage('add it to my cart', contextWithProduct);
      expect(result.tool).toBe('add_to_cart');
      expect(result.args).toEqual({ sku: '100003', quantity: 1 });
    });

    test('matches "add the hammer to cart"', () => {
      const result = processMessage('add the hammer to cart', contextWithProduct);
      expect(result.tool).toBe('add_to_cart');
      expect(result.args).toEqual({ sku: '100003', quantity: 1 });
    });

    test('matches "add to my cart"', () => {
      const result = processMessage('add to my cart', contextWithProduct);
      expect(result.tool).toBe('add_to_cart');
      expect(result.args).toEqual({ sku: '100003', quantity: 1 });
    });

    test('returns empty SKU without prior search', () => {
      const result = processMessage('add it to my cart', emptyContext);
      expect(result.tool).toBe('add_to_cart');
      expect(result.args).toEqual({ sku: '', quantity: 1 });
    });
  });

  describe('get_cart patterns', () => {
    test('matches "what\'s in my cart"', () => {
      const result = processMessage("what's in my cart", emptyContext);
      expect(result.tool).toBe('get_cart');
      expect(result.args).toEqual({});
    });

    test('matches "whats in my cart" (no apostrophe)', () => {
      const result = processMessage('whats in my cart', emptyContext);
      expect(result.tool).toBe('get_cart');
    });

    test('matches "show my cart"', () => {
      const result = processMessage('show my cart', emptyContext);
      expect(result.tool).toBe('get_cart');
    });

    test('matches "show cart"', () => {
      const result = processMessage('show cart', emptyContext);
      expect(result.tool).toBe('get_cart');
    });

    test('matches "view cart"', () => {
      const result = processMessage('view cart', emptyContext);
      expect(result.tool).toBe('get_cart');
    });

    test('matches "cart contents"', () => {
      const result = processMessage('cart contents', emptyContext);
      expect(result.tool).toBe('get_cart');
    });
  });

  describe('fallback behavior', () => {
    test('returns fallback for unrecognized input', () => {
      const result = processMessage('do something random', emptyContext);
      expect(result.tool).toBeNull();
      expect(result.fallbackMessage).toBeTruthy();
    });

    test('returns fallback for empty input', () => {
      const result = processMessage('', emptyContext);
      expect(result.tool).toBeNull();
    });

    test('returns fallback for whitespace only', () => {
      const result = processMessage('   ', emptyContext);
      expect(result.tool).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    test('matches uppercase "SHOW ME HAMMERS"', () => {
      const result = processMessage('SHOW ME HAMMERS', emptyContext);
      expect(result.tool).toBe('search_products');
    });

    test('matches mixed case "My Customer ID is 123"', () => {
      const result = processMessage('My Customer ID is 123', emptyContext);
      expect(result.tool).toBe('set_customer_id');
    });
  });

  describe('pattern priority', () => {
    test('customer id takes priority over search when both could match', () => {
      // "customer id is 123" should match set_customer_id, not search
      const result = processMessage('customer id is 123', emptyContext);
      expect(result.tool).toBe('set_customer_id');
    });
  });
});
