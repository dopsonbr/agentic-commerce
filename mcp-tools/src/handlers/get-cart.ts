import { getCartInput, getCartOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';
import { injectContext, createClientSpan } from '../observability/tracing.js';
import { SpanStatusCode } from '@opentelemetry/api';
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

  // Create a client span for the cart fetch
  const span = createClientSpan('GET shop-api/cart', 'GET', url.toString());

  try {
    const headers = injectContext({ 'Content-Type': 'application/json' }, span);
    const response = await fetch(url.toString(), { headers });
    span.setAttribute('http.status_code', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        // Cart not found, return empty
        return getCartOutput.parse({
          cartId: context.cartId,
          customerId: context.customerId,
          items: [],
          total: 0,
        });
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message: `shop-api error: ${response.status}` });
      span.end();
      throw new Error(`shop-api error: ${response.status}`);
    }

    const cart = await response.json();
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    // Enrich cart items with product details
    const enrichedItems = await Promise.all(
      (cart.items ?? []).map(async (item: { sku: string; quantity: number }) => {
        const productUrl = `${SHOP_API_URL}/api/products/${item.sku}`;
        const productSpan = createClientSpan('GET shop-api/products/:sku', 'GET', productUrl);
        try {
          const productHeaders = injectContext({ 'Content-Type': 'application/json' }, productSpan);
          const productResponse = await fetch(productUrl, { headers: productHeaders });
          productSpan.setAttribute('http.status_code', productResponse.status);

          if (productResponse.ok) {
            const product: Product = await productResponse.json();
            productSpan.setStatus({ code: SpanStatusCode.OK });
            productSpan.end();
            return {
              sku: item.sku,
              name: product.name,
              price: product.price,
              quantity: item.quantity,
            };
          }
          productSpan.setStatus({ code: SpanStatusCode.ERROR });
          productSpan.end();
        } catch {
          productSpan.setStatus({ code: SpanStatusCode.ERROR });
          productSpan.end();
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
  } catch (error) {
    if (!span.ended) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : 'Unknown error' });
      span.recordException(error instanceof Error ? error : new Error('Unknown error'));
      span.end();
    }
    throw error;
  }
}
