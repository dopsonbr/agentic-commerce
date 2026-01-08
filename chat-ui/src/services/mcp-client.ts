const MCP_TOOLS_URL = 'http://localhost:3001';

export interface ToolCallResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

export async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string
): Promise<ToolCallResult<T>> {
  try {
    const response = await fetch(`${MCP_TOOLS_URL}/tools/${toolName}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, args }),
    });

    const data = await response.json();
    return data as ToolCallResult<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function listTools(): Promise<unknown[]> {
  try {
    const response = await fetch(`${MCP_TOOLS_URL}/tools`);
    return response.json();
  } catch {
    return [];
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MCP_TOOLS_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
