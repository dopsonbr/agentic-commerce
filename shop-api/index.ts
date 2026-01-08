import { productRoutes } from "./src/routes/products.ts";
import { cartRoutes } from "./src/routes/cart.ts";
import { corsHeaders } from "./src/cors.ts";
import { createLogger, extractTraceContext, generateTraceContext } from "./src/observability/logger.ts";
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
    const { traceId, spanId } = extractTraceContext(req.headers);
    const trace = generateTraceContext(traceId);

    logger.info('Incoming request', {
      traceId: trace.traceId,
      spanId: trace.spanId,
      method: req.method,
      path: url.pathname,
    });

    try {
      const response = await handler(req);
      const duration = (Date.now() - startTime) / 1000;

      logger.info('Request completed', {
        traceId: trace.traceId,
        spanId: trace.spanId,
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

      return response;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Request failed', {
        traceId: trace.traceId,
        spanId: trace.spanId,
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

      // Return 500 response instead of re-throwing
      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
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
