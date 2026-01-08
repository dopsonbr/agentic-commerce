#!/bin/bash
set -e

echo "Stopping Agentic Commerce..."

cd "$(dirname "$0")/.."

docker compose down

echo "All services stopped"
