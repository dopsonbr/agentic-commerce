import { tools, getTool, listTools } from './tool-registry.js';
import { sessionStore } from './session-context.js';
import type { ToolCallRequest } from './types.js';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3001;

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Health check
      if (url.pathname === '/health' && method === 'GET') {
        return Response.json({ status: 'ok', tools: tools.length }, { headers });
      }

      // List tools
      if (url.pathname === '/tools' && method === 'GET') {
        return Response.json(listTools(), { headers });
      }

      // Call tool
      const toolMatch = url.pathname.match(/^\/tools\/([^/]+)\/call$/);
      if (toolMatch && method === 'POST') {
        const toolName = toolMatch[1];
        const tool = getTool(toolName);

        if (!tool) {
          return Response.json(
            { success: false, error: `Unknown tool: ${toolName}` },
            { status: 404, headers }
          );
        }

        const body = await req.json() as ToolCallRequest;
        const sessionId = body.sessionId || 'default';

        try {
          const result = await tool.handler(body.args, sessionId);
          return Response.json({ success: true, result }, { headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          return Response.json({ success: false, error: message }, { status: 400, headers });
        }
      }

      // Create session
      if (url.pathname === '/sessions' && method === 'POST') {
        const body = await req.json() as { sessionId: string };
        sessionStore.getOrCreate(body.sessionId);
        return Response.json({ sessionId: body.sessionId, status: 'created' }, { status: 201, headers });
      }

      // Delete session
      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
      if (sessionMatch && method === 'DELETE') {
        const sessionId = sessionMatch[1];
        sessionStore.delete(sessionId);
        return Response.json({ sessionId, status: 'deleted' }, { headers });
      }

      // 404
      return Response.json({ error: 'Not found' }, { status: 404, headers });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      return Response.json({ error: message }, { status: 500, headers });
    }
  },
});

console.log(`[mcp-tools] Server running on http://localhost:${PORT}`);
console.log(`[mcp-tools] Available tools: ${tools.map(t => t.name).join(', ')}`);
