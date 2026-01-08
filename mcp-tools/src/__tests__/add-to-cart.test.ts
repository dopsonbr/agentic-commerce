import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { handleAddToCart } from '../handlers/add-to-cart.js';
import { sessionStore } from '../session-context.js';
import {
  setupFetchMock,
  resetFetchMock,
  mockFetch,
  mockResponse,
  sampleProducts,
  sampleBridgeResult,
} from './test-utils.js';

describe('add_to_cart handler', () => {
  beforeEach(() => {
    setupFetchMock();
    sessionStore.delete('test-session');
  });

  afterEach(() => {
    resetFetchMock();
    sessionStore.delete('test-session');
  });

  it('should add item to cart via headless session', async () => {
    // Mock product lookup
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    // Mock headless session creation
    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && !url.includes('/execute')) {
        return mockResponse({ sessionId: 'test-session', status: 'created' }, 201);
      }
      // Mock execute
      return mockResponse(sampleBridgeResult);
    });

    const result = await handleAddToCart({ sku: '100001', quantity: 2 }, 'test-session');

    expect(result.success).toBe(true);
    expect(result.item.sku).toBe('100001');
    expect(result.item.name).toBe('Fiberglass Claw Hammer 16oz');
    expect(result.item.quantity).toBe(2);
  });

  it('should create headless session if not exists', async () => {
    let sessionCreated = false;

    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && !url.includes('/execute')) {
        sessionCreated = true;
        return mockResponse({ sessionId: 'test-session', status: 'created' }, 201);
      }
      return mockResponse(sampleBridgeResult);
    });

    await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(sessionCreated).toBe(true);
    expect(sessionStore.get('test-session')?.headlessSessionId).toBe('test-session');
  });

  it('should propagate customerId when creating new session', async () => {
    sessionStore.update('test-session', { customerId: 'customer-123' });

    let customerIdDispatched = false;
    let dispatchedCustomerId = '';

    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && url.includes('/execute')) {
        const body = JSON.parse(init.body as string);
        if (body.action.type === '[Cart] Set Customer ID') {
          customerIdDispatched = true;
          dispatchedCustomerId = body.action.customerId;
          return mockResponse({ success: true });
        }
        return mockResponse(sampleBridgeResult);
      }
      return mockResponse({ sessionId: 'test-session', status: 'created' }, 201);
    });

    await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(customerIdDispatched).toBe(true);
    expect(dispatchedCustomerId).toBe('customer-123');
  });

  it('should reuse existing headless session', async () => {
    sessionStore.update('test-session', { headlessSessionId: 'existing-session' });

    let sessionCreateAttempted = false;

    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && !url.includes('/execute')) {
        sessionCreateAttempted = true;
      }
      return mockResponse(sampleBridgeResult);
    });

    await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(sessionCreateAttempted).toBe(false);
  });

  it('should recover from 404 by recreating session', async () => {
    sessionStore.update('test-session', { headlessSessionId: 'stale-session' });

    let executeCallCount = 0;
    let sessionRecreated = false;

    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && url.includes('/execute')) {
        executeCallCount++;
        // First call returns 404 (stale session)
        if (executeCallCount === 1) {
          return mockResponse({ error: 'Session not found' }, 404);
        }
        // Second call succeeds (after recreation)
        return mockResponse(sampleBridgeResult);
      }
      // Session creation
      sessionRecreated = true;
      return mockResponse({ sessionId: 'stale-session', status: 'created' }, 201);
    });

    const result = await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(sessionRecreated).toBe(true);
    expect(executeCallCount).toBe(2);
    expect(result.success).toBe(true);
  });

  it('should propagate customerId during session recovery', async () => {
    sessionStore.update('test-session', {
      headlessSessionId: 'stale-session',
      customerId: 'customer-789',
    });

    let customerIdPropagatedAfterRecovery = false;
    let executeCallCount = 0;

    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && url.includes('/execute')) {
        const body = JSON.parse(init.body as string);
        executeCallCount++;

        // First execute returns 404
        if (executeCallCount === 1) {
          return mockResponse({ error: 'Session not found' }, 404);
        }

        // Check if customer ID is being set after recovery
        if (body.action.type === '[Cart] Set Customer ID') {
          customerIdPropagatedAfterRecovery = true;
          return mockResponse({ success: true });
        }

        return mockResponse(sampleBridgeResult);
      }
      return mockResponse({ sessionId: 'stale-session', status: 'created' }, 201);
    });

    await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(customerIdPropagatedAfterRecovery).toBe(true);
  });

  it('should throw error for non-existent product', async () => {
    // Need to mock session creation since it happens before product lookup
    mockFetch('/sessions', () => mockResponse({ sessionId: 'test-session', status: 'created' }, 201));
    mockFetch('/api/products/999999', () => mockResponse({ error: 'Not found' }, 404));

    await expect(handleAddToCart({ sku: '999999' }, 'test-session')).rejects.toThrow(
      'Product not found: 999999'
    );
  });

  it('should throw on bridge failure', async () => {
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    mockFetch('/sessions', (url, init) => {
      if (init?.method === 'POST' && url.includes('/execute')) {
        return mockResponse({ success: false, error: 'Cart operation failed' });
      }
      return mockResponse({ sessionId: 'test-session', status: 'created' }, 201);
    });

    await expect(handleAddToCart({ sku: '100001' }, 'test-session')).rejects.toThrow(
      'Cart operation failed'
    );
  });

  it('should use default quantity of 1', async () => {
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));
    mockFetch('/sessions', () => mockResponse(sampleBridgeResult));

    const result = await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(result.item.quantity).toBe(1);
  });

  it('should extract cart ID from bridge result state', async () => {
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));
    mockFetch('/sessions', () => mockResponse(sampleBridgeResult));

    await handleAddToCart({ sku: '100001' }, 'test-session');

    expect(sessionStore.get('test-session')?.cartId).toBe('cart-123');
  });
});
