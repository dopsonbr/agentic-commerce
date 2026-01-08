import { getProductDetailsInput, getProductDetailsOutput } from '../schemas/tools.js';
import { injectContext, createClientSpan } from '../observability/tracing.js';
import { SpanStatusCode } from '@opentelemetry/api';

const SHOP_API_URL = process.env['SHOP_API_URL'] || 'http://localhost:3000';

export async function handleGetProductDetails(args: unknown, _sessionId: string) {
  const input = getProductDetailsInput.parse(args);
  const url = `${SHOP_API_URL}/api/products/${input.sku}`;

  // Create a client span for the outgoing request
  const span = createClientSpan('GET shop-api/products/:sku', 'GET', url);

  try {
    // Inject trace context into headers (pass the span to use its context)
    const headers = injectContext({
      'Content-Type': 'application/json',
    }, span);

    const response = await fetch(url, { headers });
    span.setAttribute('http.status_code', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Product not found: ${input.sku}` });
        span.end();
        throw new Error(`Product not found: ${input.sku}`);
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message: `shop-api error: ${response.status}` });
      span.end();
      throw new Error(`shop-api error: ${response.status}`);
    }

    const product = await response.json();
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return getProductDetailsOutput.parse(product);
  } catch (error) {
    if (!span.ended) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : 'Unknown error' });
      span.recordException(error instanceof Error ? error : new Error('Unknown error'));
      span.end();
    }
    throw error;
  }
}
