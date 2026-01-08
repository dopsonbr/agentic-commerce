import {
  initializeFaro,
  getWebInstrumentations,
  type Faro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

let faro: Faro | null = null;

export function initFaro(): Faro | null {
  if (faro) return faro;

  // Get collector URL from window or use default
  const collectorUrl = (window as any).__FARO_COLLECTOR_URL__ || 'http://localhost:12347/collect';

  try {
    faro = initializeFaro({
      url: collectorUrl,
      app: {
        name: 'shop-ui',
        version: '1.0.0',
        environment: 'development',
      },
      instrumentations: [
        ...getWebInstrumentations({
          captureConsole: true,
          captureConsoleDisabledLevels: [],
        }),
        new TracingInstrumentation({
          instrumentationOptions: {
            propagateTraceHeaderCorsUrls: [
              /localhost/,
              /shop-api/,
              /mcp-tools/,
            ],
          },
        }),
      ],
      sessionTracking: {
        enabled: true,
        persistent: true,
      },
      batching: {
        enabled: true,
        sendTimeout: 1000,
        itemLimit: 50,
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
