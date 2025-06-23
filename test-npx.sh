#!/bin/bash

echo "Testing npx execution..."

# Test 1: Run with timeout to see if it stays alive
echo "Test 1: Running with timeout..."
GEMINI_API_KEY=test-key timeout 2 npx aistudio-mcp-server@latest
EXIT_CODE=$?

if [ $EXIT_CODE -eq 124 ]; then
    echo "✅ Server stayed alive (timeout after 2 seconds)"
else
    echo "❌ Server exited immediately with code: $EXIT_CODE"
fi

# Test 2: Check what npx actually runs
echo -e "\nTest 2: Checking npx execution path..."
npx --yes which aistudio-mcp-server

# Test 3: Check the actual bin file
echo -e "\nTest 3: Checking bin file content..."
cat $(npx --yes which aistudio-mcp-server)