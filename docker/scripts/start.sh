#!/bin/bash
set -e

echo "Starting Agentic Commerce with Observability Stack"
echo "=================================================="

# Navigate to docker directory
cd "$(dirname "$0")/.."

# Build all images
echo ""
echo "[1/4] Building Docker images..."
docker compose build

# Start observability stack first
echo ""
echo "[2/4] Starting observability stack..."
docker compose up -d grafana prometheus tempo loki alloy faro-collector

# Wait for observability stack to be healthy
echo ""
echo "[3/4] Waiting for observability stack to be ready..."
sleep 10

# Start application services
echo ""
echo "[4/4] Starting application services..."
docker compose up -d shop-api shop-ui mcp-tools headless-session-manager chat-ui

# Wait for all services
echo ""
echo "Waiting for services to start..."
sleep 15

# Print status
echo ""
echo "=================================================="
echo "All services started!"
echo "=================================================="
echo ""
echo "Application URLs:"
echo "  - Chat UI:     http://localhost:5173"
echo "  - Shop UI:     http://localhost:4200"
echo "  - Shop API:    http://localhost:3000"
echo "  - MCP Tools:   http://localhost:3001"
echo "  - Headless:    http://localhost:3002"
echo ""
echo "Observability URLs:"
echo "  - Grafana:     http://localhost:3003 (no login required)"
echo "  - Prometheus:  http://localhost:9090"
echo "  - Tempo:       http://localhost:3200"
echo "  - Loki:        http://localhost:3100"
echo "  - Alloy:       http://localhost:12345"
echo ""
echo "Quick links:"
echo "  - Overview Dashboard:     http://localhost:3003/d/overview"
echo "  - User Journey Dashboard: http://localhost:3003/d/user-journey"
echo "  - NgRx Actions Dashboard: http://localhost:3003/d/ngrx-actions"
echo "  - Tool Invocations:       http://localhost:3003/d/tool-invocations"
echo "  - Trace Explorer:         http://localhost:3003/explore?datasource=tempo"
echo ""
