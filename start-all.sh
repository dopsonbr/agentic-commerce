#!/bin/bash

# Agentic Commerce POC - Start All Services
# This script starts all 5 services needed for the demo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/.logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agentic Commerce POC - Starting...   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port in use
    else
        return 1  # Port available
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local name=$1
    local port=$2
    local health_url=$3
    local max_attempts=90
    local attempt=1

    echo -n "  Waiting for $name..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$health_url" > /dev/null 2>&1; then
            echo -e " ${GREEN}ready${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}timeout${NC}"
    return 1
}

# Function to start a service
start_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    local port=$4

    echo -e "${YELLOW}[$name]${NC} Starting on port $port..."

    if check_port $port; then
        echo -e "  ${RED}Port $port already in use!${NC}"
        echo -e "  Run './stop-all.sh' to stop existing services"
        return 1
    fi

    cd "$SCRIPT_DIR/$dir"
    $cmd > "$LOG_DIR/$name.log" 2>&1 &
    echo $! > "$LOG_DIR/$name.pid"
    cd "$SCRIPT_DIR"
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
command -v bun >/dev/null 2>&1 || { echo -e "${RED}bun is required but not installed.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}node is required but not installed.${NC}"; exit 1; }
echo -e "  ${GREEN}All prerequisites found${NC}"
echo ""

# Start services in order
echo -e "${YELLOW}Starting services...${NC}"

# 1. shop-api (port 3000)
start_service "shop-api" "shop-api" "bun run dev" 3000

# 2. shop-ui (port 4200)
start_service "shop-ui" "shop-ui" "npm start" 4200

# 3. headless-session-manager (port 3002)
start_service "headless-session-manager" "headless-session-manager" "npm run dev" 3002

# 4. mcp-tools (port 3001)
start_service "mcp-tools" "mcp-tools" "bun run dev" 3001

# 5. chat-ui (port 5173)
start_service "chat-ui" "chat-ui" "bun run dev" 5173

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Wait for each service to be healthy
wait_for_service "shop-api" 3000 "http://localhost:3000/health"
wait_for_service "shop-ui" 4200 "http://localhost:4200"
wait_for_service "headless-session-manager" 3002 "http://localhost:3002/health"
wait_for_service "mcp-tools" 3001 "http://localhost:3001/health"
wait_for_service "chat-ui" 5173 "http://localhost:5173"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All services are running!            ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Service URLs:"
echo "  shop-api:                  http://localhost:3000"
echo "  shop-ui:                   http://localhost:4200"
echo "  shop-ui (automation):      http://localhost:4200?automation=1"
echo "  headless-session-manager:  http://localhost:3002"
echo "  mcp-tools:                 http://localhost:3001"
echo -e "  ${GREEN}chat-ui:                   http://localhost:5173${NC} <- Open this!"
echo ""
echo "Logs: $LOG_DIR/"
echo ""
echo "To stop all services: ./stop-all.sh"
echo ""
