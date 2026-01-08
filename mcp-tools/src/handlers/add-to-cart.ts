import { addToCartInput, addToCartOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';
import { injectContext, createClientSpan } from '../observability/tracing.js';
import { SpanStatusCode } from '@opentelemetry/api';
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
    // Propagate customer ID to new headless session if set
    if (context.customerId) {
      await setCustomerIdInHeadless(sessionId, context.customerId);
    }
  }

  // First, get product details for the response
  const productUrl = `${SHOP_API_URL}/api/products/${input.sku}`;
  const productSpan = createClientSpan('GET shop-api/products/:sku', 'GET', productUrl);
  let product: Product;

  try {
    const productHeaders = injectContext({ 'Content-Type': 'application/json' }, productSpan);
    const productResponse = await fetch(productUrl, { headers: productHeaders });
    productSpan.setAttribute('http.status_code', productResponse.status);

    if (!productResponse.ok) {
      productSpan.setStatus({ code: SpanStatusCode.ERROR, message: `Product not found: ${input.sku}` });
      productSpan.end();
      throw new Error(`Product not found: ${input.sku}`);
    }
    product = await productResponse.json();
    productSpan.setStatus({ code: SpanStatusCode.OK });
    productSpan.end();
  } catch (error) {
    if (!productSpan.ended) {
      productSpan.setStatus({ code: SpanStatusCode.ERROR });
      productSpan.end();
    }
    throw error;
  }

  // Execute via headless browser with session recovery
  const executeUrl = `${HEADLESS_URL}/sessions/${context.headlessSessionId}/execute`;
  const executeSpan = createClientSpan('POST headless/execute', 'POST', executeUrl);

  try {
    const executeHeaders = injectContext({ 'Content-Type': 'application/json' }, executeSpan);
    let executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: executeHeaders,
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
    });

    // If session not found (404), try to recreate it once
    if (executeResponse.status === 404) {
      await createHeadlessSession(context.headlessSessionId);
      // Propagate customer ID to recreated headless session if set
      if (context.customerId) {
        await setCustomerIdInHeadless(context.headlessSessionId, context.customerId);
      }
      const retryHeaders = injectContext({ 'Content-Type': 'application/json' }, executeSpan);
      executeResponse = await fetch(executeUrl, {
        method: 'POST',
        headers: retryHeaders,
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
      });
    }

    executeSpan.setAttribute('http.status_code', executeResponse.status);

    if (!executeResponse.ok) {
      executeSpan.setStatus({ code: SpanStatusCode.ERROR, message: `Headless execution failed: ${executeResponse.status}` });
      executeSpan.end();
      throw new Error(`Headless execution failed: ${executeResponse.status}`);
    }

    const result: BridgeResult = await executeResponse.json();
    executeSpan.setStatus({ code: SpanStatusCode.OK });
    executeSpan.end();

    if (!result.success) {
      throw new Error(result.error || 'Add to cart failed');
    }

    // Extract cart ID from state if available
    // State shape: { cart: { cart: { id: string } } }
    const cartState = result.state?.cart as { cart?: { id?: string } } | undefined;
    if (cartState?.cart?.id) {
      context.cartId = cartState.cart.id;
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
  } catch (error) {
    if (!executeSpan.ended) {
      executeSpan.setStatus({ code: SpanStatusCode.ERROR });
      executeSpan.end();
    }
    throw error;
  }
}

async function createHeadlessSession(sessionId: string): Promise<void> {
  const url = `${HEADLESS_URL}/sessions`;
  const span = createClientSpan('POST headless/sessions', 'POST', url);

  try {
    const headers = injectContext({ 'Content-Type': 'application/json' }, span);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId }),
    });

    span.setAttribute('http.status_code', response.status);

    if (!response.ok && response.status !== 409) {
      // 409 = already exists, which is fine
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw new Error(`Failed to create headless session: ${response.status}`);
    }

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  } catch (error) {
    if (!span.ended) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    }
    throw error;
  }
}

/**
 * Set customer ID in the headless session's NgRx store.
 * This ensures cart creation uses the correct customer ID.
 */
async function setCustomerIdInHeadless(headlessSessionId: string, customerId: string): Promise<void> {
  const url = `${HEADLESS_URL}/sessions/${headlessSessionId}/execute`;
  const span = createClientSpan('POST headless/execute', 'POST', url);

  try {
    const headers = injectContext({ 'Content-Type': 'application/json' }, span);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: {
          type: '[Cart] Set Customer ID',
          customerId,
        },
        // Synchronous action - success type is the same as trigger
        successTypes: ['[Cart] Set Customer ID'],
        failureTypes: [],
        timeout: 5000,
      }),
    });

    span.setAttribute('http.status_code', response.status);

    if (!response.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      console.warn(`[add_to_cart] Failed to set customer ID in headless: ${response.status}`);
      return;
    }

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
    // Log but don't fail - cart will be created with 'guest' as fallback
    console.warn('[add_to_cart] Failed to set customer ID in headless:', error);
  }
}
