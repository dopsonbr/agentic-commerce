import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { SessionManager } from './session-manager.js';
import type { CreateSessionRequest, ExecuteCommandRequest } from './types.js';
import { createLogger, extractTraceContext, generateTraceContext } from './observability/logger.js';
import { createHistogram, createCounter, createGauge, getMetricsOutput } from './observability/metrics.js';

const logger = createLogger('headless-session-manager');

// Metrics
const httpRequestDuration = createHistogram(
  'http_request_duration_seconds',
  'Duration of HTTP requests in seconds'
);
const httpRequestTotal = createCounter(
  'http_requests_total',
  'Total number of HTTP requests'
);
const sessionCreationDuration = createHistogram(
  'session_creation_duration_seconds',
  'Time to create browser sessions'
);
const bridgeExecutionDuration = createHistogram(
  'bridge_execution_duration_seconds',
  'Time to execute bridge commands'
);
const activeSessions = createGauge(
  'active_sessions',
  'Number of active browser sessions'
);

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3002;
const sessionManager = new SessionManager();

const app = express();
app.use(cors());
app.use(express.json());

// Extend Request to include trace context
declare global {
  namespace Express {
    interface Request {
      traceContext?: {
        traceId: string;
        spanId: string;
        traceparent: string;
      };
    }
  }
}

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const rawHeaders = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      rawHeaders.set(key, value);
    }
  }
  const { traceId: existingTraceId } = extractTraceContext(rawHeaders);
  const trace = generateTraceContext(existingTraceId);
  req.traceContext = trace;

  logger.info('Incoming request', {
    traceId: trace.traceId,
    spanId: trace.spanId,
    method: req.method,
    path: req.path,
  });

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    logger.info('Request completed', {
      traceId: trace.traceId,
      spanId: trace.spanId,
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
      duration_ms: (duration * 1000).toFixed(2),
    });
    httpRequestDuration.observe(duration, {
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
    });
    httpRequestTotal.inc({
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
    });
  });

  next();
});

// Update active sessions gauge periodically
setInterval(() => {
  activeSessions.set(sessionManager.getSessionCount());
}, 5000);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    sessions: sessionManager.getSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', (_req: Request, res: Response) => {
  activeSessions.set(sessionManager.getSessionCount());
  res.set('Content-Type', 'text/plain');
  res.send(getMetricsOutput());
});

// Create session
app.post('/sessions', async (req: Request, res: Response) => {
  const { sessionId } = req.body as CreateSessionRequest;
  const trace = req.traceContext!;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const startTime = Date.now();

  try {
    logger.info('Creating session', {
      traceId: trace.traceId,
      sessionId,
    });

    await sessionManager.createSession(sessionId);

    const duration = (Date.now() - startTime) / 1000;
    sessionCreationDuration.observe(duration, { status: 'success' });

    logger.info('Session created', {
      traceId: trace.traceId,
      sessionId,
      duration_ms: (duration * 1000).toFixed(2),
    });

    res.status(201).json({ sessionId, status: 'created' });
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    sessionCreationDuration.observe(duration, { status: 'error' });

    const message = error instanceof Error ? error.message : 'Failed to create session';
    logger.error('Session creation failed', {
      traceId: trace.traceId,
      sessionId,
      error: message,
      duration_ms: (duration * 1000).toFixed(2),
    });
    res.status(500).json({ error: message });
  }
});

// Destroy session
app.delete('/sessions/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const trace = req.traceContext!;

  const destroyed = await sessionManager.destroySession(id);
  if (destroyed) {
    logger.info('Session destroyed', {
      traceId: trace.traceId,
      sessionId: id,
    });
    res.json({ sessionId: id, status: 'destroyed' });
  } else {
    logger.warn('Session not found for destruction', {
      traceId: trace.traceId,
      sessionId: id,
    });
    res.status(404).json({ error: `Session not found: ${id}` });
  }
});

// Execute command
app.post('/sessions/:id/execute', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { action, successTypes, failureTypes, timeout } = req.body as ExecuteCommandRequest;
  const trace = req.traceContext!;

  if (!action || !successTypes || !failureTypes) {
    res.status(400).json({
      error: 'action, successTypes, and failureTypes are required',
    });
    return;
  }

  if (typeof action.type !== 'string' || action.type.length === 0) {
    res.status(400).json({
      error: 'action.type must be a non-empty string',
    });
    return;
  }

  if (!sessionManager.hasSession(id)) {
    logger.warn('Session not found for execution', {
      traceId: trace.traceId,
      sessionId: id,
      action: action.type,
    });
    res.status(404).json({ error: `Session not found: ${id}` });
    return;
  }

  const startTime = Date.now();

  try {
    logger.info('Executing bridge command', {
      traceId: trace.traceId,
      sessionId: id,
      action: action.type,
    });

    const result = await sessionManager.executeCommand(id, {
      action,
      successTypes,
      failureTypes,
      timeout,
    });

    const duration = (Date.now() - startTime) / 1000;
    bridgeExecutionDuration.observe(duration, {
      action: action.type,
      success: result.success ? 'true' : 'false',
    });

    logger.info('Bridge command completed', {
      traceId: trace.traceId,
      sessionId: id,
      action: action.type,
      success: result.success.toString(),
      duration_ms: (duration * 1000).toFixed(2),
    });

    res.json(result);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    bridgeExecutionDuration.observe(duration, {
      action: action.type,
      success: 'false',
    });

    const message = error instanceof Error ? error.message : 'Execution failed';
    logger.error('Bridge command failed', {
      traceId: trace.traceId,
      sessionId: id,
      action: action.type,
      error: message,
      duration_ms: (duration * 1000).toFixed(2),
    });
    res.status(500).json({ success: false, error: message });
  }
});

// Get state
app.get('/sessions/:id/state', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const trace = req.traceContext!;

  const state = await sessionManager.getState(id);
  if (state === null) {
    logger.warn('Session not found for state retrieval', {
      traceId: trace.traceId,
      sessionId: id,
    });
    res.status(404).json({ error: `Session not found: ${id}` });
    return;
  }

  logger.debug('State retrieved', {
    traceId: trace.traceId,
    sessionId: id,
  });
  res.json(state);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down (SIGINT)');
  await sessionManager.destroyAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Terminating (SIGTERM)');
  await sessionManager.destroyAllSessions();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info('Server started', { port: PORT.toString() });
  logger.info('Endpoints available', {
    endpoints: 'GET /health, GET /metrics, POST /sessions, DELETE /sessions/:id, POST /sessions/:id/execute, GET /sessions/:id/state',
  });
});
