#!/usr/bin/env node

// Test script to verify the MCP server is working
const { spawn } = require('child_process');

console.log('Testing aistudio-mcp-server...');

// Set up environment
const env = { ...process.env };
if (!env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is required');
  console.log('Usage: GEMINI_API_KEY=your-key node test-server.js');
  process.exit(1);
}

// Start the server
const server = spawn('node', ['dist/index.js'], {
  env,
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send a test request
const testRequest = {
  jsonrpc: '2.0',
  method: 'tools/list',
  id: 1
};

server.stdin.write(JSON.stringify(testRequest) + '\n');

// Handle response
server.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
  
  // Close the server after getting response
  server.stdin.end();
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
});