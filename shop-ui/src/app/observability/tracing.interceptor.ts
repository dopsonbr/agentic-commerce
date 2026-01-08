import { HttpInterceptorFn } from '@angular/common/http';
import { getFaro } from './faro.config';

export const tracingInterceptor: HttpInterceptorFn = (req, next) => {
  const faro = getFaro();

  if (faro) {
    const traceContext = faro.api.getTraceContext?.();
    if (traceContext) {
      req = req.clone({
        setHeaders: {
          'traceparent': traceContext.traceparent || '',
          'tracestate': traceContext.tracestate || '',
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
