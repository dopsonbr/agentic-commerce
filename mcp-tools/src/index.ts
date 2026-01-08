import { tools, getTool, listTools } from './tool-registry.js';
import { sessionStore } from './session-context.js';
import type { ToolCallRequest } from './types.js';
import { createLogger, extractTraceContext, generateTraceContext } from './observability/logger.js';
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

Bun.serve({
  port: PORT,

  async fetch(req) {
    const startTime = Date.now();
    const url = new URL(req.url);
    const method = req.method;

    // Extract or generate trace context
    const { traceId: existingTraceId } = extractTraceContext(req.headers);
    const trace = generateTraceContext(existingTraceId);

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

    const logResponse = (status: number) => {
      const duration = (Date.now() - startTime) / 1000;
      logger.info('Request completed', {
        traceId: trace.traceId,
        spanId: trace.spanId,
        method,
        path: url.pathname,
        status: status.toString(),
        duration_ms: (duration * 1000).toFixed(2),
      });
      httpRequestDuration.observe(duration, { method, path: url.pathname, status: status.toString() });
      httpRequestTotal.inc({ method, path: url.pathname, status: status.toString() });
    };

    logger.info('Incoming request', {
      traceId: trace.traceId,
      spanId: trace.spanId,
      method,
      path: url.pathname,
    });

    try {
      // Health check
      if (url.pathname === '/health' && method === 'GET') {
        logResponse(200);
        return Response.json({ status: 'ok', tools: tools.length }, { headers });
      }

      // Metrics endpoint
      if (url.pathname === '/metrics' && method === 'GET') {
        return new Response(getMetricsOutput(), {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      // List tools
      if (url.pathname === '/tools' && method === 'GET') {
        logResponse(200);
        return Response.json(listTools(), { headers });
      }

      // Call tool
      const toolMatch = url.pathname.match(/^\/tools\/([^/]+)\/call$/);
      if (toolMatch && method === 'POST') {
        const toolName = toolMatch[1];
        const tool = getTool(toolName);

        if (!tool) {
          logResponse(404);
          return Response.json(
            { success: false, error: `Unknown tool: ${toolName}` },
            { status: 404, headers }
          );
        }

        const body = await req.json() as ToolCallRequest;
        const sessionId = body.sessionId || 'default';

        logger.info('Tool invocation started', {
          traceId: trace.traceId,
          spanId: trace.spanId,
          tool: toolName,
          sessionId,
          args: JSON.stringify(body.args),
        });

        const toolStartTime = Date.now();

        try {
          const result = await tool.handler(body.args, sessionId);
          const toolDuration = (Date.now() - toolStartTime) / 1000;

          logger.info('Tool invocation completed', {
            traceId: trace.traceId,
            spanId: trace.spanId,
            tool: toolName,
            sessionId,
            success: 'true',
            duration_ms: (toolDuration * 1000).toFixed(2),
          });

          toolInvocationDuration.observe(toolDuration, { tool: toolName, success: 'true' });
          toolInvocationsTotal.inc({ tool: toolName, success: 'true' });

          logResponse(200);
          return Response.json({ success: true, result }, { headers });
        } catch (error) {
          const toolDuration = (Date.now() - toolStartTime) / 1000;
          const message = error instanceof Error ? error.message : 'Tool execution failed';

          logger.error('Tool invocation failed', {
            traceId: trace.traceId,
            spanId: trace.spanId,
            tool: toolName,
            sessionId,
            error: message,
            duration_ms: (toolDuration * 1000).toFixed(2),
          });

          toolInvocationDuration.observe(toolDuration, { tool: toolName, success: 'false' });
          toolInvocationsTotal.inc({ tool: toolName, success: 'false' });

          logResponse(400);
          return Response.json({ success: false, error: message }, { status: 400, headers });
        }
      }

      // Create session
      if (url.pathname === '/sessions' && method === 'POST') {
        const body = await req.json() as { sessionId: string };
        sessionStore.getOrCreate(body.sessionId);
        logger.info('Session created', {
          traceId: trace.traceId,
          sessionId: body.sessionId,
        });
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
            traceId: trace.traceId,
            sessionId,
          });
          logResponse(200);
          return Response.json({ sessionId, status: 'deleted' }, { headers });
        }
        logResponse(404);
        return Response.json({ sessionId, status: 'not_found' }, { status: 404, headers });
      }

      // 404
      logResponse(404);
      return Response.json({ error: 'Not found' }, { status: 404, headers });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      logger.error('Request failed', {
        traceId: trace.traceId,
        spanId: trace.spanId,
        method,
        path: url.pathname,
        error: message,
      });
      logResponse(500);
      return Response.json({ error: message }, { status: 500, headers });
    }
  },
});

logger.info('Server started', { port: PORT.toString() });
logger.info('Available tools', { tools: tools.map(t => t.name).join(', ') });
