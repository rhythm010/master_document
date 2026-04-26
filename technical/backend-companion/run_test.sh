#!/bin/bash

# Test execution helper
# Usage: ./run_test.sh <test_id> <unique_suffix>

TEST_ID=$1
UNIQUE_SUFFIX=$2
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== TEST EXECUTION START ==="
echo "Test ID: $TEST_ID"
echo "Unique Suffix: $UNIQUE_SUFFIX"
echo "Timestamp: $TIMESTAMP"
echo ""
