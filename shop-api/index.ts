// Initialize tracing FIRST - before any other imports
import { tracer, extractContext, createHttpSpan } from "./src/observability/tracing.ts";
import { SpanStatusCode, context } from "@opentelemetry/api";

import { productRoutes } from "./src/routes/products.ts";
import { cartRoutes } from "./src/routes/cart.ts";
import { corsHeaders } from "./src/cors.ts";
import { createLogger } from "./src/observability/logger.ts";
import { createHistogram, createCounter, getMetricsOutput } from "./src/observability/metrics.ts";

const logger = createLogger('shop-api');

// Metrics
const httpRequestDuration = createHistogram(
  'http_request_duration_seconds',
  'Duration of HTTP requests in seconds'
);
const httpRequestTotal = createCounter(
  'http_requests_total',
  'Total number of HTTP requests'
);

// Wrap route handler with instrumentation
function instrumentRoute(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request) => {
    const startTime = Date.now();
    const url = new URL(req.url);

    // Extract trace context from incoming request headers
    const parentContext = extractContext(req.headers);

    // Create a span for this request within the parent context
    const span = createHttpSpan(
      `${req.method} ${url.pathname}`,
      req.method,
      url.pathname,
      parentContext
    );

    // Execute handler within the span context
    return context.with(context.active().setValue(Symbol.for('current-span'), span), async () => {
      const traceId = span.spanContext().traceId;
      const spanId = span.spanContext().spanId;

      logger.info('Incoming request', {
        traceId,
        spanId,
        method: req.method,
        path: url.pathname,
      });

      try {
        const response = await handler(req);
        const duration = (Date.now() - startTime) / 1000;

        // Set span attributes
        span.setAttribute('http.status_code', response.status);
        span.setStatus({ code: response.status < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR });

        logger.info('Request completed', {
          traceId,
          spanId,
          method: req.method,
          path: url.pathname,
          status: response.status.toString(),
          duration_ms: (duration * 1000).toFixed(2),
        });

        httpRequestDuration.observe(duration, {
          method: req.method,
          path: url.pathname,
          status: response.status.toString(),
        });
        httpRequestTotal.inc({
          method: req.method,
          path: url.pathname,
          status: response.status.toString(),
        });

        span.end();
        return response;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Record error in span
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        span.setAttribute('http.status_code', 500);
        span.recordException(error instanceof Error ? error : new Error(errorMessage));

        logger.error('Request failed', {
          traceId,
          spanId,
          method: req.method,
          path: url.pathname,
          error: errorMessage,
          stack: errorStack,
        });

        httpRequestDuration.observe(duration, {
          method: req.method,
          path: url.pathname,
          status: '500',
        });
        httpRequestTotal.inc({
          method: req.method,
          path: url.pathname,
          status: '500',
        });

        span.end();

        // Return 500 response instead of re-throwing
        return new Response(
          JSON.stringify({ error: errorMessage }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    });
  };
}

// Instrument all routes
function instrumentRoutes(routes: Record<string, Record<string, (req: Request) => Response | Promise<Response>>>) {
  const instrumented: Record<string, Record<string, (req: Request) => Response | Promise<Response>>> = {};
  for (const [path, methods] of Object.entries(routes)) {
    instrumented[path] = {};
    for (const [method, handler] of Object.entries(methods)) {
      instrumented[path][method] = instrumentRoute(handler);
    }
  }
  return instrumented;
}

const server = Bun.serve({
  port: process.env.PORT || 3000,
  routes: {
    "/health": {
      GET: () => Response.json({
        status: "ok",
        service: "shop-api",
        timestamp: new Date().toISOString()
      }, { headers: corsHeaders }),
    },
    "/metrics": {
      GET: () => new Response(getMetricsOutput(), {
        headers: { "Content-Type": "text/plain" },
      }),
    },
    ...instrumentRoutes(productRoutes),
    ...instrumentRoutes(cartRoutes),
  },
  fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

logger.info('Server started', { port: server.port.toString() });
