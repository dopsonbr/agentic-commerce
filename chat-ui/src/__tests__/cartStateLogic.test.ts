import { describe, test, expect } from 'bun:test';

// Test the cart state update logic extracted from useChat.ts
// This tests the pure logic without React hooks

interface CartItemResult {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

interface GetCartResult {
  cartId: string;
  customerId: string | null;
  items: CartItemResult[];
  total: number;
}

interface AddToCartResult {
  success: boolean;
  cartId: string;
  item: CartItemResult;
}

// Extract cart update logic from useChat
function updateCartFromAddResult(
  prev: GetCartResult | null,
  addResult: AddToCartResult,
  customerId: string | null
): GetCartResult {
  if (!prev) {
    return {
      cartId: addResult.cartId,
      customerId: customerId,
      items: [addResult.item],
      total: addResult.item.price * addResult.item.quantity,
    };
  }

  const existingIndex = prev.items.findIndex(i => i.sku === addResult.item.sku);
  if (existingIndex >= 0) {
    const newItems = [...prev.items];
    const existingItem = newItems[existingIndex];
    if (existingItem) {
      newItems[existingIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + addResult.item.quantity,
      };
    }
    return {
      ...prev,
      items: newItems,
      total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    };
  }

  const newItems = [...prev.items, addResult.item];
  return {
    ...prev,
    items: newItems,
    total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
  };
}

describe('Cart State Logic', () => {
  describe('updateCartFromAddResult', () => {
    const sampleItem: CartItemResult = {
      sku: '100003',
      name: 'Claw Hammer',
      price: 24.99,
      quantity: 1,
    };

    const addResult: AddToCartResult = {
      success: true,
      cartId: 'cart-123',
      item: sampleItem,
    };

    test('creates new cart when cart is null', () => {
      const result = updateCartFromAddResult(null, addResult, 'customer-456');

      expect(result.cartId).toBe('cart-123');
      expect(result.customerId).toBe('customer-456');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(sampleItem);
      expect(result.total).toBe(24.99);
    });

    test('creates new cart with null customerId when not set', () => {
      const result = updateCartFromAddResult(null, addResult, null);

      expect(result.customerId).toBeNull();
    });

    test('adds new item to existing cart', () => {
      const existingCart: GetCartResult = {
        cartId: 'cart-123',
        customerId: 'customer-456',
        items: [{ sku: '100001', name: 'Drill', price: 99.99, quantity: 1 }],
        total: 99.99,
      };

      const result = updateCartFromAddResult(existingCart, addResult, 'customer-456');

      expect(result.items).toHaveLength(2);
      expect(result.items[1]).toEqual(sampleItem);
      expect(result.total).toBe(99.99 + 24.99);
    });

    test('increments quantity when same SKU added', () => {
      const existingCart: GetCartResult = {
        cartId: 'cart-123',
        customerId: 'customer-456',
        items: [{ sku: '100003', name: 'Claw Hammer', price: 24.99, quantity: 2 }],
        total: 49.98,
      };

      const result = updateCartFromAddResult(existingCart, addResult, 'customer-456');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.quantity).toBe(3); // 2 + 1
      expect(result.total).toBeCloseTo(74.97, 2); // 24.99 * 3
    });

    test('correctly calculates total with multiple items', () => {
      const existingCart: GetCartResult = {
        cartId: 'cart-123',
        customerId: 'customer-456',
        items: [
          { sku: '100001', name: 'Drill', price: 99.99, quantity: 1 },
          { sku: '100002', name: 'Saw', price: 49.99, quantity: 2 },
        ],
        total: 199.97, // 99.99 + 49.99*2
      };

      const result = updateCartFromAddResult(existingCart, addResult, 'customer-456');

      expect(result.items).toHaveLength(3);
      // 99.99 + 49.99*2 + 24.99 = 224.96
      expect(result.total).toBeCloseTo(224.96, 2);
    });

    test('handles adding multiple quantity at once', () => {
      const multiQuantityResult: AddToCartResult = {
        success: true,
        cartId: 'cart-123',
        item: { sku: '100003', name: 'Claw Hammer', price: 24.99, quantity: 5 },
      };

      const result = updateCartFromAddResult(null, multiQuantityResult, 'customer-456');

      expect(result.items[0]?.quantity).toBe(5);
      expect(result.total).toBeCloseTo(124.95, 2); // 24.99 * 5
    });

    test('preserves existing cart properties', () => {
      const existingCart: GetCartResult = {
        cartId: 'cart-original',
        customerId: 'customer-original',
        items: [],
        total: 0,
      };

      const result = updateCartFromAddResult(existingCart, addResult, 'customer-456');

      // Should preserve the existing cart's ID and customer, not the add result
      expect(result.cartId).toBe('cart-original');
      expect(result.customerId).toBe('customer-original');
    });
  });

  describe('Edge Cases', () => {
    test('handles zero price item', () => {
      const freeItem: AddToCartResult = {
        success: true,
        cartId: 'cart-123',
        item: { sku: '100099', name: 'Free Sample', price: 0, quantity: 1 },
      };

      const result = updateCartFromAddResult(null, freeItem, null);

      expect(result.total).toBe(0);
    });

    test('handles fractional quantities correctly', () => {
      // Some systems allow fractional quantities (e.g., by weight)
      const fractionalResult: AddToCartResult = {
        success: true,
        cartId: 'cart-123',
        item: { sku: '100003', name: 'Rope', price: 10.0, quantity: 2.5 },
      };

      const result = updateCartFromAddResult(null, fractionalResult, null);

      expect(result.total).toBe(25.0); // 10.0 * 2.5
    });
  });
});

describe('Search Products State Update', () => {
  interface ProductResult {
    sku: string;
    name: string;
    description: string;
    price: number;
    category: string;
    inStock: boolean;
  }

  interface SearchProductsResult {
    products: ProductResult[];
    total: number;
  }

  // Extract logic from useChat
  function extractFirstProduct(result: SearchProductsResult): { sku: string; name: string } | null {
    const firstProduct = result.products?.[0];
    if (firstProduct) {
      return { sku: firstProduct.sku, name: firstProduct.name };
    }
    return null;
  }

  test('extracts first product SKU and name', () => {
    const searchResult: SearchProductsResult = {
      products: [
        { sku: '100003', name: 'Claw Hammer', description: 'A hammer', price: 24.99, category: 'tools', inStock: true },
        { sku: '100004', name: 'Ball Peen Hammer', description: 'Another hammer', price: 29.99, category: 'tools', inStock: true },
      ],
      total: 2,
    };

    const result = extractFirstProduct(searchResult);

    expect(result).toEqual({ sku: '100003', name: 'Claw Hammer' });
  });

  test('returns null for empty results', () => {
    const searchResult: SearchProductsResult = {
      products: [],
      total: 0,
    };

    const result = extractFirstProduct(searchResult);

    expect(result).toBeNull();
  });

  test('handles undefined products array', () => {
    const searchResult = { total: 0 } as SearchProductsResult;

    const result = extractFirstProduct(searchResult);

    expect(result).toBeNull();
  });
});
