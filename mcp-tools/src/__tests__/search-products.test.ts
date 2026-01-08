import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { handleSearchProducts } from '../handlers/search-products.js';
import {
  setupFetchMock,
  resetFetchMock,
  mockFetch,
  mockResponse,
  sampleProducts,
} from './test-utils.js';

describe('search_products handler', () => {
  beforeEach(() => {
    setupFetchMock();
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should search products and return results', async () => {
    mockFetch('/api/products', () => mockResponse(sampleProducts));

    const result = await handleSearchProducts({ query: 'hammer' }, 'session-1');

    expect(result.products).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.products[0].sku).toBe('100001');
  });

  it('should pass search query to shop-api', async () => {
    let capturedUrl = '';
    mockFetch('/api/products', (url) => {
      capturedUrl = url;
      return mockResponse([sampleProducts[0]]);
    });

    await handleSearchProducts({ query: 'drill' }, 'session-1');

    expect(capturedUrl).toContain('search=drill');
  });

  it('should apply limit to results', async () => {
    mockFetch('/api/products', () => mockResponse(sampleProducts));

    const result = await handleSearchProducts({ query: 'tools', limit: 2 }, 'session-1');

    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(3); // Total should be actual count, not limited
  });

  it('should report actual total matches regardless of limit', async () => {
    const manyProducts = Array(20)
      .fill(null)
      .map((_, i) => ({ ...sampleProducts[0], sku: `10000${i}` }));

    mockFetch('/api/products', () => mockResponse(manyProducts));

    const result = await handleSearchProducts({ query: 'test', limit: 5 }, 'session-1');

    expect(result.products).toHaveLength(5);
    expect(result.total).toBe(20); // Reports actual total, not limited count
  });

  it('should use default limit of 10', async () => {
    const manyProducts = Array(15)
      .fill(null)
      .map((_, i) => ({ ...sampleProducts[0], sku: `10000${i}` }));

    mockFetch('/api/products', () => mockResponse(manyProducts));

    const result = await handleSearchProducts({ query: 'test' }, 'session-1');

    expect(result.products).toHaveLength(10);
  });

  it('should handle empty results', async () => {
    mockFetch('/api/products', () => mockResponse([]));

    const result = await handleSearchProducts({ query: 'nonexistent' }, 'session-1');

    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should throw on shop-api error', async () => {
    mockFetch('/api/products', () => mockResponse({ error: 'Server error' }, 500));

    await expect(handleSearchProducts({ query: 'test' }, 'session-1')).rejects.toThrow(
      'shop-api error: 500'
    );
  });

  it('should validate input with Zod', async () => {
    mockFetch('/api/products', () => mockResponse([]));

    // Missing required query field
    await expect(handleSearchProducts({}, 'session-1')).rejects.toThrow();
  });
});
