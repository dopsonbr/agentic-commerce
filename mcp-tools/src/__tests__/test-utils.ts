/**
 * Test utilities for mocking fetch and managing test state
 */

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock response helper
export function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Mock fetch with route matching
type MockHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

let mockHandlers: Map<string, MockHandler> = new Map();
let defaultHandler: MockHandler | null = null;

export function mockFetch(urlPattern: string, handler: MockHandler): void {
  mockHandlers.set(urlPattern, handler);
}

export function mockFetchDefault(handler: MockHandler): void {
  defaultHandler = handler;
}

export function setupFetchMock(): void {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    // Check for matching handler
    for (const [pattern, handler] of mockHandlers) {
      if (url.includes(pattern)) {
        return handler(url, init);
      }
    }

    // Use default handler if set
    if (defaultHandler) {
      return defaultHandler(url, init);
    }

    throw new Error(`Unmocked fetch: ${url}`);
  };
}

export function resetFetchMock(): void {
  mockHandlers.clear();
  defaultHandler = null;
  globalThis.fetch = originalFetch;
}

// Sample test data
export const sampleProducts = [
  {
    sku: '100001',
    name: 'Fiberglass Claw Hammer 16oz',
    price: 24.99,
    description: 'Professional-grade hammer',
    category: 'Hand Tools',
    inventory: 150,
    imageUrl: '/images/hammer-16oz.jpg',
  },
  {
    sku: '100002',
    name: 'Cordless Drill 20V',
    price: 89.99,
    description: 'Powerful cordless drill',
    category: 'Power Tools',
    inventory: 75,
    imageUrl: '/images/drill-20v.jpg',
  },
  {
    sku: '100003',
    name: 'Safety Glasses',
    price: 12.99,
    description: 'Impact-resistant safety glasses',
    category: 'Safety Equipment',
    inventory: 200,
    imageUrl: '/images/safety-glasses.jpg',
  },
];

export const sampleCart = {
  id: 'cart-123',
  customerId: 'customer-456',
  items: [
    { sku: '100001', quantity: 2 },
    { sku: '100002', quantity: 1 },
  ],
  createdAt: '2026-01-08T00:00:00.000Z',
  updatedAt: '2026-01-08T00:00:00.000Z',
};

export const sampleBridgeResult = {
  success: true,
  action: { type: '[Cart] Add Item Success' },
  state: {
    products: { items: [], loading: false, error: null },
    cart: {
      id: 'cart-123',
      customerId: 'customer-456',
      items: [{ sku: '100001', quantity: 1 }],
      loading: false,
      error: null,
    },
  },
};
