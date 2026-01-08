#!/bin/bash

# Agentic Commerce POC - Stop All Services

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/.logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Agentic Commerce services...${NC}"

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file="$LOG_DIR/$name.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "  Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null
            rm -f "$pid_file"
        else
            echo "  $name not running (stale PID file)"
            rm -f "$pid_file"
        fi
    fi
}

# Stop services
stop_service "chat-ui"
stop_service "mcp-tools"
stop_service "headless-session-manager"
stop_service "shop-ui"
stop_service "shop-api"

# Also kill any remaining processes on known ports
for port in 3000 3001 3002 4200 5173; do
    pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "  Killing process on port $port (PID: $pid)..."
        kill $pid 2>/dev/null
    fi
done

echo -e "${GREEN}All services stopped.${NC}"
