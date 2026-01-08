import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { handleGetProductDetails } from '../handlers/get-product-details.js';
import {
  setupFetchMock,
  resetFetchMock,
  mockFetch,
  mockResponse,
  sampleProducts,
} from './test-utils.js';

describe('get_product_details handler', () => {
  beforeEach(() => {
    setupFetchMock();
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should return product details by SKU', async () => {
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    const result = await handleGetProductDetails({ sku: '100001' }, 'session-1');

    expect(result.sku).toBe('100001');
    expect(result.name).toBe('Fiberglass Claw Hammer 16oz');
    expect(result.price).toBe(24.99);
    expect(result.category).toBe('Hand Tools');
  });

  it('should include all product fields', async () => {
    mockFetch('/api/products/100001', () => mockResponse(sampleProducts[0]));

    const result = await handleGetProductDetails({ sku: '100001' }, 'session-1');

    expect(result).toHaveProperty('sku');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('price');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('inventory');
    expect(result).toHaveProperty('imageUrl');
  });

  it('should throw error for non-existent product', async () => {
    mockFetch('/api/products/999999', () => mockResponse({ error: 'Not found' }, 404));

    await expect(handleGetProductDetails({ sku: '999999' }, 'session-1')).rejects.toThrow(
      'Product not found: 999999'
    );
  });

  it('should throw on shop-api error', async () => {
    mockFetch('/api/products/100001', () => mockResponse({ error: 'Server error' }, 500));

    await expect(handleGetProductDetails({ sku: '100001' }, 'session-1')).rejects.toThrow(
      'shop-api error: 500'
    );
  });

  it('should validate input requires SKU', async () => {
    mockFetch('/api/products', () => mockResponse({}));

    await expect(handleGetProductDetails({}, 'session-1')).rejects.toThrow();
  });

  it('should pass correct SKU to shop-api', async () => {
    let capturedUrl = '';
    mockFetch('/api/products', (url) => {
      capturedUrl = url;
      return mockResponse(sampleProducts[1]);
    });

    await handleGetProductDetails({ sku: '100002' }, 'session-1');

    expect(capturedUrl).toContain('/api/products/100002');
  });
});
