import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, SpanKind, context, propagation, Span } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

const serviceName = process.env.OTEL_SERVICE_NAME || 'mcp-tools';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// Set up W3C Trace Context propagation
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessor: new SimpleSpanProcessor(traceExporter),
});

// Start the SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

console.log(`[OpenTelemetry] Initialized for service: ${serviceName}, endpoint: ${otlpEndpoint}`);

export const tracer = trace.getTracer(serviceName);

// Helper to extract trace context from incoming request headers
export function extractContext(headers: Headers): ReturnType<typeof context.active> {
  const carrier: Record<string, string> = {};
  headers.forEach((value, key) => {
    carrier[key.toLowerCase()] = value;
  });
  return propagation.extract(context.active(), carrier);
}

// Helper to inject trace context into outgoing request headers
export function injectContext(headers: Record<string, string>, span?: Span): Record<string, string> {
  const carrier: Record<string, string> = { ...headers };
  // If a span is provided, use its context for propagation
  if (span) {
    const spanContext = trace.setSpan(context.active(), span);
    propagation.inject(spanContext, carrier);
  } else {
    propagation.inject(context.active(), carrier);
  }
  return carrier;
}

// Helper to create a span for HTTP requests
export function createHttpSpan(
  name: string,
  method: string,
  path: string,
  parentContext?: ReturnType<typeof context.active>
): Span {
  const ctx = parentContext || context.active();
  return tracer.startSpan(
    name,
    {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.target': path,
        'http.route': path,
      },
    },
    ctx
  );
}

// Helper to create a span for tool invocations
export function createToolSpan(
  toolName: string,
  sessionId: string,
  parentContext?: ReturnType<typeof context.active>
): Span {
  const ctx = parentContext || context.active();
  return tracer.startSpan(
    `tool.${toolName}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'tool.name': toolName,
        'session.id': sessionId,
      },
    },
    ctx
  );
}

// Helper to create a span for outgoing HTTP requests (client calls)
export function createClientSpan(
  name: string,
  method: string,
  url: string
): Span {
  return tracer.startSpan(
    name,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method,
        'http.url': url,
      },
    }
  );
}

export { context, SpanKind };
