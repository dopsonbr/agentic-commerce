# Observability Verification Checklist

This document provides step-by-step verification that all observability components are working correctly.

## Prerequisites

```bash
# Ensure Docker is running
docker --version

# Start the full stack
cd docker
docker compose up -d

# Wait for all services to be healthy (approximately 30-60 seconds)
docker compose ps
```

## 1. Infrastructure Health Checks

### 1.1 Verify All Containers Running

```bash
docker compose ps
```

Expected: All 12 containers should show `running` or `healthy`:
- [ ] `grafana` - port 3003
- [ ] `tempo` - port 3200
- [ ] `loki` - port 3100
- [ ] `prometheus` - port 9090
- [ ] `alloy` - port 12345
- [ ] `faro-collector` - port 12347
- [ ] `shop-api` - port 3000
- [ ] `mcp-tools` - port 3001
- [ ] `headless-session-manager` - port 3002
- [ ] `shop-ui` - port 4200
- [ ] `chat-ui` - port 5173

### 1.2 Verify Observability Stack Endpoints

```bash
# Grafana
curl -s http://localhost:3003/api/health
# Expected: {"commit":"...","database":"ok","version":"..."}

# Tempo
curl -s http://localhost:3200/ready
# Expected: "ready"

# Loki
curl -s http://localhost:3100/ready
# Expected: "ready"

# Prometheus
curl -s http://localhost:9090/-/ready
# Expected: "Prometheus Server is Ready."

# Faro Collector
curl -s http://localhost:12347/health
# Expected: 200 OK
```

**Checklist:**
- [ ] Grafana healthy
- [ ] Tempo ready
- [ ] Loki ready
- [ ] Prometheus ready
- [ ] Faro collector healthy

### 1.3 Verify Application Health Endpoints

```bash
# shop-api
curl -s http://localhost:3000/health
# Expected: {"status":"ok"}

# mcp-tools
curl -s http://localhost:3001/health
# Expected: {"status":"ok","sessions":...}

# headless-session-manager
curl -s http://localhost:3002/health
# Expected: {"status":"ok","activeSessions":...}
```

**Checklist:**
- [ ] shop-api healthy
- [ ] mcp-tools healthy
- [ ] headless-session-manager healthy

---

## 2. Metrics Verification

### 2.1 Verify Prometheus Scrape Targets

1. Open Prometheus: http://localhost:9090/targets
2. Verify all targets are `UP`:
   - [ ] `shop-api:3000/metrics`
   - [ ] `mcp-tools:3001/metrics`
   - [ ] `headless-session-manager:3002/metrics`

### 2.2 Verify Metrics Are Being Collected

```bash
# Check shop-api metrics
curl -s http://localhost:3000/metrics | grep http_requests_total

# Check mcp-tools metrics
curl -s http://localhost:3001/metrics | grep tool_invocations_total

# Check headless-session-manager metrics
curl -s http://localhost:3002/metrics | grep active_sessions
```

### 2.3 Query Metrics in Grafana

1. Open Grafana: http://localhost:3003
2. Login with `admin`/`admin`
3. Go to Explore → Select "Prometheus" datasource
4. Run queries:

```promql
# HTTP request rate
rate(http_requests_total[5m])

# Request duration 95th percentile
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Tool invocation count
tool_invocations_total

# Active sessions
active_sessions
```

**Checklist:**
- [ ] Prometheus targets all UP
- [ ] shop-api emitting metrics
- [ ] mcp-tools emitting metrics
- [ ] headless-session-manager emitting metrics
- [ ] Metrics visible in Grafana

---

## 3. Logs Verification

### 3.1 Generate Test Traffic

```bash
# Make requests to generate logs
curl http://localhost:3000/api/products
curl http://localhost:3001/tools
curl http://localhost:3002/health
```

### 3.2 Verify Structured Logging Format

```bash
# Check Docker logs for JSON format
docker compose logs shop-api --tail=10 2>&1 | grep -E '^\{.*\}$'
```

Expected format:
```json
{"timestamp":"...","level":"info","message":"Incoming request","service":"shop-api","traceId":"...","spanId":"...","method":"GET","path":"/api/products"}
```

### 3.3 Query Logs in Grafana

1. Open Grafana: http://localhost:3003
2. Go to Explore → Select "Loki" datasource
3. Run LogQL queries:

```logql
# All shop-api logs
{service="shop-api"}

# Error logs only
{service=~".+"} |= "error"

# Logs with specific trace ID
{service=~".+"} | json | traceId="<paste-trace-id>"

# Request logs with duration
{service="shop-api"} | json | message="Request completed"
```

**Checklist:**
- [ ] Logs are JSON formatted
- [ ] Logs contain traceId field
- [ ] Logs visible in Loki/Grafana
- [ ] Can filter by service
- [ ] Can search by trace ID

---

## 4. Traces Verification

### 4.1 Generate Traced Requests

```bash
# Make a request with trace context header
curl -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  http://localhost:3000/api/products
```

### 4.2 Query Traces in Grafana

1. Open Grafana: http://localhost:3003
2. Go to Explore → Select "Tempo" datasource
3. Search by trace ID or use TraceQL:

```
# Find traces by service
{resource.service.name="shop-api"}

# Find slow traces (>100ms)
{resource.service.name="shop-api"} | duration > 100ms

# Find error traces
{resource.service.name="shop-api" && status=error}
```

### 4.3 Verify Trace-Log Correlation

1. Find a trace in Tempo
2. Copy the trace ID
3. Switch to Loki datasource
4. Query: `{service=~".+"} | json | traceId="<trace-id>"`
5. Verify matching logs appear

**Checklist:**
- [ ] Traces visible in Tempo
- [ ] Trace IDs match between services
- [ ] Can correlate traces with logs
- [ ] Trace spans show timing breakdown

---

## 5. Frontend (Faro) Verification

### 5.1 Verify Faro Initialization

1. Open shop-ui: http://localhost:4200
2. Open browser DevTools → Console
3. Look for: `[Faro] Initialized successfully`

1. Open chat-ui: http://localhost:5173
2. Open browser DevTools → Console
3. Look for: `[Faro] Initialized successfully`

### 5.2 Verify Faro Events Being Sent

1. Open browser DevTools → Network tab
2. Filter by `collect` or `faro`
3. Interact with the UI (click buttons, navigate)
4. Verify POST requests to `http://localhost:12347/collect`

### 5.3 Verify NgRx Actions Logged (shop-ui)

1. Open shop-ui: http://localhost:4200
2. Open browser DevTools → Network tab
3. Click on products, add to cart
4. Look for Faro requests containing `ngrx_action` events

Expected payload includes:
```json
{
  "events": [{
    "name": "ngrx_action",
    "attributes": {
      "action_type": "[Cart] Add Item",
      "action_payload": "..."
    }
  }]
}
```

### 5.4 Verify Chat Events Logged (chat-ui)

1. Open chat-ui: http://localhost:5173
2. Open browser DevTools → Network tab
3. Send messages like "show me hammers", "add hammer to cart"
4. Look for Faro requests containing events:
   - `user_message`
   - `pattern_match`
   - `tool_invocation`
   - `tool_result`

### 5.5 Query Frontend Data in Grafana

1. Open Grafana: http://localhost:3003
2. Go to Explore → Select "Loki" datasource
3. Query frontend logs:

```logql
# All frontend events
{service_name=~"shop-ui|chat-ui"}

# NgRx actions
{service_name="shop-ui"} |= "ngrx_action"

# Tool invocations from chat
{service_name="chat-ui"} |= "tool_invocation"
```

**Checklist:**
- [ ] Faro initialized in shop-ui (console message)
- [ ] Faro initialized in chat-ui (console message)
- [ ] Network requests to Faro collector visible
- [ ] NgRx actions being logged
- [ ] Chat events being logged
- [ ] Frontend data visible in Grafana/Loki

---

## 6. End-to-End User Journey Verification

### 6.1 Execute Complete Shopping Flow

1. Open chat-ui: http://localhost:5173
2. Execute these commands in sequence:
   ```
   my customer id is test-user-123
   show me hammers
   add the first hammer to my cart
   what's in my cart
   ```

### 6.2 Trace the Journey in Grafana

1. **Find the trace**: Go to Tempo, search for recent traces from chat-ui
2. **Follow the flow**:
   - chat-ui → mcp-tools (tool invocation)
   - mcp-tools → headless-session-manager (for add_to_cart)
   - headless-session-manager → shop-ui (browser automation)
   - shop-ui → shop-api (HTTP requests)

3. **Verify correlation**:
   - All services should share the same trace ID
   - Logs in Loki should be queryable by that trace ID

### 6.3 Check Dashboards

1. Open Grafana: http://localhost:3003
2. Go to Dashboards
3. Verify data in:
   - [ ] **Overview Dashboard**: Shows request rates, error rates, latency
   - [ ] **User Journey Dashboard**: Shows end-to-end flow visualization
   - [ ] **NgRx Actions Dashboard**: Shows action distribution, failures
   - [ ] **Tool Invocations Dashboard**: Shows tool usage, success rates

**Checklist:**
- [ ] Complete shopping flow executes successfully
- [ ] Single trace ID spans multiple services
- [ ] Logs correlate with traces
- [ ] Dashboards show meaningful data

---

## 7. Error Handling Verification

### 7.1 Trigger and Verify Error Logging

```bash
# Invalid product SKU
curl http://localhost:3000/api/products/invalid-sku
# Should log error with trace context

# Invalid tool call
curl -X POST http://localhost:3001/tools/nonexistent/call \
  -H "Content-Type: application/json" \
  -d '{}'
# Should log error

# Invalid session
curl http://localhost:3002/sessions/nonexistent/state
# Should log 404 error
```

### 7.2 Verify Errors in Grafana

```logql
# Find all errors
{service=~".+"} | json | level="error"

# Find errors with stack traces
{service=~".+"} |= "Error" |= "stack"
```

### 7.3 Verify Frontend Errors

1. Open browser DevTools → Console
2. Trigger an error (e.g., network failure)
3. Verify error sent to Faro collector
4. Query in Loki: `{service_name="shop-ui"} |= "error"`

**Checklist:**
- [ ] Backend errors logged with trace context
- [ ] Errors visible in Loki
- [ ] Frontend errors captured by Faro
- [ ] Error details include stack traces where applicable

---

## 8. Performance Baseline

### 8.1 Verify Observability Overhead

Run load test and compare:

```bash
# Without observability (baseline)
# Set LOG_LEVEL=error, disable Faro

# With observability
# Normal configuration

# Compare response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/products
```

Expected overhead: <5ms per request

### 8.2 Check Resource Usage

```bash
docker stats --no-stream
```

Verify observability containers aren't consuming excessive resources:
- Tempo: <512MB RAM
- Loki: <512MB RAM
- Prometheus: <256MB RAM
- Grafana: <256MB RAM

---

## Troubleshooting

### No Data in Grafana

1. Check datasource configuration: Settings → Data Sources
2. Verify connectivity: Each datasource has a "Test" button
3. Check container logs: `docker compose logs <service>`

### Traces Not Correlating

1. Verify `traceparent` header propagation
2. Check that all services extract/inject trace context
3. Verify Alloy configuration for trace collection

### Frontend Data Missing

1. Check browser console for Faro errors
2. Verify CORS settings on Faro collector
3. Check Network tab for blocked requests
4. Verify `VITE_FARO_COLLECTOR_URL` / `FARO_COLLECTOR_URL` env vars

### High Memory Usage

1. Check retention settings in Tempo/Loki configs
2. Verify compaction is running
3. Consider reducing `retention_period` if needed

---

## Verification Sign-off

| Component | Verified | Date | Notes |
|-----------|----------|------|-------|
| Infrastructure Health | [ ] | | |
| Metrics (Prometheus) | [ ] | | |
| Logs (Loki) | [ ] | | |
| Traces (Tempo) | [ ] | | |
| Frontend - shop-ui (Faro) | [ ] | | |
| Frontend - chat-ui (Faro) | [ ] | | |
| NgRx Action Logging | [ ] | | |
| End-to-End Journey | [ ] | | |
| Error Handling | [ ] | | |
| Dashboards | [ ] | | |

**Verified By:** _________________
**Date:** _________________
