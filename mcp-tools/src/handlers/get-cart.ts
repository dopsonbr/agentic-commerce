import { getCartInput, getCartOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';
import type { Product } from '../types.js';

const SHOP_API_URL = process.env['SHOP_API_URL'] || 'http://localhost:3000';

export async function handleGetCart(args: unknown, sessionId: string) {
  getCartInput.parse(args); // Validate (empty object)

  const context = sessionStore.getOrCreate(sessionId);

  // If no cart yet, return empty
  if (!context.cartId) {
    return getCartOutput.parse({
      cartId: '',
      customerId: context.customerId,
      items: [],
      total: 0,
    });
  }

  // customerId is required by shop-api
  if (!context.customerId) {
    throw new Error('Customer ID not set. Please call set_customer_id first.');
  }

  const url = new URL(`/api/cart/${context.cartId}`, SHOP_API_URL);
  url.searchParams.set('customerId', context.customerId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 404) {
      // Cart not found, return empty
      return getCartOutput.parse({
        cartId: context.cartId,
        customerId: context.customerId,
        items: [],
        total: 0,
      });
    }
    throw new Error(`shop-api error: ${response.status}`);
  }

  const cart = await response.json();

  // Enrich cart items with product details
  const enrichedItems = await Promise.all(
    (cart.items ?? []).map(async (item: { sku: string; quantity: number }) => {
      try {
        const productResponse = await fetch(`${SHOP_API_URL}/api/products/${item.sku}`);
        if (productResponse.ok) {
          const product: Product = await productResponse.json();
          return {
            sku: item.sku,
            name: product.name,
            price: product.price,
            quantity: item.quantity,
          };
        }
      } catch {
        // Fall through to default
      }
      return {
        sku: item.sku,
        name: 'Unknown Product',
        price: 0,
        quantity: item.quantity,
      };
    })
  );

  // Calculate total
  const total = enrichedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return getCartOutput.parse({
    cartId: cart.id,
    customerId: cart.customerId,
    items: enrichedItems,
    total,
  });
}
