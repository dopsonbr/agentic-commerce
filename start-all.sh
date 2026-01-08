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

# Track failures
FAILED=0

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agentic Commerce POC - Starting...   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
    elif command -v ss >/dev/null 2>&1; then
        ss -tuln | grep -q ":$port "
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln | grep -q ":$port "
    else
        # Can't check, assume available
        return 1
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

# Function to check if node_modules exist
check_deps() {
    local dir=$1
    local name=$2
    if [ ! -d "$SCRIPT_DIR/$dir/node_modules" ] || [ -z "$(ls -A "$SCRIPT_DIR/$dir/node_modules" 2>/dev/null)" ]; then
        echo -e "  ${RED}Missing dependencies in $name${NC}"
        echo -e "  Run: cd $dir && npm install (or bun install)"
        return 1
    fi
    return 0
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
    local pid=$!
    echo $pid > "$LOG_DIR/$name.pid"
    cd "$SCRIPT_DIR"

    # Give it a moment to fail fast if there's an issue
    sleep 0.5
    if ! kill -0 $pid 2>/dev/null; then
        echo -e "  ${RED}Failed to start (check $LOG_DIR/$name.log)${NC}"
        return 1
    fi

    return 0
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
command -v bun >/dev/null 2>&1 || { echo -e "${RED}bun is required but not installed.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}node is required but not installed.${NC}"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}curl is required but not installed.${NC}"; exit 1; }
echo -e "  ${GREEN}All prerequisites found${NC}"
echo ""

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"
DEPS_OK=1
check_deps "shop-ui" "shop-ui" || DEPS_OK=0
check_deps "headless-session-manager" "headless-session-manager" || DEPS_OK=0

# For Bun apps, check if they can resolve imports (simpler check)
if [ ! -d "$SCRIPT_DIR/mcp-tools/node_modules/zod" ]; then
    echo -e "  ${RED}Missing zod in mcp-tools${NC}"
    echo -e "  Run: cd mcp-tools && npm install zod"
    DEPS_OK=0
fi

if [ $DEPS_OK -eq 0 ]; then
    echo ""
    echo -e "${RED}Please install missing dependencies and try again.${NC}"
    exit 1
fi
echo -e "  ${GREEN}Dependencies OK${NC}"
echo ""

# Start services in order
echo -e "${YELLOW}Starting services...${NC}"
echo ""

# 1. shop-api (port 3000)
echo -e "  ${BLUE}shop-api${NC} - REST API for products and cart"
start_service "shop-api" "shop-api" "bun run dev" 3000 || FAILED=1

# 2. shop-ui (port 4200)
echo -e "  ${BLUE}shop-ui${NC} - Angular shopping SPA with NgRx"
start_service "shop-ui" "shop-ui" "npm start" 4200 || FAILED=1

# 3. headless-session-manager (port 3002)
echo -e "  ${BLUE}headless-session-manager${NC} - Playwright browser sessions"
start_service "headless-session-manager" "headless-session-manager" "npm run dev" 3002 || FAILED=1

# 4. mcp-tools (port 3001)
echo -e "  ${BLUE}mcp-tools${NC} - MCP tool server (5 tools)"
start_service "mcp-tools" "mcp-tools" "bun run dev" 3001 || FAILED=1

# 5. chat-ui (port 5173)
echo -e "  ${BLUE}chat-ui${NC} - Chat interface with scripted agent"
start_service "chat-ui" "chat-ui" "bun run dev" 5173 || FAILED=1

if [ $FAILED -eq 1 ]; then
    echo ""
    echo -e "${RED}Some services failed to start. Check logs in $LOG_DIR/${NC}"
    echo "Stopping any services that did start..."
    "$SCRIPT_DIR/stop-all.sh"
    exit 1
fi

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Wait for each service to be healthy
wait_for_service "shop-api" 3000 "http://localhost:3000/health" || FAILED=1
wait_for_service "shop-ui" 4200 "http://localhost:4200" || FAILED=1
wait_for_service "headless-session-manager" 3002 "http://localhost:3002/health" || FAILED=1
wait_for_service "mcp-tools" 3001 "http://localhost:3001/health" || FAILED=1
wait_for_service "chat-ui" 5173 "http://localhost:5173" || FAILED=1

if [ $FAILED -eq 1 ]; then
    echo ""
    echo -e "${RED}Some services failed health checks. Check logs in $LOG_DIR/${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All 5 services are running!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Running Services:${NC}"
echo ""
echo "  Service                     Port    URL"
echo "  ─────────────────────────────────────────────────────────────"
echo "  shop-api                    3000    http://localhost:3000"
echo "  shop-ui                     4200    http://localhost:4200"
echo "  headless-session-manager    3002    http://localhost:3002"
echo "  mcp-tools                   3001    http://localhost:3001"
echo -e "  ${GREEN}chat-ui                     5173    http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Quick Start:${NC}"
echo -e "  Open ${GREEN}http://localhost:5173${NC} in your browser to start the demo"
echo ""
echo -e "${YELLOW}Demo Commands to Try:${NC}"
echo "  \"my customer id is 123456\"    - Set your customer ID"
echo "  \"show me hammers\"              - Search for products"
echo "  \"add it to my cart\"            - Add last product to cart"
echo "  \"what's in my cart\"            - View cart contents"
echo ""
echo -e "${YELLOW}Logs:${NC} $LOG_DIR/"
echo -e "${YELLOW}Stop:${NC} ./stop-all.sh"
echo ""
