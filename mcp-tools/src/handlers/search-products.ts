import { searchProductsInput, searchProductsOutput } from '../schemas/tools.js';
import { injectContext, createClientSpan } from '../observability/tracing.js';
import { SpanStatusCode } from '@opentelemetry/api';

const SHOP_API_URL = process.env['SHOP_API_URL'] || 'http://localhost:3000';

export async function handleSearchProducts(args: unknown, _sessionId: string) {
  const input = searchProductsInput.parse(args);

  const url = new URL('/api/products', SHOP_API_URL);
  if (input.query) {
    url.searchParams.set('search', input.query);
  }

  // Create a client span for the outgoing request
  const span = createClientSpan('GET shop-api/products', 'GET', url.toString());

  try {
    // Inject trace context into headers (pass the span to use its context)
    const headers = injectContext({
      'Content-Type': 'application/json',
    }, span);

    const response = await fetch(url.toString(), { headers });

    span.setAttribute('http.status_code', response.status);

    if (!response.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `shop-api error: ${response.status}` });
      span.end();
      throw new Error(`shop-api error: ${response.status}`);
    }

    const products = await response.json();
    const productArray = Array.isArray(products) ? products : [];

    // Apply limit but report actual total matches
    const limited = productArray.slice(0, input.limit);

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    return searchProductsOutput.parse({
      products: limited,
      total: productArray.length, // Total matches, not limited count
    });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : 'Unknown error' });
    span.recordException(error instanceof Error ? error : new Error('Unknown error'));
    span.end();
    throw error;
  }
}
