import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { handleGetCart } from '../handlers/get-cart.js';
import { sessionStore } from '../session-context.js';
import {
  setupFetchMock,
  resetFetchMock,
  mockFetch,
  mockResponse,
  sampleCart,
  sampleProducts,
} from './test-utils.js';

describe('get_cart handler', () => {
  beforeEach(() => {
    setupFetchMock();
    // Clear session store before each test
    sessionStore.delete('test-session');
  });

  afterEach(() => {
    resetFetchMock();
    sessionStore.delete('test-session');
  });

  it('should return empty cart when no cart exists', async () => {
    const result = await handleGetCart({}, 'test-session');

    expect(result.cartId).toBe('');
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return customerId from session in empty cart', async () => {
    sessionStore.update('test-session', { customerId: 'customer-123' });

    const result = await handleGetCart({}, 'test-session');

    expect(result.customerId).toBe('customer-123');
  });

  it('should require customerId when cart exists', async () => {
    // Set cartId but no customerId
    sessionStore.update('test-session', { cartId: 'cart-123', customerId: null });

    await expect(handleGetCart({}, 'test-session')).rejects.toThrow(
      'Customer ID not set. Please call set_customer_id first.'
    );
  });

  it('should fetch cart and enrich items with product details', async () => {
    sessionStore.update('test-session', {
      cartId: 'cart-123',
      customerId: 'customer-456',
    });

    // Mock cart API
    mockFetch('/api/cart/cart-123', () => mockResponse(sampleCart));

    // Mock product API for each item
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));
    mockFetch('/api/products/100002', () => mockResponse(sampleProducts[1]));

    const result = await handleGetCart({}, 'test-session');

    expect(result.cartId).toBe('cart-123');
    expect(result.items).toHaveLength(2);

    // Check item enrichment
    expect(result.items[0].sku).toBe('100001');
    expect(result.items[0].name).toBe('Fiberglass Claw Hammer 16oz');
    expect(result.items[0].price).toBe(24.99);
    expect(result.items[0].quantity).toBe(2);
  });

  it('should calculate total correctly', async () => {
    sessionStore.update('test-session', {
      cartId: 'cart-123',
      customerId: 'customer-456',
    });

    mockFetch('/api/cart/cart-123', () => mockResponse(sampleCart));
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0])); // $24.99 x 2
    mockFetch('/api/products/100002', () => mockResponse(sampleProducts[1])); // $89.99 x 1

    const result = await handleGetCart({}, 'test-session');

    // 24.99 * 2 + 89.99 * 1 = 139.97
    expect(result.total).toBeCloseTo(139.97, 2);
  });

  it('should handle cart 404 gracefully', async () => {
    sessionStore.update('test-session', {
      cartId: 'cart-nonexistent',
      customerId: 'customer-456',
    });

    mockFetch('/api/cart/cart-nonexistent', () => mockResponse({ error: 'Not found' }, 404));

    const result = await handleGetCart({}, 'test-session');

    expect(result.cartId).toBe('cart-nonexistent');
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should handle product lookup failure gracefully', async () => {
    sessionStore.update('test-session', {
      cartId: 'cart-123',
      customerId: 'customer-456',
    });

    const cartWithUnknownItem = {
      ...sampleCart,
      items: [{ sku: 'unknown-sku', quantity: 1 }],
    };

    mockFetch('/api/cart/cart-123', () => mockResponse(cartWithUnknownItem));
    mockFetch('/api/products/unknown-sku', () => mockResponse({ error: 'Not found' }, 404));

    const result = await handleGetCart({}, 'test-session');

    expect(result.items[0].name).toBe('Unknown Product');
    expect(result.items[0].price).toBe(0);
  });

  it('should pass customerId as query parameter', async () => {
    sessionStore.update('test-session', {
      cartId: 'cart-123',
      customerId: 'customer-456',
    });

    let capturedUrl = '';
    mockFetch('/api/cart', (url) => {
      capturedUrl = url;
      return mockResponse({ ...sampleCart, items: [] });
    });

    await handleGetCart({}, 'test-session');

    expect(capturedUrl).toContain('customerId=customer-456');
  });
});
