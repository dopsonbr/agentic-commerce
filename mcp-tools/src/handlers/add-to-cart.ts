import { addToCartInput, addToCartOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';
import type { BridgeResult, Product } from '../types.js';

const HEADLESS_URL = process.env['HEADLESS_URL'] || 'http://localhost:3002';
const SHOP_API_URL = process.env['SHOP_API_URL'] || 'http://localhost:3000';

export async function handleAddToCart(args: unknown, sessionId: string) {
  const input = addToCartInput.parse(args);
  const context = sessionStore.getOrCreate(sessionId);

  // Ensure headless session exists
  if (!context.headlessSessionId) {
    context.headlessSessionId = sessionId;
    await createHeadlessSession(sessionId);
  }

  // First, get product details for the response
  const productResponse = await fetch(`${SHOP_API_URL}/api/products/${input.sku}`);
  if (!productResponse.ok) {
    throw new Error(`Product not found: ${input.sku}`);
  }
  const product: Product = await productResponse.json();

  // Execute via headless browser
  const executeResponse = await fetch(
    `${HEADLESS_URL}/sessions/${context.headlessSessionId}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: {
          type: '[Cart] Add Item',
          sku: input.sku,
          quantity: input.quantity,
        },
        successTypes: ['[Cart] Add Item Success'],
        failureTypes: ['[Cart] Add Item Failure'],
        timeout: 10000,
      }),
    }
  );

  if (!executeResponse.ok) {
    throw new Error(`Headless execution failed: ${executeResponse.status}`);
  }

  const result: BridgeResult = await executeResponse.json();

  if (!result.success) {
    throw new Error(result.error || 'Add to cart failed');
  }

  // Extract cart ID from state if available
  if (result.state?.cart?.id) {
    context.cartId = result.state.cart.id;
  }

  return addToCartOutput.parse({
    success: true,
    cartId: context.cartId || 'pending',
    item: {
      sku: input.sku,
      name: product.name,
      price: product.price,
      quantity: input.quantity ?? 1,
    },
  });
}

async function createHeadlessSession(sessionId: string): Promise<void> {
  const response = await fetch(`${HEADLESS_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok && response.status !== 409) {
    // 409 = already exists, which is fine
    throw new Error(`Failed to create headless session: ${response.status}`);
  }
}
