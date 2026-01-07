import express, { type Request, type Response } from 'express';
import { SessionManager } from './session-manager.js';
import type { CreateSessionRequest, ExecuteCommandRequest } from './types.js';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3002;
const sessionManager = new SessionManager();

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    sessions: sessionManager.getSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

// Create session
app.post('/sessions', async (req: Request, res: Response) => {
  const { sessionId } = req.body as CreateSessionRequest;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  try {
    await sessionManager.createSession(sessionId);
    res.status(201).json({ sessionId, status: 'created' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session';
    console.error(`[API] Create session error:`, message);
    res.status(500).json({ error: message });
  }
});

// Destroy session
app.delete('/sessions/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  const destroyed = await sessionManager.destroySession(id);
  if (destroyed) {
    res.json({ sessionId: id, status: 'destroyed' });
  } else {
    res.status(404).json({ error: `Session not found: ${id}` });
  }
});

// Execute command
app.post('/sessions/:id/execute', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { action, successTypes, failureTypes, timeout } = req.body as ExecuteCommandRequest;

  if (!action || !successTypes || !failureTypes) {
    res.status(400).json({
      error: 'action, successTypes, and failureTypes are required',
    });
    return;
  }

  if (!sessionManager.hasSession(id)) {
    res.status(404).json({ error: `Session not found: ${id}` });
    return;
  }

  try {
    const result = await sessionManager.executeCommand(id, {
      action,
      successTypes,
      failureTypes,
      timeout,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution failed';
    res.status(500).json({ success: false, error: message });
  }
});

// Get state
app.get('/sessions/:id/state', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  const state = await sessionManager.getState(id);
  if (state === null) {
    res.status(404).json({ error: `Session not found: ${id}` });
    return;
  }

  res.json(state);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await sessionManager.destroyAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Terminating...');
  await sessionManager.destroyAllSessions();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] headless-session-manager running on http://localhost:${PORT}`);
  console.log(`[Server] Endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  POST /sessions`);
  console.log(`  DELETE /sessions/:id`);
  console.log(`  POST /sessions/:id/execute`);
  console.log(`  GET  /sessions/:id/state`);
});
