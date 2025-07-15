# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that integrates with Google AI Studio / Gemini API. It provides tools for PDF-to-Markdown conversion and general content generation using Google's Generative AI capabilities.

## Development Commands

Make sure you have Node.js 20.0.0 or higher installed.

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run in development mode (with ts-node)
npm run dev

# Run the compiled server
npm run start

# The build command is automatically run before publishing
npm publish
```

## Architecture

The server is implemented as a single TypeScript module (`src/index.ts`) that:
1. Creates an MCP server instance using stdio transport
2. Exposes one tool: `generate_content` (handles both general content generation and PDF-to-Markdown conversion)
3. Uses Google's Generative AI SDK to process requests
4. Handles file uploads and content generation through Gemini API
5. Supports optional Code Execution and Google Search capabilities
6. Uses streaming API to handle various response types including text, executable code, and execution results

## Environment Configuration

Required:
- `GEMINI_API_KEY`: Your Google AI Studio API key

Optional:
- `GEMINI_MODEL`: Default Gemini model to use (default: gemini-2.5-flash)
- `GEMINI_TIMEOUT`: Request timeout in milliseconds (default: 300000 / 5 minutes)
- `GEMINI_MAX_OUTPUT_TOKENS`: Maximum tokens for output (default: 8192)
- `GEMINI_MAX_FILES`: Maximum number of files per request (default: 10)
- `GEMINI_MAX_TOTAL_FILE_SIZE`: Maximum total file size in MB (default: 50)
- `GEMINI_TEMPERATURE`: Temperature for generation (0-2, default: 0.2)

## Key Implementation Details

- The server uses CommonJS module system (compiled output)
- TypeScript strict mode is enabled - ensure all types are properly defined
- File uploads are handled by reading files as base64 and sending to Gemini with appropriate MIME types
- The `generate_content` tool accepts an optional `model` parameter to override the default model
- The `generate_content` tool accepts an optional `temperature` parameter (0-2) to control response creativity
- The `generate_content` tool accepts optional `enable_code_execution` and `enable_google_search` boolean parameters
- The `generate_content` tool accepts an optional `thinking_budget` parameter for models that support thinking mode
- Uses streaming API to handle text, executable code, and code execution results
- The main executable is at `bin/aistudio-mcp-server` which requires the compiled `dist/index.js`

## File Processing

The `generate_content` tool uses a `files` array parameter for processing files:

### Usage Examples

**Convert PDF to Markdown:**
```javascript
{
  "files": [
    {
      "path": "/path/to/document.pdf"
    }
  ],
  "user_prompt": "Convert to Markdown with table of contents"
}
```

**Generate Content with Multiple Files:**
```javascript
{
  "user_prompt": "Analyze these images and documents",
  "files": [
    {
      "path": "/path/to/image.jpg"
    },
    {
      "content": "base64encodedpdfcontent",
      "type": "application/pdf"
    }
  ]
}
```

**Using Google Search:**
```javascript
{
  "user_prompt": "What are the latest developments in quantum computing?",
  "enable_google_search": true
}
```

**Using Code Execution:**
```javascript
{
  "user_prompt": "Write and execute a Python script that calculates fibonacci numbers",
  "enable_code_execution": true
}
```

**Advanced Features with Thinking Mode:**
```javascript
{
  "user_prompt": "Solve this complex mathematical problem with step-by-step reasoning",
  "model": "gemini-2.5-pro",
  "enable_code_execution": true,
  "thinking_budget": -1  // Unlimited thinking
}
```

### File Specification
- Each file must have either `path` or `content`
- `type` field is optional - auto-detected from file extension for `path`, can be specified manually for `content`
- Supports common formats: PDF, images (JPG, PNG, GIF, WebP, SVG), text files, Office documents
- Maximum 10 files per request (configurable via `GEMINI_MAX_FILES`)
- Maximum 50MB total file size (configurable via `GEMINI_MAX_TOTAL_FILE_SIZE` in MB)
- Comprehensive error reporting for individual file failures

## Testing the Server

To test the server locally:
1. Set your `GEMINI_API_KEY` environment variable
2. Run `npm run build` to compile
3. The server can be started with `npm run start` or used as an MCP server in compatible clients