// Initialize tracing FIRST - before any other imports
import { tracer, extractContext, createHttpSpan, createToolSpan, context } from './observability/tracing.js';
import { SpanStatusCode } from '@opentelemetry/api';

import { tools, getTool, listTools } from './tool-registry.js';
import { sessionStore } from './session-context.js';
import type { ToolCallRequest } from './types.js';
import { createLogger } from './observability/logger.js';
import { createHistogram, createCounter, getMetricsOutput } from './observability/metrics.js';

const logger = createLogger('mcp-tools');

// Metrics
const httpRequestDuration = createHistogram(
  'http_request_duration_seconds',
  'Duration of HTTP requests in seconds'
);
const httpRequestTotal = createCounter(
  'http_requests_total',
  'Total number of HTTP requests'
);
const toolInvocationDuration = createHistogram(
  'tool_invocation_duration_seconds',
  'Duration of tool invocations'
);
const toolInvocationsTotal = createCounter(
  'tool_invocations_total',
  'Total tool invocations'
);

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3001;

// Helper to safely parse JSON body
async function safeJsonParse<T extends object>(req: Request): Promise<{ data: T } | { error: string }> {
  try {
    const data = await req.json();
    // Validate that the body is an object (not null, array, or primitive)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { error: 'Request body must be a JSON object' };
    }
    return { data: data as T };
  } catch {
    return { error: 'Invalid JSON body' };
  }
}

Bun.serve({
  port: PORT,

  async fetch(req) {
    const startTime = Date.now();
    const url = new URL(req.url);
    const method = req.method;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, traceparent, tracestate',
      'Content-Type': 'application/json',
    };

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // Extract trace context from incoming request headers
    const parentContext = extractContext(req.headers);

    // Create a span for this request
    const span = createHttpSpan(
      `${method} ${url.pathname}`,
      method,
      url.pathname,
      parentContext
    );

    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;

    const logResponse = (status: number) => {
      const duration = (Date.now() - startTime) / 1000;
      logger.info('Request completed', {
        traceId,
        spanId,
        method,
        path: url.pathname,
        status: status.toString(),
        duration_ms: (duration * 1000).toFixed(2),
      });
      httpRequestDuration.observe(duration, { method, path: url.pathname, status: status.toString() });
      httpRequestTotal.inc({ method, path: url.pathname, status: status.toString() });
    };

    logger.info('Incoming request', {
      traceId,
      spanId,
      method,
      path: url.pathname,
    });

    try {
      // Health check
      if (url.pathname === '/health' && method === 'GET') {
        span.setAttribute('http.status_code', 200);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        logResponse(200);
        return Response.json({ status: 'ok', tools: tools.length }, { headers });
      }

      // Metrics endpoint
      if (url.pathname === '/metrics' && method === 'GET') {
        span.setAttribute('http.status_code', 200);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return new Response(getMetricsOutput(), {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      // List tools
      if (url.pathname === '/tools' && method === 'GET') {
        span.setAttribute('http.status_code', 200);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        logResponse(200);
        return Response.json(listTools(), { headers });
      }

      // Call tool
      const toolMatch = url.pathname.match(/^\/tools\/([^/]+)\/call$/);
      if (toolMatch && method === 'POST') {
        const toolName = toolMatch[1];
        const tool = getTool(toolName);

        if (!tool) {
          span.setAttribute('http.status_code', 404);
          span.setStatus({ code: SpanStatusCode.ERROR, message: `Unknown tool: ${toolName}` });
          span.end();
          logResponse(404);
          return Response.json(
            { success: false, error: `Unknown tool: ${toolName}` },
            { status: 404, headers }
          );
        }

        const parsed = await safeJsonParse<ToolCallRequest>(req);
        if ('error' in parsed) {
          span.setAttribute('http.status_code', 400);
          span.setStatus({ code: SpanStatusCode.ERROR, message: parsed.error });
          span.end();
          logResponse(400);
          return Response.json({ success: false, error: parsed.error }, { status: 400, headers });
        }
        const body = parsed.data;
        const sessionId = body.sessionId || 'default';

        // Create a child span for the tool invocation
        const toolSpan = createToolSpan(toolName, sessionId);
        toolSpan.setAttribute('tool.args', JSON.stringify(body.args));

        logger.info('Tool invocation started', {
          traceId,
          spanId,
          tool: toolName,
          sessionId,
          args: JSON.stringify(body.args),
        });

        const toolStartTime = Date.now();

        try {
          const result = await tool.handler(body.args, sessionId);
          const toolDuration = (Date.now() - toolStartTime) / 1000;

          toolSpan.setStatus({ code: SpanStatusCode.OK });
          toolSpan.end();

          logger.info('Tool invocation completed', {
            traceId,
            spanId,
            tool: toolName,
            sessionId,
            success: 'true',
            duration_ms: (toolDuration * 1000).toFixed(2),
          });

          toolInvocationDuration.observe(toolDuration, { tool: toolName, success: 'true' });
          toolInvocationsTotal.inc({ tool: toolName, success: 'true' });

          span.setAttribute('http.status_code', 200);
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          logResponse(200);
          return Response.json({ success: true, result }, { headers });
        } catch (error) {
          const toolDuration = (Date.now() - toolStartTime) / 1000;
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          const stack = error instanceof Error ? error.stack : undefined;

          toolSpan.setStatus({ code: SpanStatusCode.ERROR, message });
          toolSpan.recordException(error instanceof Error ? error : new Error(message));
          toolSpan.end();

          logger.error('Tool invocation failed', {
            traceId,
            spanId,
            tool: toolName,
            sessionId,
            error: message,
            stack,
            duration_ms: (toolDuration * 1000).toFixed(2),
          });

          toolInvocationDuration.observe(toolDuration, { tool: toolName, success: 'false' });
          toolInvocationsTotal.inc({ tool: toolName, success: 'false' });

          span.setAttribute('http.status_code', 400);
          span.setStatus({ code: SpanStatusCode.ERROR, message });
          span.end();
          logResponse(400);
          return Response.json({ success: false, error: message }, { status: 400, headers });
        }
      }

      // Create session
      if (url.pathname === '/sessions' && method === 'POST') {
        const parsed = await safeJsonParse<{ sessionId: string }>(req);
        if ('error' in parsed) {
          span.setAttribute('http.status_code', 400);
          span.setStatus({ code: SpanStatusCode.ERROR, message: parsed.error });
          span.end();
          logResponse(400);
          return Response.json({ error: parsed.error }, { status: 400, headers });
        }
        const body = parsed.data;
        if (!body.sessionId) {
          span.setAttribute('http.status_code', 400);
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'sessionId is required' });
          span.end();
          logResponse(400);
          return Response.json({ error: 'sessionId is required' }, { status: 400, headers });
        }
        sessionStore.getOrCreate(body.sessionId);
        logger.info('Session created', {
          traceId,
          sessionId: body.sessionId,
        });
        span.setAttribute('http.status_code', 201);
        span.setAttribute('session.id', body.sessionId);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        logResponse(201);
        return Response.json({ sessionId: body.sessionId, status: 'created' }, { status: 201, headers });
      }

      // Delete session (with headless session cleanup)
      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
      if (sessionMatch && method === 'DELETE') {
        const sessionId = sessionMatch[1];
        const deleted = await sessionStore.deleteWithCleanup(sessionId);
        if (deleted) {
          logger.info('Session deleted', {
            traceId,
            sessionId,
          });
          span.setAttribute('http.status_code', 200);
          span.setAttribute('session.id', sessionId);
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          logResponse(200);
          return Response.json({ sessionId, status: 'deleted' }, { headers });
        }
        span.setAttribute('http.status_code', 404);
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Session not found' });
        span.end();
        logResponse(404);
        return Response.json({ sessionId, status: 'not_found' }, { status: 404, headers });
      }

      // 404
      span.setAttribute('http.status_code', 404);
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Not found' });
      span.end();
      logResponse(404);
      return Response.json({ error: 'Not found' }, { status: 404, headers });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error('Request failed', {
        traceId,
        spanId,
        method,
        path: url.pathname,
        error: message,
        stack,
      });
      span.setAttribute('http.status_code', 500);
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      span.recordException(error instanceof Error ? error : new Error(message));
      span.end();
      logResponse(500);
      return Response.json({ error: message }, { status: 500, headers });
    }
  },
});

logger.info('Server started', { port: PORT.toString() });
logger.info('Available tools', { tools: tools.map(t => t.name).join(', ') });
