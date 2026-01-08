import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { callTool, listTools, checkHealth } from '../services/mcp-client';

describe('mcp-client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('callTool', () => {
    test('sends correct request to mcp-tools API', async () => {
      let capturedRequest: { url: string; method: string; body: string } | null = null;

      globalThis.fetch = mock(async (url: string, options?: RequestInit) => {
        capturedRequest = {
          url,
          method: options?.method || 'GET',
          body: options?.body as string,
        };
        return new Response(JSON.stringify({ success: true, result: { data: 'test' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      await callTool('search_products', { query: 'hammers' }, 'session-123');

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.url).toBe('http://localhost:3001/tools/search_products/call');
      expect(capturedRequest!.method).toBe('POST');
      expect(JSON.parse(capturedRequest!.body)).toEqual({
        sessionId: 'session-123',
        args: { query: 'hammers' },
      });
    });

    test('returns success result from API', async () => {
      const mockResult = { products: [{ sku: '123', name: 'Hammer' }], total: 1 };

      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ success: true, result: mockResult }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const result = await callTool('search_products', { query: 'hammers' }, 'session-123');

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockResult);
      expect(result.error).toBeUndefined();
    });

    test('returns error result from API', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ success: false, error: 'Product not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const result = await callTool('add_to_cart', { sku: 'invalid' }, 'session-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Product not found');
    });

    test('handles network errors gracefully', async () => {
      globalThis.fetch = mock(async () => {
        throw new Error('Network connection failed');
      }) as typeof fetch;

      const result = await callTool('search_products', { query: 'hammers' }, 'session-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection failed');
    });

    test('handles non-Error throws gracefully', async () => {
      globalThis.fetch = mock(async () => {
        throw 'Unknown error';
      }) as typeof fetch;

      const result = await callTool('search_products', { query: 'hammers' }, 'session-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    test('uses correct Content-Type header', async () => {
      let capturedHeaders: HeadersInit | undefined;

      globalThis.fetch = mock(async (_url: string, options?: RequestInit) => {
        capturedHeaders = options?.headers;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      await callTool('test_tool', {}, 'session');

      expect(capturedHeaders).toEqual({ 'Content-Type': 'application/json' });
    });
  });

  describe('listTools', () => {
    test('fetches tools list from API', async () => {
      const mockTools = [
        { name: 'search_products', description: 'Search for products' },
        { name: 'add_to_cart', description: 'Add item to cart' },
      ];

      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify(mockTools), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const result = await listTools();

      expect(result).toEqual(mockTools);
    });

    test('returns empty array on error', async () => {
      globalThis.fetch = mock(async () => {
        throw new Error('Connection refused');
      }) as typeof fetch;

      const result = await listTools();

      expect(result).toEqual([]);
    });
  });

  describe('checkHealth', () => {
    test('returns true when API is healthy', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const result = await checkHealth();

      expect(result).toBe(true);
    });

    test('returns false when API returns error status', async () => {
      globalThis.fetch = mock(async () => {
        return new Response('Internal Server Error', { status: 500 });
      }) as typeof fetch;

      const result = await checkHealth();

      expect(result).toBe(false);
    });

    test('returns false when API is unreachable', async () => {
      globalThis.fetch = mock(async () => {
        throw new Error('Connection refused');
      }) as typeof fetch;

      const result = await checkHealth();

      expect(result).toBe(false);
    });
  });
});
