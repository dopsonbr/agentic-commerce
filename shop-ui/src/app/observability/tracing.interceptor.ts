import { HttpInterceptorFn } from '@angular/common/http';
import { getFaro } from './faro.config';

export const tracingInterceptor: HttpInterceptorFn = (req, next) => {
  const faro = getFaro();

  if (faro) {
    const traceContext = faro.api.getTraceContext?.() as Record<string, string> | undefined;
    if (traceContext) {
      // Faro returns snake_case (trace_id, span_id) per its type definitions
      // Handle both conventions for robustness
      const traceId = traceContext['trace_id'] || traceContext['traceId'];
      const spanId = traceContext['span_id'] || traceContext['spanId'];

      if (traceId && spanId) {
        // Build W3C traceparent header: version-traceid-spanid-flags
        // version: 00 (current), flags: 01 (sampled)
        const traceparent = `00-${traceId}-${spanId}-01`;
        req = req.clone({
          setHeaders: {
            'traceparent': traceparent,
          },
        });
      }
    }

    // Log the HTTP request as an event
    faro.api.pushEvent('http_request', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  return next(req);
};
