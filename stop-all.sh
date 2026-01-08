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

# Function to stop a service by PID file
stop_service() {
    local name=$1
    local pid_file="$LOG_DIR/$name.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "  Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null
            # Wait up to 5 seconds for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 50 ]; do
                sleep 0.1
                count=$((count + 1))
            done
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "  Force killing $name..."
                kill -9 "$pid" 2>/dev/null
            fi
            rm -f "$pid_file"
        else
            echo "  $name not running (stale PID file)"
            rm -f "$pid_file"
        fi
    fi
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    local pids=""

    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti :$port 2>/dev/null)
    elif command -v ss >/dev/null 2>&1; then
        # ss doesn't directly give PIDs, skip
        return
    fi

    if [ -n "$pids" ]; then
        for pid in $pids; do
            echo "  Killing process on port $port (PID: $pid)..."
            kill $pid 2>/dev/null
        done
    fi
}

# Stop services by PID file (reverse order of startup)
stop_service "chat-ui"
stop_service "mcp-tools"
stop_service "headless-session-manager"
stop_service "shop-ui"
stop_service "shop-api"

# Also kill any remaining processes on known ports
for port in 3000 3001 3002 4200 5173; do
    kill_port $port
done

echo -e "${GREEN}All services stopped.${NC}"
