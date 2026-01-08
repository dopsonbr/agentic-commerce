# Observability User Guide

This guide explains how to use the observability tools implemented in Phase 7 of the Agentic Commerce project.

---

## Quick Start

### Starting the Stack

```bash
# Start everything (apps + observability)
cd docker
./scripts/start.sh

# Or use docker compose directly
docker compose up -d
```

### Accessing Dashboards

| Tool | URL | Purpose |
|------|-----|---------|
| **Grafana** | http://localhost:3003 | Main dashboard UI |
| **Prometheus** | http://localhost:9090 | Metrics queries |
| **Tempo** | http://localhost:3200 | Trace backend (use via Grafana) |
| **Loki** | http://localhost:3100 | Log backend (use via Grafana) |
| **Alloy** | http://localhost:12345 | Telemetry collector status |

Grafana is pre-configured with anonymous access enabled, so no login is required.

---

## Understanding the Dashboards

### 1. Overview Dashboard

**Location:** Grafana → Dashboards → Agentic Commerce → Overview

This dashboard provides a bird's-eye view of the entire system:

| Panel | What It Shows | Use When |
|-------|---------------|----------|
| **Service Health** | Up/Down status of all 5 services | First place to check if something's wrong |
| **Request Rate** | Requests per second across services | Understanding load patterns |
| **Error Rate** | Failed requests per second | Identifying problem areas |
| **Latency (P50/P95/P99)** | Response time percentiles | Performance monitoring |
| **Active Sessions** | Browser sessions in headless-session-manager | Resource monitoring |
| **Recent Logs** | Live log stream from all services | Quick debugging |

**Suggested Workflow:**
1. Check Service Health first
2. If errors are high, look at Recent Logs
3. Click on error logs to jump to related traces

### 2. User Journey Dashboard

**Location:** Grafana → Dashboards → Agentic Commerce → User Journey

This dashboard helps you trace complete user interactions:

| Panel | What It Shows | Use When |
|-------|---------------|----------|
| **Trace Search** | Search by trace ID, session ID, or tool name | Finding specific requests |
| **Journey Funnel** | Conversion through Search → Details → Cart → Checkout | Understanding drop-off |
| **Chat Flow Visualization** | Message → Pattern → Tool → Result timeline | Debugging chat interactions |
| **Service Map** | Visual graph of service dependencies | Understanding architecture |
| **Trace Timeline** | Gantt-style view of trace spans | Identifying bottlenecks |

**Suggested Workflow:**
1. Use Trace Search to find a specific interaction
2. Open the trace in Trace Timeline
3. Click spans to see detailed timing and logs
4. Use Service Map to understand the call flow

### 3. NgRx Actions Dashboard

**Location:** Grafana → Dashboards → Agentic Commerce → NgRx Actions

This dashboard is specific to Angular shop-ui state changes:

| Panel | What It Shows | Use When |
|-------|---------------|----------|
| **Action Stream** | Live stream of [Cart] and [Products] actions | Real-time state debugging |
| **Action Frequency** | Most commonly dispatched actions | Understanding user behavior |
| **Action Failures** | Failed actions with error details | Debugging state issues |
| **State Change Timeline** | Actions correlated with API calls | Tracing state mutations |
| **Cart State Tracker** | Visual cart state evolution | Cart debugging |

**Suggested Workflow:**
1. Watch Action Stream while reproducing an issue
2. When you see a Failure action, click to see the error
3. Use State Change Timeline to correlate with backend calls
4. Click the trace link to see full distributed trace

### 4. Tool Invocations Dashboard

**Location:** Grafana → Dashboards → Agentic Commerce → Tool Invocations

This dashboard focuses on MCP tool execution:

| Panel | What It Shows | Use When |
|-------|---------------|----------|
| **Tool Usage** | Breakdown by tool name | Understanding feature usage |
| **Tool Latency** | Per-tool P50/P95/P99 | Performance optimization |
| **Tool Errors** | Failed invocations with details | Debugging failures |
| **Session Recovery** | 404 recoveries and session recreations | Reliability monitoring |
| **Tool Chain Analysis** | Common sequences of tool calls | UX optimization |

**Suggested Workflow:**
1. Check Tool Errors for any failures
2. If latency is high, use Tool Latency to identify slow tools
3. Click a slow tool to see trace breakdown
4. Use Tool Chain Analysis to see common patterns

---

## Using the Trace Explorer

### Accessing Traces

1. Go to Grafana → Explore
2. Select "Tempo" as the data source
3. Use TraceQL to search

### Common Trace Queries

```
# Find traces by service name
{ resource.service.name = "chat-ui" }

# Find traces with errors
{ status = error }

# Find traces by tool name
{ span.tool_name = "add_to_cart" }

# Find slow traces (>1s)
{ duration > 1s }

# Find traces by session ID
{ span.session_id = "abc123" }

# Combined query
{ resource.service.name = "mcp-tools" && span.tool_name = "add_to_cart" && status = error }
```

### Reading a Trace

When you open a trace, you'll see:

1. **Trace Header** - Total duration, service count, span count
2. **Service Map** - Visual representation of the call flow
3. **Span List** - Hierarchical list of all spans
4. **Span Details** - Click any span to see:
   - Duration
   - Tags/attributes
   - Logs within that span
   - Related metrics

### Trace-to-Logs Correlation

When viewing a trace in Tempo:
1. Click on any span
2. Look for the "Logs" tab in the detail panel
3. Click to jump to Loki with pre-filtered query

This is bidirectional - logs in Loki that contain a `traceId` field will have a link back to Tempo.

---

## Using the Log Explorer

### Accessing Logs

1. Go to Grafana → Explore
2. Select "Loki" as the data source
3. Use LogQL to search

### Common Log Queries

```
# All logs from a service
{app="shop-api"}

# Error logs only
{app="mcp-tools"} |= "error"

# Logs containing a trace ID
{app=~".+"} |= "traceId=abc123"

# NgRx actions (from Faro)
{kind="event", event_name="ngrx_action"}

# Tool invocations
{kind="event", event_name="tool_invocation"}

# Logs with JSON parsing
{app="shop-api"} | json | level="error"

# Filter by HTTP status
{app="shop-api"} | json | status >= 400
```

### Reading Logs

Log entries include:
- **Timestamp** - When the log was recorded
- **Labels** - app, service, level, etc.
- **Content** - JSON-structured log message

For JSON logs, you can expand fields:
```
{app="shop-api"} | json | line_format "{{.method}} {{.path}} - {{.status}} ({{.duration_ms}}ms)"
```

### Log-to-Trace Correlation

When viewing a log entry:
1. Look for `traceId` in the log content
2. Click the "Tempo" link that appears
3. This opens the full distributed trace

---

## Understanding Trace Context Flow

### How Traces Propagate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRACE FLOW EXAMPLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User types "add headphones to cart" in chat-ui                         │
│     └─ Faro creates trace: traceId=abc123                                  │
│     └─ HTTP request includes: traceparent: 00-abc123-span1-01              │
│                                                                             │
│  2. mcp-tools receives request                                             │
│     └─ Extracts traceId from traceparent header                            │
│     └─ Creates child span: span2                                           │
│     └─ Logs include: {"traceId": "abc123", "tool": "add_to_cart"}          │
│                                                                             │
│  3. mcp-tools calls headless-session-manager                               │
│     └─ Propagates: traceparent: 00-abc123-span2-01                         │
│                                                                             │
│  4. headless-session-manager executes via Playwright                       │
│     └─ Creates span: span3                                                 │
│     └─ Injects trace context into page                                     │
│                                                                             │
│  5. shop-ui receives action dispatch                                       │
│     └─ NgRx meta-reducer logs to Faro with traceId                         │
│     └─ HTTP interceptor propagates to shop-api                             │
│                                                                             │
│  6. shop-api processes cart update                                         │
│     └─ Creates span: span4                                                 │
│     └─ Returns response                                                    │
│                                                                             │
│  RESULT: Single trace abc123 shows all 4 service interactions              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### W3C Trace Context Headers

All services propagate these headers:
- `traceparent`: `{version}-{traceId}-{spanId}-{flags}`
- `tracestate`: Optional vendor-specific data

Example:
```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

---

## Frontend Observability (Faro)

### What Gets Captured

**shop-ui (Angular):**
- Page load timing
- JavaScript errors
- Console logs (all levels)
- HTTP requests/responses
- NgRx actions ([Cart] and [Products] namespaces)
- User sessions

**chat-ui (React):**
- Page load timing
- JavaScript errors
- Console logs
- User messages (content length, not full content)
- Pattern match results
- Tool invocations and results
- User sessions

### Viewing Frontend Data

**In Grafana Explore (Loki):**
```
# All frontend events
{app=~"shop-ui|chat-ui", kind="event"}

# NgRx actions only
{app="shop-ui", event_name="ngrx_action"}

# Tool invocations from chat
{app="chat-ui", event_name="tool_invocation"}

# Frontend errors
{app=~"shop-ui|chat-ui", kind="exception"}
```

**In Grafana Explore (Tempo):**
```
# Frontend-initiated traces
{ resource.service.name = "shop-ui" }
{ resource.service.name = "chat-ui" }
```

### Session Correlation

Faro tracks sessions across page reloads. To find all activity for a session:

```
# In Loki
{app="chat-ui"} | json | session_id="<session-id>"

# In Tempo
{ span.session_id = "<session-id>" }
```

---

## Metrics and Alerting

### Available Metrics

**HTTP Metrics:**
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Total request count

**Tool Metrics:**
- `tool_invocation_duration_seconds` - Tool execution time
- `tool_invocations_total` - Tool invocation count

**Session Metrics:**
- `active_sessions` - Current browser session count

### Querying Metrics

In Grafana Explore with Prometheus:

```promql
# Request rate
rate(http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Tool success rate
sum(rate(tool_invocations_total{success="true"}[5m]))
/
sum(rate(tool_invocations_total[5m]))
```

---

## Debugging Workflows

### Workflow 1: User Reports "Add to Cart Not Working"

1. **Start in Overview Dashboard**
   - Check if error rate is elevated
   - Look at Recent Logs for cart-related errors

2. **Go to Tool Invocations Dashboard**
   - Filter to `add_to_cart` tool
   - Check error rate for this specific tool
   - Click a failed invocation to get trace ID

3. **Open trace in Tempo**
   - See which service in the chain failed
   - Check span details for error message
   - Jump to logs for more context

4. **Check NgRx Actions Dashboard**
   - Filter to `[Cart] Add Item Failure` actions
   - See the error payloads
   - Correlate timing with backend failures

### Workflow 2: Performance Investigation

1. **Check Overview Dashboard**
   - Look at P95/P99 latency trends
   - Identify if specific service is slow

2. **Use Trace Explorer**
   ```
   { duration > 1s }
   ```
   - Find slow traces
   - Open a representative slow trace

3. **Analyze Trace Timeline**
   - Identify which span is taking longest
   - Check if it's network, processing, or database

4. **Check Service-Specific Logs**
   - Look for slow query logs
   - Check for retry patterns

### Workflow 3: Investigating Intermittent Errors

1. **Query error logs in Loki**
   ```
   {app=~".+"} |= "error" | json | level="error"
   ```

2. **Group by error message**
   ```
   sum by (message) (count_over_time({app=~".+"} |= "error"[1h]))
   ```

3. **For each error type, trace back**
   - Get trace ID from log
   - Open full trace
   - Understand context of failure

4. **Check for patterns**
   - Time-based (every X minutes)?
   - Load-based (under high traffic)?
   - Session-based (specific user sessions)?

---

## Troubleshooting

### Logs Not Appearing in Loki

1. Check Alloy is running: http://localhost:12345
2. Check Loki is healthy: `curl http://localhost:3100/ready`
3. Verify app is logging to stdout (not file)
4. Check Alloy config for Loki exporter settings

### Traces Not Appearing in Tempo

1. Check Tempo is healthy: `curl http://localhost:3200/ready`
2. Verify traceparent headers are being sent
3. Check Alloy is forwarding to Tempo
4. Ensure trace context is being propagated (check logs for traceId)

### Frontend Events Not Reaching Faro

1. Check Faro Collector is running: http://localhost:12347/health
2. Open browser DevTools Network tab
3. Look for requests to `/collect` endpoint
4. Check for CORS errors
5. Verify Faro SDK is initialized (check console)

### Metrics Not in Prometheus

1. Check Prometheus targets: http://localhost:9090/targets
2. Verify service /metrics endpoint works
3. Check Prometheus config scrape settings
4. Ensure service is exposing metrics on expected port

---

## Data Retention

All observability data is retained for **1 hour** by default. This is intentional for local development to prevent disk space issues.

To change retention, edit the respective config files:
- Tempo: `docker/tempo/tempo.yml` → `block_retention`
- Loki: `docker/loki/loki.yml` → `retention_period`
- Prometheus: `docker/prometheus/prometheus.yml` → `--storage.tsdb.retention.time`

---

## Adding New Instrumentation

### Adding a New Metric

1. Import metrics module in your service:
   ```typescript
   import { createHistogram, createCounter } from './observability/metrics';
   ```

2. Define the metric:
   ```typescript
   const myMetric = createCounter('my_metric_total', 'Description');
   ```

3. Record values:
   ```typescript
   myMetric.inc({ label: 'value' });
   ```

4. Ensure /metrics endpoint is exposed

### Adding Custom Log Fields

Add fields to your structured log calls:
```typescript
logger.info('Operation completed', {
  traceId,
  customField: 'value',
  duration_ms: duration.toString(),
});
```

### Adding Custom Faro Events

```typescript
import { getFaro } from './observability/faro';

const faro = getFaro();
faro?.api.pushEvent('my_custom_event', {
  attribute1: 'value1',
  attribute2: 'value2',
});
```

### Adding Custom Trace Spans

For Bun services (manual spans):
```typescript
const span = {
  name: 'my-operation',
  traceId: context.traceId,
  spanId: generateSpanId(),
  startTime: Date.now(),
};

// ... do operation ...

span.endTime = Date.now();
// Log span for collection
logger.info('Span completed', span);
```

---

## Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity (debug/info/warn/error) | `info` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint | `http://alloy:4318` |
| `OTEL_SERVICE_NAME` | Service name for traces | (per-service) |
| `LOKI_URL` | Loki push endpoint | `http://loki:3100` |
| `FARO_COLLECTOR_URL` | Faro collector URL (frontend) | `http://localhost:12347/collect` |

### Ports Reference

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | shop-api | REST API |
| 3001 | mcp-tools | MCP tools |
| 3002 | headless-session-manager | Playwright |
| 3003 | Grafana | Dashboards |
| 3100 | Loki | Logs |
| 3200 | Tempo | Traces |
| 4200 | shop-ui | Angular SPA |
| 4317 | Tempo | OTLP gRPC |
| 4318 | Tempo | OTLP HTTP |
| 5173 | chat-ui | React chat |
| 9090 | Prometheus | Metrics |
| 12345 | Alloy | Collector |
| 12347 | Faro Collector | Frontend RUM |

### Useful Links

- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Faro Documentation](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/)
- [W3C Trace Context Specification](https://www.w3.org/TR/trace-context/)
- [TraceQL Reference](https://grafana.com/docs/tempo/latest/traceql/)
- [LogQL Reference](https://grafana.com/docs/loki/latest/logql/)
