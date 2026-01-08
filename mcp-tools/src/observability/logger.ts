interface LogContext {
  traceId?: string;
  spanId?: string;
  service: string;
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function formatLog(level: LogLevel, message: string, context: LogContext): string {
  const timestamp = new Date().toISOString();
  const logObj = {
    timestamp,
    level,
    message,
    ...context,
  };
  return JSON.stringify(logObj);
}

export function createLogger(service: string) {
  const baseContext: LogContext = { service };

  return {
    debug(message: string, context: Partial<LogContext> = {}) {
      if (shouldLog('debug')) {
        console.log(formatLog('debug', message, { ...baseContext, ...context }));
      }
    },
    info(message: string, context: Partial<LogContext> = {}) {
      if (shouldLog('info')) {
        console.log(formatLog('info', message, { ...baseContext, ...context }));
      }
    },
    warn(message: string, context: Partial<LogContext> = {}) {
      if (shouldLog('warn')) {
        console.warn(formatLog('warn', message, { ...baseContext, ...context }));
      }
    },
    error(message: string, context: Partial<LogContext> = {}) {
      if (shouldLog('error')) {
        console.error(formatLog('error', message, { ...baseContext, ...context }));
      }
    },
  };
}

// Extract trace context from headers
export function extractTraceContext(headers: Headers): { traceId?: string; spanId?: string } {
  const traceparent = headers.get('traceparent');
  if (!traceparent) return {};

  // W3C Trace Context format: version-traceId-spanId-flags
  const parts = traceparent.split('-');
  if (parts.length >= 3) {
    return {
      traceId: parts[1],
      spanId: parts[2],
    };
  }
  return {};
}

// Generate trace context for outgoing requests
export function generateTraceContext(existingTraceId?: string): {
  traceparent: string;
  traceId: string;
  spanId: string;
} {
  const traceId = existingTraceId || generateTraceId();
  const spanId = generateSpanId();
  return {
    traceparent: `00-${traceId}-${spanId}-01`,
    traceId,
    spanId,
  };
}

function generateTraceId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function generateSpanId(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}
