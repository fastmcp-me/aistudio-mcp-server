# AI Studio MCP Server

A Model Context Protocol (MCP) server that integrates with Google AI Studio / Gemini API, providing content generation capabilities with support for files, conversation history, and system prompts.

## Installation and Usage

### Prerequisites

- Node.js 20.0.0 or higher
- Google AI Studio API key

### Using npx (Recommended)

```bash
GEMINI_API_KEY=your_api_key npx -y aistudio-mcp-server
```

### Local Installation

```bash
npm install -g aistudio-mcp-server
GEMINI_API_KEY=your_api_key aistudio-mcp-server
```

## Configuration

Set your Google AI Studio API key as an environment variable:

```bash
export GEMINI_API_KEY=your_api_key_here
```

### Optional Configuration

- `GEMINI_MODEL`: Gemini model to use (default: gemini-2.5-flash)
- `GEMINI_TIMEOUT`: Request timeout in milliseconds (default: 300000 = 5 minutes)
- `GEMINI_MAX_OUTPUT_TOKENS`: Maximum output tokens (default: 8192)
- `GEMINI_MAX_FILES`: Maximum number of files per request (default: 10)
- `GEMINI_MAX_TOTAL_FILE_SIZE`: Maximum total file size in bytes (default: 52428800 = 50MB)

Example:
```bash
export GEMINI_API_KEY=your_api_key_here
export GEMINI_MODEL=gemini-2.5-flash
export GEMINI_TIMEOUT=600000  # 10 minutes
export GEMINI_MAX_OUTPUT_TOKENS=16384  # More output tokens
export GEMINI_MAX_FILES=5  # Limit to 5 files per request
export GEMINI_MAX_TOTAL_FILE_SIZE=104857600  # 100MB limit
```

## Available Tools

### generate_content

Generates content using Gemini with comprehensive support for files, conversation history, and system prompts. Supports various file types including images, PDFs, Office documents, and text files.

**Parameters:**
- `user_prompt` (string, required): User prompt for generation
- `system_prompt` (string, optional): System prompt to guide AI behavior
- `files` (array, optional): Array of files to include in generation
  - Each file object must have either `path` or `content`
  - `path` (string): Path to file
  - `content` (string): Base64 encoded file content
  - `type` (string, optional): MIME type (auto-detected from file extension)
- `model` (string, optional): Gemini model to use (default: gemini-2.5-flash)

**Supported file types (Gemini 2.5 models):**
- **Images**: JPG, JPEG, PNG, GIF, WebP, SVG, BMP, TIFF
- **Video**: MP4, AVI, MOV, WEBM, FLV, MPG, WMV (up to 10 files per request)
- **Audio**: MP3, WAV, AIFF, AAC, OGG, FLAC (up to 15MB per file)
- **Documents**: PDF (treated as images, one page = one image)
- **Text**: TXT, MD, JSON, XML, CSV, HTML

**File limitations:**
- Maximum file size: 15MB per audio/video/document file
- Maximum total request size: 20MB (2GB when using Cloud Storage)
- Video files: Up to 10 per request
- PDF files follow image pricing (one page = one image)

**Basic example:**
```json
{
  "user_prompt": "Analyze this image and describe what you see",
  "files": [
    {
      "path": "/path/to/image.jpg"
    }
  ]
}
```

**PDF to Markdown conversion:**
```json
{
  "user_prompt": "Convert this PDF to well-formatted Markdown, preserving structure and formatting. Return only the Markdown content.",
  "files": [
    {
      "path": "/path/to/document.pdf"
    }
  ]
}
```

**With system prompt:**
```json
{
  "system_prompt": "You are a helpful document analyst specialized in technical documentation",
  "user_prompt": "Please provide a detailed explanation of the authentication methods shown in this document",
  "files": [
    {"path": "/api-docs.pdf"}
  ]
}
```

**Multiple files example:**
```json
{
  "user_prompt": "Compare these documents and images",
  "files": [
    {"path": "/document.pdf"},
    {"path": "/chart.png"},
    {"content": "base64encodedcontent", "type": "image/jpeg"}
  ]
}
```

## Common Use Cases

### PDF to Markdown Conversion

To convert PDF files to Markdown format, use the `generate_content` tool with an appropriate prompt:

```json
{
  "user_prompt": "Convert this PDF to well-formatted Markdown, preserving structure, headings, lists, and formatting. Include table of contents if the document has sections.",
  "files": [
    {
      "path": "/path/to/document.pdf"
    }
  ]
}
```

### Image Analysis

Analyze images, charts, diagrams, or photos with detailed descriptions:

```json
{
  "system_prompt": "You are an expert image analyst. Provide detailed, accurate descriptions of visual content.",
  "user_prompt": "Analyze this image and describe what you see. Include details about objects, people, text, colors, and composition.",
  "files": [
    {
      "path": "/path/to/image.jpg"
    }
  ]
}
```

For screenshots or technical diagrams:

```json
{
  "user_prompt": "Describe this system architecture diagram. Explain the components and their relationships.",
  "files": [
    {
      "path": "/architecture-diagram.png"
    }
  ]
}
```

### Audio Transcription

Generate transcripts from audio files:

```json
{
  "system_prompt": "You are a professional transcription service. Provide accurate, well-formatted transcripts.",
  "user_prompt": "Please transcribe this audio file. Include speaker identification if multiple speakers are present, and format it with proper punctuation and paragraphs.",
  "files": [
    {
      "path": "/meeting-recording.mp3"
    }
  ]
}
```

For interview or meeting transcripts:

```json
{
  "user_prompt": "Transcribe this interview and provide a summary of key points discussed.",
  "files": [
    {
      "path": "/interview.wav"
    }
  ]
}
```

## MCP Client Configuration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "aistudio": {
      "command": "npx",
      "args": ["-y", "aistudio-mcp-server"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "GEMINI_MODEL": "gemini-2.5-flash",
        "GEMINI_TIMEOUT": "600000",
        "GEMINI_MAX_OUTPUT_TOKENS": "16384",
        "GEMINI_MAX_FILES": "10",
        "GEMINI_MAX_TOTAL_FILE_SIZE": "52428800"
      }
    }
  }
}
```

## Development

### Setup

Make sure you have Node.js 20.0.0 or higher installed.

```bash
npm install
npm run build
```

### Running locally

```bash
GEMINI_API_KEY=your_api_key npm run dev
```

## License

MIT