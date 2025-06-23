# AI Studio MCP Server

A Model Context Protocol (MCP) server that integrates with Google AI Studio / Gemini API, providing tools for PDF to Markdown conversion and general content generation.

## Installation and Usage

### Prerequisites

- Node.js 20.0.0 or higher
- Google AI Studio API key

### Using npx (Recommended)

```bash
GEMINI_API_KEY=your_api_key npx -y aistudio-mcp-server@latest
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

### convert_pdf_to_markdown

Converts PDF files to well-formatted Markdown using Gemini's vision capabilities. Supports single or multiple PDF files with automatic error handling and file size validation.

**Parameters:**
- `files` (array, required): Array of PDF files to convert
  - Each file object must have either `path` or `content`
  - `path` (string): Path to PDF file
  - `content` (string): Base64 encoded PDF file content  
  - `type` (string, optional): MIME type (auto-detected from file extension)
- `prompt` (string, optional): Additional instructions for conversion
- `model` (string, optional): Gemini model to use (default: gemini-2.5-flash)

**Example:**
```json
{
  "files": [
    {
      "path": "/path/to/document.pdf"
    }
  ],
  "prompt": "Convert to Markdown with table of contents"
}
```

**Multiple files example:**
```json
{
  "files": [
    {"path": "/doc1.pdf"},
    {"content": "base64encodedpdfcontent", "type": "application/pdf"}
  ]
}
```

### generate_content

Generates content using Gemini with optional multi-file input support. Supports various file types including images, PDFs, Office documents, and text files.

**Parameters:**
- `prompt` (string, required): Text prompt for generation
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

**Example:**
```json
{
  "prompt": "Analyze this image and describe what you see",
  "files": [
    {
      "path": "/path/to/image.jpg"
    }
  ]
}
```

**Multiple files example:**
```json
{
  "prompt": "Compare these documents and images",
  "files": [
    {"path": "/document.pdf"},
    {"path": "/chart.png"},
    {"content": "base64encodedcontent", "type": "image/jpeg"}
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
      "args": ["-y", "aistudio-mcp-server@latest"],
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