# Phase 7: Docker + Full Observability Implementation Plan

## Overview

This phase containerizes the entire agentic-commerce stack and adds comprehensive observability using the Grafana LGTM stack (Loki, Grafana, Tempo, Mimir/Prometheus). The goal is "aggressive overkill" observability that enables:

- **Distributed tracing** across all services with W3C Trace Context
- **Structured logging** with correlation IDs sent to Loki
- **Metrics collection** via Prometheus
- **Frontend RUM** via Grafana Faro (shop-ui + chat-ui)
- **NgRx action stream logging** to Faro for state change correlation
- **User journey dashboards** showing end-to-end request flows

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Docker Network                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  shop-ui    │    │  chat-ui    │    │  shop-api   │                     │
│  │  (nginx)    │    │  (bun)      │    │  (bun)      │                     │
│  │  :4200      │    │  :5173      │    │  :3000      │                     │
│  │  +Faro SDK  │    │  +Faro SDK  │    │  +OTEL      │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                             │
│         └────────┬─────────┴─────────┬────────┘                             │
│                  │                   │                                      │
│                  ▼                   ▼                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                        │
│  │    mcp-tools        │    │ headless-session-mgr│                        │
│  │    (bun)            │    │ (node+playwright)   │                        │
│  │    :3001            │    │ :3002               │                        │
│  │    +OTEL            │    │ +OTEL               │                        │
│  └──────────┬──────────┘    └──────────┬──────────┘                        │
│             │                          │                                    │
│             └────────────┬─────────────┘                                    │
│                          │                                                  │
│  ┌───────────────────────▼───────────────────────────────────────────────┐ │
│  │                     Observability Stack                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │ │
│  │  │  Alloy   │  │   Loki   │  │  Tempo   │  │Prometheus│  │ Grafana │ │ │
│  │  │  :12345  │  │  :3100   │  │  :3200   │  │  :9090   │  │  :3003  │ │ │
│  │  │ collector│  │  logs    │  │  traces  │  │ metrics  │  │dashboard│ │ │
│  │  └────┬─────┘  └────▲─────┘  └────▲─────┘  └────▲─────┘  └────┬────┘ │ │
│  │       │             │             │             │              │      │ │
│  │       └─────────────┴─────────────┴─────────────┘              │      │ │
│  │                           │                                    │      │ │
│  │  ┌──────────────┐         │                                    │      │ │
│  │  │Faro Collector│─────────┘ (frontend telemetry)               │      │ │
│  │  │   :12347     │                                              │      │ │
│  │  └──────────────┘                                              │      │ │
│  └────────────────────────────────────────────────────────────────┴──────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Port Mapping (No Conflicts)

| Service | Internal Port | External Port | Notes |
|---------|---------------|---------------|-------|
| shop-api | 3000 | 3000 | REST API |
| mcp-tools | 3001 | 3001 | MCP tool server |
| headless-session-manager | 3002 | 3002 | Playwright sessions |
| shop-ui | 80 (nginx) | 4200 | Angular SPA |
| chat-ui | 5173 | 5173 | React chat |
| **Grafana** | 3000 | **3003** | Dashboards (remapped to avoid conflict) |
| Prometheus | 9090 | 9090 | Metrics store |
| Tempo | 3200 | 3200 | Trace backend |
| Tempo OTLP gRPC | 4317 | 4317 | OTLP ingestion |
| Tempo OTLP HTTP | 4318 | 4318 | OTLP ingestion |
| Loki | 3100 | 3100 | Log aggregation |
| Alloy | 12345 | 12345 | Telemetry collector |
| Faro Collector | 12347 | 12347 | Frontend RUM |

## Prerequisites

- Docker Desktop or Docker Engine 24+
- Docker Compose v2.20+
- ~8GB RAM available for full stack
- Ports listed above available on host

## Implementation Steps

---

### Step 1: Docker Infrastructure

#### 1.1 Create Docker Compose Structure

```
docker/
├── docker-compose.yml           # Main compose file
├── docker-compose.override.yml  # Local dev overrides
├── .env                         # Environment variables
├── grafana/
│   ├── provisioning/
│   │   ├── dashboards/
│   │   │   ├── dashboard.yml    # Dashboard provisioner config
│   │   │   ├── overview.json    # Main overview dashboard
│   │   │   ├── user-journey.json# User journey traces
│   │   │   └── services.json    # Per-service dashboard
│   │   └── datasources/
│   │       └── datasources.yml  # Loki, Tempo, Prometheus
│   └── grafana.ini              # Grafana config
├── tempo/
│   └── tempo.yml                # Tempo config
├── loki/
│   └── loki.yml                 # Loki config
├── prometheus/
│   └── prometheus.yml           # Prometheus scrape config
├── alloy/
│   └── config.alloy             # Alloy pipeline config
└── faro/
    └── faro.yml                 # Faro collector config
```

#### 1.2 Root docker-compose.yml

```yaml
version: "3.9"

services:
  # ============ APPLICATION SERVICES ============

  shop-api:
    build:
      context: ../shop-api
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
      - OTEL_SERVICE_NAME=shop-api
      - OTEL_RESOURCE_ATTRIBUTES=service.namespace=agentic-commerce
      - LOG_LEVEL=debug
      - LOKI_URL=http://loki:3100
    depends_on:
      - alloy
      - loki
    networks:
      - agentic-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  shop-ui:
    build:
      context: ../shop-ui
      dockerfile: Dockerfile
      args:
        - FARO_COLLECTOR_URL=http://localhost:12347/collect
    ports:
      - "4200:80"
    depends_on:
      - shop-api
      - faro-collector
    networks:
      - agentic-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 10s
      timeout: 5s
      retries: 3

  mcp-tools:
    build:
      context: ../mcp-tools
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - SHOP_API_URL=http://shop-api:3000
      - HEADLESS_URL=http://headless-session-manager:3002
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
      - OTEL_SERVICE_NAME=mcp-tools
      - OTEL_RESOURCE_ATTRIBUTES=service.namespace=agentic-commerce
      - LOG_LEVEL=debug
      - LOKI_URL=http://loki:3100
    depends_on:
      - shop-api
      - headless-session-manager
      - alloy
      - loki
    networks:
      - agentic-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  headless-session-manager:
    build:
      context: ../headless-session-manager
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - SHOP_UI_URL=http://shop-ui:80
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
      - OTEL_SERVICE_NAME=headless-session-manager
      - OTEL_RESOURCE_ATTRIBUTES=service.namespace=agentic-commerce
      - LOG_LEVEL=debug
      - LOKI_URL=http://loki:3100
    depends_on:
      - shop-ui
      - alloy
      - loki
    networks:
      - agentic-net
    # No healthcheck - playwright startup is slow
    deploy:
      resources:
        limits:
          memory: 2G  # Chromium needs memory

  chat-ui:
    build:
      context: ../chat-ui
      dockerfile: Dockerfile
      args:
        - FARO_COLLECTOR_URL=http://localhost:12347/collect
        - MCP_TOOLS_URL=http://localhost:3001
    ports:
      - "5173:5173"
    environment:
      - PORT=5173
      - MCP_TOOLS_URL=http://mcp-tools:3001
    depends_on:
      - mcp-tools
      - faro-collector
    networks:
      - agentic-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5173"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ============ OBSERVABILITY STACK ============

  grafana:
    image: grafana/grafana:11.3.0
    ports:
      - "3003:3000"  # Remapped to avoid conflict with shop-api
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
      - GF_FEATURE_TOGGLES_ENABLE=traceqlEditor tempoSearch tempoBackendSearch tempoApmTable correlations
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/grafana.ini:/etc/grafana/grafana.ini
      - grafana-data:/var/lib/grafana
    depends_on:
      - loki
      - tempo
      - prometheus
    networks:
      - agentic-net

  prometheus:
    image: prom/prometheus:v2.54.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=1h'
      - '--web.enable-lifecycle'
      - '--web.enable-remote-write-receiver'
    networks:
      - agentic-net

  tempo:
    image: grafana/tempo:2.6.0
    ports:
      - "3200:3200"   # HTTP
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - ./tempo/tempo.yml:/etc/tempo/tempo.yml
      - tempo-data:/var/tempo
    command:
      - '-config.file=/etc/tempo/tempo.yml'
    networks:
      - agentic-net

  loki:
    image: grafana/loki:3.2.0
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki.yml:/etc/loki/loki.yml
      - loki-data:/loki
    command:
      - '-config.file=/etc/loki/loki.yml'
    networks:
      - agentic-net

  alloy:
    image: grafana/alloy:v1.4.2
    ports:
      - "12345:12345"  # Alloy UI
      - "4319:4318"    # OTLP HTTP receiver (internal)
    volumes:
      - ./alloy/config.alloy:/etc/alloy/config.alloy
    command:
      - 'run'
      - '/etc/alloy/config.alloy'
      - '--server.http.listen-addr=0.0.0.0:12345'
    depends_on:
      - loki
      - tempo
      - prometheus
    networks:
      - agentic-net

  faro-collector:
    image: grafana/faro-collector:v0.8.0
    ports:
      - "12347:12347"
    volumes:
      - ./faro/faro.yml:/etc/faro/faro.yml
    command:
      - '--config=/etc/faro/faro.yml'
    depends_on:
      - loki
      - tempo
    networks:
      - agentic-net

networks:
  agentic-net:
    driver: bridge

volumes:
  grafana-data:
  prometheus-data:
  tempo-data:
  loki-data:
```

---

### Step 2: Application Dockerfiles

#### 2.1 shop-api/Dockerfile

```dockerfile
FROM oven/bun:1.1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run
CMD ["bun", "run", "start"]
```

#### 2.2 shop-ui/Dockerfile

```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build arg for Faro collector URL
ARG FARO_COLLECTOR_URL=http://localhost:12347/collect
ENV FARO_COLLECTOR_URL=$FARO_COLLECTOR_URL

# Build Angular app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist/shop-ui/browser /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1
```

#### 2.3 shop-ui/nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

#### 2.4 mcp-tools/Dockerfile

```dockerfile
FROM oven/bun:1.1-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run
CMD ["bun", "run", "start"]
```

#### 2.5 headless-session-manager/Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source
COPY . .

# Expose port
EXPOSE 3002

# Run
CMD ["npm", "run", "start"]
```

#### 2.6 chat-ui/Dockerfile

```dockerfile
FROM oven/bun:1.1-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Build args
ARG FARO_COLLECTOR_URL=http://localhost:12347/collect
ARG MCP_TOOLS_URL=http://localhost:3001

ENV FARO_COLLECTOR_URL=$FARO_COLLECTOR_URL
ENV MCP_TOOLS_URL=$MCP_TOOLS_URL

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5173 || exit 1

# Run
CMD ["bun", "run", "start"]
```

---

### Step 3: Observability Configuration Files

#### 3.1 docker/tempo/tempo.yml

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318
        grpc:
          endpoint: 0.0.0.0:4317

ingester:
  trace_idle_period: 10s
  max_block_bytes: 1_000_000
  max_block_duration: 5m

compactor:
  compaction:
    compaction_window: 1h
    max_block_bytes: 100_000_000
    block_retention: 1h
    compacted_block_retention: 10m

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
    wal:
      path: /var/tempo/wal

querier:
  frontend_worker:
    frontend_address: localhost:9095

metrics_generator:
  registry:
    external_labels:
      source: tempo
      cluster: docker-compose
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true

overrides:
  defaults:
    metrics_generator:
      processors: [service-graphs, span-metrics]
```

#### 3.2 docker/loki/loki.yml

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

limits_config:
  retention_period: 1h
  ingestion_rate_mb: 16
  ingestion_burst_size_mb: 32
  max_streams_per_user: 10000
  max_line_size: 256kb

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

analytics:
  reporting_enabled: false

compactor:
  working_directory: /loki/compactor
  retention_enabled: true
  retention_delete_delay: 2h
  delete_request_store: filesystem
```

#### 3.3 docker/prometheus/prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'shop-api'
    static_configs:
      - targets: ['shop-api:3000']
    metrics_path: /metrics

  - job_name: 'mcp-tools'
    static_configs:
      - targets: ['mcp-tools:3001']
    metrics_path: /metrics

  - job_name: 'headless-session-manager'
    static_configs:
      - targets: ['headless-session-manager:3002']
    metrics_path: /metrics

  - job_name: 'chat-ui'
    static_configs:
      - targets: ['chat-ui:5173']
    metrics_path: /metrics

  - job_name: 'tempo'
    static_configs:
      - targets: ['tempo:3200']

  - job_name: 'loki'
    static_configs:
      - targets: ['loki:3100']

  - job_name: 'alloy'
    static_configs:
      - targets: ['alloy:12345']

  - job_name: 'faro-collector'
    static_configs:
      - targets: ['faro-collector:12347']
```

#### 3.4 docker/alloy/config.alloy

```hcl
// ============ OTLP Receiver ============
otelcol.receiver.otlp "default" {
  http {
    endpoint = "0.0.0.0:4318"
  }
  grpc {
    endpoint = "0.0.0.0:4317"
  }

  output {
    traces  = [otelcol.processor.batch.default.input]
    metrics = [otelcol.processor.batch.default.input]
    logs    = [otelcol.processor.batch.default.input]
  }
}

// ============ Batch Processor ============
otelcol.processor.batch "default" {
  timeout = "5s"
  send_batch_size = 1000

  output {
    traces  = [otelcol.exporter.otlp.tempo.input]
    metrics = [otelcol.exporter.prometheus.default.input]
    logs    = [otelcol.exporter.loki.default.input]
  }
}

// ============ Tempo Exporter (Traces) ============
otelcol.exporter.otlp "tempo" {
  client {
    endpoint = "tempo:4317"
    tls {
      insecure = true
    }
  }
}

// ============ Prometheus Exporter (Metrics) ============
otelcol.exporter.prometheus "default" {
  forward_to = [prometheus.remote_write.default.receiver]
}

prometheus.remote_write "default" {
  endpoint {
    url = "http://prometheus:9090/api/v1/write"
  }
}

// ============ Loki Exporter (Logs) ============
otelcol.exporter.loki "default" {
  forward_to = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}

// ============ Logging for debugging ============
logging {
  level  = "info"
  format = "logfmt"
}
```

#### 3.5 docker/faro/faro.yml

```yaml
server:
  host: 0.0.0.0
  port: 12347
  api_key: ""  # No auth for local dev

  rate_limiting:
    enabled: false

  cors:
    allowed_origins:
      - "http://localhost:4200"
      - "http://localhost:5173"
      - "http://shop-ui"
      - "http://chat-ui:5173"
    allowed_headers:
      - "Content-Type"
      - "x-faro-session-id"

logs:
  exporter:
    loki:
      url: http://loki:3100/loki/api/v1/push
      labels:
        app: "{{ .App.Name }}"
        environment: "{{ .App.Environment }}"
        kind: "{{ .Kind }}"

traces:
  exporter:
    otlp:
      endpoint: tempo:4317
      insecure: true

measurements:
  exporter:
    prometheus:
      endpoint: http://prometheus:9090/api/v1/write

exceptions:
  exporter:
    loki:
      url: http://loki:3100/loki/api/v1/push
      labels:
        app: "{{ .App.Name }}"
        kind: exception

events:
  exporter:
    loki:
      url: http://loki:3100/loki/api/v1/push
      labels:
        app: "{{ .App.Name }}"
        kind: event
        event_name: "{{ .Name }}"
```

#### 3.6 docker/grafana/provisioning/datasources/datasources.yml

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: false
    editable: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: '"traceId":"([a-f0-9]+)"'
          name: TraceID
          url: '$${__value.raw}'
        - datasourceUid: tempo
          matcherRegex: 'trace_id=([a-f0-9]+)'
          name: TraceID
          url: '$${__value.raw}'

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: true
    editable: true
    uid: tempo
    jsonData:
      httpMethod: GET
      tracesToLogs:
        datasourceUid: loki
        tags: ['service.name', 'service.namespace']
        mappedTags: [{ key: 'service.name', value: 'app' }]
        mapTagNamesEnabled: true
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
        filterByTraceID: true
        filterBySpanID: false
      tracesToMetrics:
        datasourceUid: prometheus
        tags: [{ key: 'service.name', value: 'service' }]
        queries:
          - name: 'Request rate'
            query: 'sum(rate(traces_spanmetrics_calls_total{$$__tags}[5m]))'
          - name: 'Error rate'
            query: 'sum(rate(traces_spanmetrics_calls_total{$$__tags,status_code="STATUS_CODE_ERROR"}[5m]))'
      serviceMap:
        datasourceUid: prometheus
      nodeGraph:
        enabled: true
      lokiSearch:
        datasourceUid: loki
```

#### 3.7 docker/grafana/provisioning/dashboards/dashboard.yml

```yaml
apiVersion: 1

providers:
  - name: 'Agentic Commerce'
    orgId: 1
    folder: 'Agentic Commerce'
    folderUid: 'agentic-commerce'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

---

### Step 4: Frontend Instrumentation (Grafana Faro)

#### 4.1 shop-ui Faro Integration

**Install Faro SDK:**
```bash
cd shop-ui
npm install @grafana/faro-web-sdk @grafana/faro-web-tracing
```

**Create `src/app/observability/faro.config.ts`:**
```typescript
import {
  initializeFaro,
  getWebInstrumentations,
  FaroErrorBoundary,
  type Faro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

let faro: Faro | null = null;

export function initFaro(): Faro | null {
  if (faro) return faro;

  const collectorUrl = (window as any).__FARO_COLLECTOR_URL__ || 'http://localhost:12347/collect';

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
        captureConsoleDisabledLevels: [], // Capture all levels
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

  return faro;
}

export function getFaro(): Faro | null {
  return faro;
}
```

**Create `src/app/observability/ngrx-faro.meta-reducer.ts`:**
```typescript
import { ActionReducer, Action } from '@ngrx/store';
import { getFaro } from './faro.config';

// Action namespaces to log
const LOGGED_NAMESPACES = ['[Cart]', '[Products]'];

function shouldLogAction(actionType: string): boolean {
  return LOGGED_NAMESPACES.some(ns => actionType.startsWith(ns));
}

export function faroMetaReducer<S>(reducer: ActionReducer<S>): ActionReducer<S> {
  return (state: S | undefined, action: Action) => {
    const faro = getFaro();

    if (faro && shouldLogAction(action.type)) {
      // Log the action as a Faro event
      faro.api.pushEvent('ngrx_action', {
        action_type: action.type,
        action_payload: JSON.stringify(action),
        timestamp: new Date().toISOString(),
      });

      // Also push as a log for Loki correlation
      faro.api.pushLog([`NgRx Action: ${action.type}`], {
        level: 'info',
        context: {
          action_type: action.type,
          payload: JSON.stringify(action),
        },
      });

      // If it's a failure action, log as error
      if (action.type.includes('Failure')) {
        faro.api.pushError(new Error(`NgRx Action Failed: ${action.type}`), {
          type: 'ngrx_failure',
          context: {
            action: JSON.stringify(action),
          },
        });
      }
    }

    return reducer(state, action);
  };
}
```

**Update `src/app/app.config.ts` to include Faro and meta-reducer:**
```typescript
import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideStore, META_REDUCERS } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { productsReducer } from './store/products/products.reducer';
import { cartReducer } from './store/cart/cart.reducer';
import { ProductsEffects } from './store/products/products.effects';
import { CartEffects } from './store/cart/cart.effects';
import { AutomationService } from './automation/automation.service';
import { initFaro } from './observability/faro.config';
import { faroMetaReducer } from './observability/ngrx-faro.meta-reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideStore({
      products: productsReducer,
      cart: cartReducer,
    }),
    {
      provide: META_REDUCERS,
      useValue: faroMetaReducer,
      multi: true,
    },
    provideEffects([ProductsEffects, CartEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false,
    }),
    {
      provide: ENVIRONMENT_INITIALIZER,
      useValue: () => {
        // Initialize Faro
        initFaro();

        // Initialize automation bridge
        const automation = inject(AutomationService);
        automation.initialize();
      },
      multi: true,
    },
  ],
};
```

**Add HTTP interceptor for trace propagation `src/app/observability/tracing.interceptor.ts`:**
```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { getFaro } from './faro.config';

export const tracingInterceptor: HttpInterceptorFn = (req, next) => {
  const faro = getFaro();

  if (faro) {
    const traceContext = faro.api.getTraceContext();
    if (traceContext) {
      req = req.clone({
        setHeaders: {
          'traceparent': traceContext.traceparent || '',
          'tracestate': traceContext.tracestate || '',
        },
      });
    }

    // Log the HTTP request
    faro.api.pushEvent('http_request', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  return next(req);
};
```

#### 4.2 chat-ui Faro Integration

**Install Faro SDK:**
```bash
cd chat-ui
bun add @grafana/faro-web-sdk @grafana/faro-web-tracing
```

**Create `src/observability/faro.ts`:**
```typescript
import {
  initializeFaro,
  getWebInstrumentations,
  type Faro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

let faro: Faro | null = null;

export function initFaro(): Faro | null {
  if (faro) return faro;
  if (typeof window === 'undefined') return null;

  const collectorUrl = import.meta.env.VITE_FARO_COLLECTOR_URL || 'http://localhost:12347/collect';

  faro = initializeFaro({
    url: collectorUrl,
    app: {
      name: 'chat-ui',
      version: '1.0.0',
      environment: 'development',
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
      }),
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

  return faro;
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
    pattern,
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
  result: unknown,
  durationMs: number,
  sessionId: string
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

  if (!success) {
    f.api.pushError(new Error(`Tool failed: ${toolName}`), {
      type: 'tool_failure',
      context: {
        tool_name: toolName,
        result: JSON.stringify(result),
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
```

**Update `src/hooks/useScriptedAgent.ts` to include logging:**
```typescript
// At the top of the file
import {
  logUserMessage,
  logPatternMatch,
  logToolInvocation,
  logToolResult,
} from '../observability/faro';

// In processMessage function, add logging calls:
export function useScriptedAgent() {
  // ... existing code ...

  const processMessage = async (content: string) => {
    // Log user message
    logUserMessage(content, sessionId);

    // After pattern matching
    const matchResult = matchPattern(content);
    logPatternMatch(content, matchResult?.tool || null, sessionId);

    if (matchResult) {
      // Log tool invocation
      logToolInvocation(matchResult.tool, matchResult.args, sessionId);

      const startTime = Date.now();
      try {
        const result = await callTool(matchResult.tool, matchResult.args, sessionId);
        const duration = Date.now() - startTime;

        // Log tool result
        logToolResult(matchResult.tool, result.success, result, duration, sessionId);

        // ... rest of handling ...
      } catch (error) {
        const duration = Date.now() - startTime;
        logToolResult(matchResult.tool, false, error, duration, sessionId);
        throw error;
      }
    }
  };

  // ... rest of hook ...
}
```

**Initialize Faro in `src/App.tsx`:**
```typescript
import { useEffect } from 'react';
import { initFaro } from './observability/faro';

function App() {
  useEffect(() => {
    initFaro();
  }, []);

  // ... rest of component ...
}
```

---

### Step 5: Backend Instrumentation

#### 5.1 Shared Logger Module

**Create `shared/observability/logger.ts`** (to be copied to each backend app):
```typescript
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
    withTraceContext(traceId: string, spanId?: string) {
      return createLogger(service);
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
export function generateTraceContext(traceId?: string): {
  traceparent: string;
  traceId: string;
  spanId: string;
} {
  const finalTraceId = traceId || generateTraceId();
  const spanId = generateSpanId();
  return {
    traceparent: `00-${finalTraceId}-${spanId}-01`,
    traceId: finalTraceId,
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
```

#### 5.2 Shared Metrics Module

**Create `shared/observability/metrics.ts`:**
```typescript
interface MetricLabels {
  [key: string]: string;
}

interface Histogram {
  observe(value: number, labels?: MetricLabels): void;
}

interface Counter {
  inc(labels?: MetricLabels, value?: number): void;
}

interface Gauge {
  set(value: number, labels?: MetricLabels): void;
  inc(labels?: MetricLabels): void;
  dec(labels?: MetricLabels): void;
}

// Simple in-memory metrics store
const metrics: Map<string, { type: string; values: Map<string, number[]> }> = new Map();

export function createHistogram(name: string, help: string, buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): Histogram {
  metrics.set(name, { type: 'histogram', values: new Map() });

  return {
    observe(value: number, labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      const metric = metrics.get(name)!;
      if (!metric.values.has(key)) {
        metric.values.set(key, []);
      }
      metric.values.get(key)!.push(value);
    },
  };
}

export function createCounter(name: string, help: string): Counter {
  metrics.set(name, { type: 'counter', values: new Map() });

  return {
    inc(labels: MetricLabels = {}, value: number = 1) {
      const key = JSON.stringify(labels);
      const metric = metrics.get(name)!;
      const current = metric.values.get(key)?.[0] || 0;
      metric.values.set(key, [current + value]);
    },
  };
}

export function createGauge(name: string, help: string): Gauge {
  metrics.set(name, { type: 'gauge', values: new Map() });

  return {
    set(value: number, labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      metrics.get(name)!.values.set(key, [value]);
    },
    inc(labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      const metric = metrics.get(name)!;
      const current = metric.values.get(key)?.[0] || 0;
      metric.values.set(key, [current + 1]);
    },
    dec(labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      const metric = metrics.get(name)!;
      const current = metric.values.get(key)?.[0] || 0;
      metric.values.set(key, [current - 1]);
    },
  };
}

// Export metrics in Prometheus format
export function getMetricsOutput(): string {
  const lines: string[] = [];

  for (const [name, metric] of metrics) {
    lines.push(`# TYPE ${name} ${metric.type}`);

    for (const [labelsJson, values] of metric.values) {
      const labels = JSON.parse(labelsJson);
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');

      if (metric.type === 'histogram') {
        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const count = sorted.length;

        // Output buckets
        const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity];
        for (const bucket of buckets) {
          const bucketCount = sorted.filter(v => v <= bucket).length;
          const le = bucket === Infinity ? '+Inf' : bucket.toString();
          lines.push(`${name}_bucket{${labelStr}${labelStr ? ',' : ''}le="${le}"} ${bucketCount}`);
        }
        lines.push(`${name}_sum{${labelStr}} ${sum}`);
        lines.push(`${name}_count{${labelStr}} ${count}`);
      } else {
        const value = values[0] || 0;
        lines.push(`${name}{${labelStr}} ${value}`);
      }
    }
  }

  return lines.join('\n');
}
```

#### 5.3 Update shop-api with Instrumentation

**Update `shop-api/index.ts`:**
```typescript
import { createLogger, extractTraceContext, generateTraceContext } from './observability/logger';
import { createHistogram, createCounter, getMetricsOutput } from './observability/metrics';

const logger = createLogger('shop-api');

// Metrics
const httpRequestDuration = createHistogram(
  'http_request_duration_seconds',
  'Duration of HTTP requests in seconds'
);
const httpRequestTotal = createCounter(
  'http_requests_total',
  'Total number of HTTP requests'
);

// Request logging middleware
function logRequest(req: Request, traceId: string, spanId: string) {
  const url = new URL(req.url);
  logger.info('Incoming request', {
    traceId,
    spanId,
    method: req.method,
    path: url.pathname,
    query: url.search,
  });
}

function logResponse(
  req: Request,
  status: number,
  durationMs: number,
  traceId: string,
  spanId: string
) {
  const url = new URL(req.url);
  logger.info('Response sent', {
    traceId,
    spanId,
    method: req.method,
    path: url.pathname,
    status: status.toString(),
    duration_ms: durationMs.toString(),
  });

  // Record metrics
  httpRequestDuration.observe(durationMs / 1000, {
    method: req.method,
    path: url.pathname,
    status: status.toString(),
  });
  httpRequestTotal.inc({
    method: req.method,
    path: url.pathname,
    status: status.toString(),
  });
}

const server = Bun.serve({
  port: process.env.PORT || 3000,
  async fetch(req) {
    const startTime = Date.now();
    const { traceId, spanId } = extractTraceContext(req.headers);
    const trace = generateTraceContext(traceId);

    logRequest(req, trace.traceId, trace.spanId);

    // Handle metrics endpoint
    const url = new URL(req.url);
    if (url.pathname === '/metrics') {
      return new Response(getMetricsOutput(), {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    try {
      // ... existing route handling ...
      const response = await handleRoute(req, trace);
      const duration = Date.now() - startTime;
      logResponse(req, response.status, duration, trace.traceId, trace.spanId);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Request failed', {
        traceId: trace.traceId,
        spanId: trace.spanId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      logResponse(req, 500, duration, trace.traceId, trace.spanId);
      throw error;
    }
  },
});

logger.info('Server started', { port: server.port.toString() });
```

#### 5.4 Update mcp-tools with Instrumentation

Similar pattern to shop-api, with additional tool-specific metrics:

```typescript
const toolInvocationDuration = createHistogram(
  'tool_invocation_duration_seconds',
  'Duration of tool invocations'
);
const toolInvocationTotal = createCounter(
  'tool_invocations_total',
  'Total tool invocations'
);

// In tool handler:
function wrapToolHandler(toolName: string, handler: ToolHandler) {
  return async (args: unknown, traceContext: TraceContext) => {
    const start = Date.now();
    logger.info('Tool invocation started', {
      traceId: traceContext.traceId,
      tool: toolName,
      args: JSON.stringify(args),
    });

    try {
      const result = await handler(args, traceContext);
      const duration = Date.now() - start;

      logger.info('Tool invocation completed', {
        traceId: traceContext.traceId,
        tool: toolName,
        duration_ms: duration.toString(),
        success: 'true',
      });

      toolInvocationDuration.observe(duration / 1000, {
        tool: toolName,
        success: 'true',
      });
      toolInvocationTotal.inc({ tool: toolName, success: 'true' });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Tool invocation failed', {
        traceId: traceContext.traceId,
        tool: toolName,
        duration_ms: duration.toString(),
        error: error instanceof Error ? error.message : 'Unknown',
      });

      toolInvocationDuration.observe(duration / 1000, {
        tool: toolName,
        success: 'false',
      });
      toolInvocationTotal.inc({ tool: toolName, success: 'false' });

      throw error;
    }
  };
}
```

#### 5.5 Update headless-session-manager with Instrumentation

```typescript
import { createLogger, extractTraceContext, generateTraceContext } from './observability/logger';
import { createHistogram, createCounter, createGauge, getMetricsOutput } from './observability/metrics';

const logger = createLogger('headless-session-manager');

// Metrics
const sessionCreationDuration = createHistogram(
  'session_creation_duration_seconds',
  'Time to create browser sessions'
);
const sessionCount = createGauge(
  'active_sessions',
  'Number of active browser sessions'
);
const bridgeExecutionDuration = createHistogram(
  'bridge_execution_duration_seconds',
  'Time to execute bridge commands'
);

// Express middleware for logging and tracing
app.use((req, res, next) => {
  const { traceId, spanId } = extractTraceContext(new Headers(req.headers as any));
  const trace = generateTraceContext(traceId);

  req.traceContext = trace;

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      traceId: trace.traceId,
      spanId: trace.spanId,
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
      duration_ms: duration.toString(),
    });
  });

  next();
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(getMetricsOutput());
});
```

---

### Step 6: Grafana Dashboards

#### 6.1 Overview Dashboard (`docker/grafana/provisioning/dashboards/overview.json`)

This dashboard will include:
- **Service Health Panel**: Status of all 5 services
- **Request Rate Panel**: Requests/second across all services
- **Error Rate Panel**: Errors/second with breakdown by service
- **Latency Panel**: P50/P95/P99 latencies
- **Active Sessions Panel**: Browser sessions gauge
- **Recent Logs Panel**: Live log stream from Loki

#### 6.2 User Journey Dashboard (`docker/grafana/provisioning/dashboards/user-journey.json`)

This dashboard focuses on tracing user journeys:
- **Trace Search Panel**: Search by trace ID, session ID, tool name
- **Journey Funnel**: Search → Details → Add to Cart → View Cart
- **Chat Flow Panel**: Message → Pattern Match → Tool Call → Result
- **Service Map**: Visual graph of service dependencies
- **Trace Timeline**: Gantt-style view of trace spans

#### 6.3 NgRx Actions Dashboard (`docker/grafana/provisioning/dashboards/ngrx-actions.json`)

Dedicated to NgRx state changes:
- **Action Stream**: Live stream of NgRx actions from Faro
- **Action Frequency**: Most common actions
- **Action Failures**: Failed actions with error details
- **State Change Timeline**: Correlated with API calls
- **Cart State Tracker**: Visual cart state over time

#### 6.4 Tool Invocations Dashboard (`docker/grafana/provisioning/dashboards/tool-invocations.json`)

MCP tool analysis:
- **Tool Usage**: Breakdown by tool name
- **Tool Latency**: Per-tool P50/P95/P99
- **Tool Errors**: Failed invocations
- **Session Recovery**: 404 recoveries with session recreation
- **Tool Chain Analysis**: Common tool sequences

---

### Step 7: Trace Context Propagation

#### 7.1 Full Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRACE PROPAGATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User types "add headphones to cart" in chat-ui                         │
│     └─ Faro creates trace, logs user_message event                         │
│        traceId: abc123...                                                   │
│                                                                             │
│  2. chat-ui calls mcp-tools /tools/add_to_cart/call                        │
│     └─ HTTP header: traceparent: 00-abc123...-span1-01                     │
│     └─ Faro logs tool_invocation event                                     │
│                                                                             │
│  3. mcp-tools receives request, extracts trace context                     │
│     └─ Logs: tool=add_to_cart, traceId=abc123...                           │
│     └─ Creates child span: span2                                           │
│                                                                             │
│  4. mcp-tools calls headless-session-manager /sessions/:id/execute         │
│     └─ HTTP header: traceparent: 00-abc123...-span2-01                     │
│                                                                             │
│  5. headless-session-manager executes bridge command                       │
│     └─ Logs: action=[Cart] Add Item, traceId=abc123...                     │
│     └─ Creates child span: span3                                           │
│                                                                             │
│  6. shop-ui (via Playwright) receives bridge dispatch                      │
│     └─ NgRx meta-reducer logs action to Faro                               │
│     └─ Faro correlates with traceId from page context                      │
│                                                                             │
│  7. shop-ui makes API call to shop-api                                     │
│     └─ Angular interceptor adds traceparent header                         │
│     └─ Creates child span: span4                                           │
│                                                                             │
│  8. shop-api processes cart update                                         │
│     └─ Logs: path=/api/cart/:id/items, traceId=abc123...                   │
│     └─ Returns success response                                            │
│                                                                             │
│  9. Response bubbles back through chain                                    │
│     └─ Each service logs completion with traceId                           │
│     └─ Faro logs tool_result event                                         │
│                                                                             │
│  RESULT: Single trace shows entire journey from chat to cart update        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.2 Trace Context in Headless Sessions

Special handling for Playwright-executed code:

```typescript
// In headless-session-manager, pass trace context to page
async function executeWithTrace(
  page: Page,
  action: BridgeAction,
  traceContext: TraceContext
) {
  // Inject trace context into page for Faro correlation
  await page.evaluate(
    ({ traceId, spanId }) => {
      (window as any).__TRACE_CONTEXT__ = { traceId, spanId };
    },
    { traceId: traceContext.traceId, spanId: traceContext.spanId }
  );

  // Execute the bridge action
  return page.evaluate(/* ... */);
}

// In shop-ui, the Faro integration reads this context
function getTraceContextFromWindow(): TraceContext | null {
  const ctx = (window as any).__TRACE_CONTEXT__;
  return ctx || null;
}
```

---

### Step 8: Startup Scripts

#### 8.1 docker/scripts/start.sh

```bash
#!/bin/bash
set -e

echo "🚀 Starting Agentic Commerce with Observability Stack"

# Navigate to docker directory
cd "$(dirname "$0")/.."

# Build all images
echo "📦 Building Docker images..."
docker compose build

# Start observability stack first
echo "📊 Starting observability stack..."
docker compose up -d grafana prometheus tempo loki alloy faro-collector

# Wait for observability stack to be healthy
echo "⏳ Waiting for observability stack..."
sleep 10

# Start application services
echo "🏪 Starting application services..."
docker compose up -d shop-api shop-ui mcp-tools headless-session-manager chat-ui

# Wait for all services
echo "⏳ Waiting for services to be healthy..."
sleep 15

# Print status
echo ""
echo "✅ All services started!"
echo ""
echo "📍 Service URLs:"
echo "   - Chat UI:     http://localhost:5173"
echo "   - Shop UI:     http://localhost:4200"
echo "   - Shop API:    http://localhost:3000"
echo "   - MCP Tools:   http://localhost:3001"
echo "   - Headless:    http://localhost:3002"
echo ""
echo "📊 Observability URLs:"
echo "   - Grafana:     http://localhost:3003 (no login required)"
echo "   - Prometheus:  http://localhost:9090"
echo "   - Tempo:       http://localhost:3200"
echo "   - Loki:        http://localhost:3100"
echo "   - Alloy:       http://localhost:12345"
echo ""
echo "🔍 Quick links:"
echo "   - Overview Dashboard:    http://localhost:3003/d/overview"
echo "   - User Journey Dashboard: http://localhost:3003/d/user-journey"
echo "   - Trace Explorer:        http://localhost:3003/explore?datasource=tempo"
echo ""
```

#### 8.2 docker/scripts/stop.sh

```bash
#!/bin/bash
set -e

echo "🛑 Stopping Agentic Commerce..."

cd "$(dirname "$0")/.."

docker compose down

echo "✅ All services stopped"
```

#### 8.3 docker/scripts/logs.sh

```bash
#!/bin/bash

SERVICE=${1:-""}

cd "$(dirname "$0")/.."

if [ -z "$SERVICE" ]; then
  docker compose logs -f
else
  docker compose logs -f "$SERVICE"
fi
```

---

### Step 9: Environment Configuration

#### 9.1 docker/.env

```bash
# Application settings
NODE_ENV=development
LOG_LEVEL=debug

# Service URLs (internal Docker network)
SHOP_API_URL=http://shop-api:3000
HEADLESS_URL=http://headless-session-manager:3002
SHOP_UI_URL=http://shop-ui:80
MCP_TOOLS_URL=http://mcp-tools:3001

# Observability endpoints
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
LOKI_URL=http://loki:3100
FARO_COLLECTOR_URL=http://localhost:12347/collect

# Retention (1 hour for local dev)
RETENTION_PERIOD=1h
```

---

### Step 10: Testing & Validation

#### 10.1 Validation Checklist

- [ ] All 5 app containers start successfully
- [ ] All observability containers start successfully
- [ ] No port conflicts on host
- [ ] Grafana loads with pre-provisioned dashboards
- [ ] Prometheus scrapes all /metrics endpoints
- [ ] Logs appear in Loki from all services
- [ ] Traces appear in Tempo
- [ ] Faro collector receives frontend events
- [ ] NgRx actions appear in Loki with event_name label
- [ ] Distributed traces show full request flow
- [ ] Service map displays in Grafana

#### 10.2 End-to-End Test Scenario

1. Open chat-ui at http://localhost:5173
2. Set customer ID: "customer id is test-user-123"
3. Search products: "show me headphones"
4. Add to cart: "add wireless headphones to cart"
5. Check cart: "what's in my cart"
6. Open Grafana at http://localhost:3003
7. Navigate to Explore → Tempo
8. Search for traces with service.name="chat-ui"
9. Verify trace shows full flow through all services
10. Check Loki for correlated logs with same traceId
11. Verify NgRx actions appear with event_name="ngrx_action"

---

## File Structure Summary

```
agentic-commerce/
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml
│   ├── .env
│   ├── scripts/
│   │   ├── start.sh
│   │   ├── stop.sh
│   │   └── logs.sh
│   ├── grafana/
│   │   ├── grafana.ini
│   │   └── provisioning/
│   │       ├── dashboards/
│   │       │   ├── dashboard.yml
│   │       │   ├── overview.json
│   │       │   ├── user-journey.json
│   │       │   ├── ngrx-actions.json
│   │       │   └── tool-invocations.json
│   │       └── datasources/
│   │           └── datasources.yml
│   ├── tempo/
│   │   └── tempo.yml
│   ├── loki/
│   │   └── loki.yml
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── alloy/
│   │   └── config.alloy
│   └── faro/
│       └── faro.yml
├── shop-api/
│   ├── Dockerfile
│   └── observability/
│       ├── logger.ts
│       └── metrics.ts
├── shop-ui/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/app/observability/
│       ├── faro.config.ts
│       ├── ngrx-faro.meta-reducer.ts
│       └── tracing.interceptor.ts
├── chat-ui/
│   ├── Dockerfile
│   └── src/observability/
│       └── faro.ts
├── mcp-tools/
│   ├── Dockerfile
│   └── observability/
│       ├── logger.ts
│       └── metrics.ts
├── headless-session-manager/
│   ├── Dockerfile
│   └── observability/
│       ├── logger.ts
│       └── metrics.ts
├── docs/
│   └── OBSERVABILITY_GUIDE.md
└── PHASE_7_DOCKER_OBSERVABILITY_PLAN.md (this file)
```

---

## Acceptance Criteria

1. **Docker**
   - [ ] Single `docker compose up` starts entire stack
   - [ ] All services healthy within 60 seconds
   - [ ] No port conflicts between apps and observability
   - [ ] Graceful shutdown with `docker compose down`

2. **Logging**
   - [ ] All services emit structured JSON logs
   - [ ] Logs include traceId for correlation
   - [ ] Logs queryable in Grafana via Loki
   - [ ] Log levels configurable via environment

3. **Tracing**
   - [ ] W3C Trace Context propagated across all services
   - [ ] Traces visible in Tempo via Grafana
   - [ ] Service map shows dependencies
   - [ ] Trace-to-logs correlation works

4. **Metrics**
   - [ ] All services expose /metrics endpoint
   - [ ] Prometheus scrapes all services
   - [ ] Request latency histograms available
   - [ ] Tool invocation metrics tracked

5. **Frontend Observability**
   - [ ] Faro SDK integrated in shop-ui and chat-ui
   - [ ] NgRx [Cart] and [Products] actions logged
   - [ ] User messages and tool invocations logged
   - [ ] Frontend errors captured

6. **Dashboards**
   - [ ] Overview dashboard shows system health
   - [ ] User journey dashboard enables trace exploration
   - [ ] NgRx actions dashboard shows state changes
   - [ ] Tool invocations dashboard shows MCP usage

7. **Documentation**
   - [ ] OBSERVABILITY_GUIDE.md explains all features
   - [ ] Suggested workflows documented
   - [ ] Troubleshooting section included

---

## Implementation Order

1. **Phase 7.1**: Docker infrastructure (compose, Dockerfiles)
2. **Phase 7.2**: Observability stack configuration (Grafana, Tempo, Loki, Prometheus)
3. **Phase 7.3**: Backend instrumentation (logger, metrics, trace propagation)
4. **Phase 7.4**: Frontend instrumentation (Faro, NgRx meta-reducer)
5. **Phase 7.5**: Grafana dashboards
6. **Phase 7.6**: Documentation and testing
7. **Phase 7.7**: Integration validation

---

## Dependencies

- Docker Desktop 4.25+ or Docker Engine 24+
- Docker Compose v2.20+
- ~8GB RAM for full stack
- Grafana Faro Web SDK
- No cloud dependencies (fully local)

---

## Estimated Effort

| Sub-phase | Description | Complexity |
|-----------|-------------|------------|
| 7.1 | Docker infrastructure | Medium |
| 7.2 | Observability stack config | Medium |
| 7.3 | Backend instrumentation | High |
| 7.4 | Frontend instrumentation | High |
| 7.5 | Grafana dashboards | Medium |
| 7.6 | Documentation | Low |
| 7.7 | Integration testing | Medium |

---

## References

- [Grafana Faro Web SDK](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/faro-web-sdk/)
- [Grafana Tempo](https://grafana.com/docs/tempo/latest/)
- [Grafana Loki](https://grafana.com/docs/loki/latest/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry](https://opentelemetry.io/docs/)
- [NgRx Meta-Reducers](https://ngrx.io/guide/store/metareducers)
