import {
  initializeFaro,
  type Faro,
  ConsoleInstrumentation,
  ErrorsInstrumentation,
  WebVitalsInstrumentation,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

let faro: Faro | null = null;
let initAttempted = false;

export function initFaro(): Faro | null {
  if (faro) return faro;
  if (initAttempted) return null;
  if (typeof window === 'undefined') return null;

  initAttempted = true;

  // Bun doesn't use Vite's import.meta.env pattern - use default URL
  const collectorUrl = 'http://localhost:12347/collect';

  try {
    faro = initializeFaro({
      url: collectorUrl,
      app: {
        name: 'chat-ui',
        version: '1.0.0',
        environment: 'development',
      },
      // Use specific instrumentations to avoid problematic ones
      instrumentations: [
        new ErrorsInstrumentation(),
        new ConsoleInstrumentation({ disabledLevels: [] }),
        new WebVitalsInstrumentation(),
        new TracingInstrumentation({
          instrumentationOptions: {
            propagateTraceHeaderCorsUrls: [
              /localhost/,
              /mcp-tools/,
            ],
          },
        }),
      ],
      sessionTracking: {
        enabled: true,
        persistent: true,
      },
    });

    console.log('[Faro] Initialized successfully');
    return faro;
  } catch (error) {
    console.warn('[Faro] Failed to initialize:', error);
    return null;
  }
}

export function getFaro(): Faro | null {
  return faro;
}

// Event logging helpers
export function logUserMessage(content: string, sessionId: string) {
  const f = getFaro();
  if (!f) return;

  f.api.pushEvent('user_message', {
    session_id: sessionId,
    content_length: content.length.toString(),
    timestamp: new Date().toISOString(),
  });

  f.api.pushLog([`User message: ${content.substring(0, 100)}`], {
    level: 'info',
    context: { session_id: sessionId },
  });
}

export function logPatternMatch(pattern: string, toolName: string | null, sessionId: string) {
  const f = getFaro();
  if (!f) return;

  f.api.pushEvent('pattern_match', {
    pattern: pattern.substring(0, 100),
    tool_name: toolName || 'none',
    matched: toolName !== null ? 'true' : 'false',
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  });
}

export function logToolInvocation(
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string
) {
  const f = getFaro();
  if (!f) return;

  f.api.pushEvent('tool_invocation', {
    tool_name: toolName,
    args: JSON.stringify(args),
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  });

  f.api.pushLog([`Tool invocation: ${toolName}`], {
    level: 'info',
    context: {
      tool_name: toolName,
      args: JSON.stringify(args),
      session_id: sessionId,
    },
  });
}

export function logToolResult(
  toolName: string,
  success: boolean,
  durationMs: number,
  sessionId: string,
  error?: string
) {
  const f = getFaro();
  if (!f) return;

  f.api.pushEvent('tool_result', {
    tool_name: toolName,
    success: success.toString(),
    duration_ms: durationMs.toString(),
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  });

  if (!success && error) {
    f.api.pushError(new Error(`Tool failed: ${toolName} - ${error}`), {
      type: 'tool_failure',
      context: {
        tool_name: toolName,
        session_id: sessionId,
      },
    });
  }
}

export function logError(error: Error, context: Record<string, string> = {}) {
  const f = getFaro();
  if (!f) return;

  f.api.pushError(error, {
    type: 'application_error',
    context,
  });
}
