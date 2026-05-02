#!/bin/bash

# Test runner wrapper - ensures environment is ready before running tests
# This script uses your EXISTING local environment (does NOT start new services)

set -e

cd "$(dirname "$0")"

# Load test environment if .env.test exists
if [ -f ".env.test" ]; then
    echo "✓ Loading test environment from .env.test"
    set -a  # automatically export all variables
    source .env.test
    set +a
else
    echo "⚠ .env.test not found, using default environment"
    echo "  To fix: Copy .env.test.example to .env.test and update tokens"
fi
echo ""

echo "========================================"
echo "Companion Test Runner"
echo "========================================"
echo ""

# Check if Docker containers are running
echo "[1/3] Checking Docker containers..."
if docker compose ps | grep -q "db.*running"; then
    echo "  ✓ Database container is running"
else
    echo "  ✗ Database container is NOT running"
    echo ""
    echo "Please start Docker containers first:"
    echo "  docker compose up -d"
    echo ""
    exit 1
fi

# Check if API server is running
echo "[2/3] Checking API server..."
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✓ API server is running on http://localhost:3000"
else
    echo "  ✗ API server is NOT running on http://localhost:3000"
    echo ""
    echo "Please start the API server first:"
    echo "  npm run dev"
    echo ""
    exit 1
fi

# Check if Mailpit is running
echo "[3/3] Checking Mailpit..."
if curl -s -f http://localhost:8025/api/v1/messages > /dev/null 2>&1; then
    echo "  ✓ Mailpit is running on http://localhost:8025"
else
    echo "  ✗ Mailpit is NOT running on http://localhost:8025"
    echo ""
    echo "Mailpit should be included in docker compose."
    echo "Check: docker compose ps"
    echo ""
    exit 1
fi

echo ""
echo "✓ All services are ready!"
echo ""
echo "Running tests..."
echo "========================================"
echo ""

# Run the TypeScript test runner with all arguments passed through
npx tsx src/test-runner/index.ts "$@"

echo ""
echo "========================================"
echo "Test run complete"
echo "========================================"
