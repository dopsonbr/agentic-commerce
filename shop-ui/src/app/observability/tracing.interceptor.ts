import { HttpInterceptorFn } from '@angular/common/http';
import { getFaro } from './faro.config';

export const tracingInterceptor: HttpInterceptorFn = (req, next) => {
  const faro = getFaro();

  if (faro) {
    const traceContext = faro.api.getTraceContext?.();
    if (traceContext) {
      // Build W3C traceparent header from trace context
      // Format: version-trace_id-span_id-flags (00 = not sampled, 01 = sampled)
      const traceparent = `00-${traceContext.trace_id}-${traceContext.span_id}-01`;
      req = req.clone({
        setHeaders: {
          'traceparent': traceparent,
        },
      });
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
