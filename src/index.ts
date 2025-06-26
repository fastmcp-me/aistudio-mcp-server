#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenAI } from '@google/genai';

class AIStudioMCPServer {
  private server: Server;
  private genAI: GoogleGenAI | null = null;
  private timeout: number;
  private maxOutputTokens: number;
  private defaultModel: string;
  private maxFiles: number;
  private maxTotalFileSize: number;
  private defaultTemperature: number;

  constructor() {
    // Read configuration from environment variables
    this.timeout = parseInt(process.env.GEMINI_TIMEOUT || '300000'); // Default 5 minutes
    this.maxOutputTokens = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '8192'); // Default 8192
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // Default gemini-2.5-flash
    this.maxFiles = parseInt(process.env.GEMINI_MAX_FILES || '10'); // Default maximum 10 files
    this.maxTotalFileSize = parseInt(process.env.GEMINI_MAX_TOTAL_FILE_SIZE || '50') * 1024 * 1024; // Default 50MB
    this.defaultTemperature = parseFloat(process.env.GEMINI_TEMPERATURE || '0.2'); // Default 0.2

    this.server = new Server(
      {
        name: 'aistudio-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.initializeGenAI();
  }

  private initializeGenAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is required');
      process.exit(1);
    }

    try {
      this.genAI = new GoogleGenAI({ apiKey });
      
      // Display configuration information
      console.error(`AI Studio MCP Server configuration:`);
      console.error(`- Timeout: ${this.timeout}ms (${this.timeout / 1000}s)`);
      console.error(`- Max Output Tokens: ${this.maxOutputTokens}`);
      console.error(`- Default Model: ${this.defaultModel}`);
      console.error(`- Max Files: ${this.maxFiles}`);
      console.error(`- Max Total File Size: ${Math.round(this.maxTotalFileSize / 1024 / 1024)}MB`);
      console.error(`- Default Temperature: ${this.defaultTemperature}`);
    } catch (error) {
      console.error('Failed to initialize Google GenAI:', error);
      process.exit(1);
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_content',
            description: 'Generate content using Gemini with optional file inputs. Supports multiple files: images (JPG, PNG, GIF, WebP, SVG, BMP, TIFF), video (MP4, AVI, MOV, WebM, FLV, MPG, WMV), audio (MP3, WAV, AIFF, AAC, OGG, FLAC), documents (PDF), and text files (TXT, MD, JSON, XML, CSV, HTML). MIME type is auto-detected from file extension.\n\nExample usage:\n```json\n{\n  "user_prompt": "Analyze this video",\n  "files": [\n    {\n      "path": "/path/to/video.mp4"\n    }\n  ]\n}\n```\n\nPDF to Markdown conversion:\n```json\n{\n  "user_prompt": "Convert this PDF to well-formatted Markdown, preserving structure and formatting",\n  "files": [\n    {"path": "/document.pdf"}\n  ]\n}\n```\n\nWith system prompt:\n```json\n{\n  "system_prompt": "You are a helpful assistant specialized in document analysis",\n  "user_prompt": "Please provide a detailed summary",\n  "files": [{"path": "/document.pdf"}]\n}\n```',
            inputSchema: {
              type: 'object',
              properties: {
                user_prompt: {
                  type: 'string',
                  description: 'User prompt for generation',
                },
                system_prompt: {
                  type: 'string',
                  description: 'System prompt to guide the AI behavior (optional)',
                },
                files: {
                  type: 'array',
                  description: 'Array of files to include in generation (optional). Supports images, video, audio, PDFs, and text files.',
                  items: {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        description: 'Path to file',
                      },
                      content: {
                        type: 'string',
                        description: 'Base64 encoded file content (alternative to path)',
                      },
                      type: {
                        type: 'string',
                        description: 'MIME type of the file (optional, auto-detected from file extension if path provided)',
                      },
                    },
                    required: [],
                    oneOf: [
                      { required: ['path'] },
                      { required: ['content'] },
                    ],
                  },
                  maxItems: this.maxFiles,
                },
                model: {
                  type: 'string',
                  description: 'Gemini model to use (optional)',
                  default: this.defaultModel,
                },
                temperature: {
                  type: 'number',
                  description: 'Temperature for generation (0-2, default 0.2)',
                  default: this.defaultTemperature,
                  minimum: 0,
                  maximum: 2,
                },
              },
              required: ['user_prompt'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'generate_content':
            return await this.generateContent(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private getMimeType(filePath: string): string {
    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      // Documents
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      
      // Video
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.flv': 'video/x-flv',
      '.mpg': 'video/mpeg',
      '.mpeg': 'video/mpeg',
      '.wmv': 'video/x-ms-wmv',
      
      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.aiff': 'audio/aiff',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      
      // Text
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.htm': 'text/html',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async processFiles(files: any[]): Promise<{success: Array<{content: string, type: string, name?: string}>, errors: Array<{name?: string, error: string}>}> {
    if (files.length > this.maxFiles) {
      throw new Error(`Too many files: ${files.length}. Maximum allowed: ${this.maxFiles}`);
    }
    
    const results = {
      success: [] as Array<{content: string, type: string, name?: string}>,
      errors: [] as Array<{name?: string, error: string}>
    };
    
    let totalSize = 0;
    
    for (const file of files) {
      try {
        let fileContent: string;
        let fileName: string | undefined;
        
        if (file.content) {
          fileContent = file.content;
          fileName = file.name || 'inline-content';
        } else if (file.path) {
          const fs = await import('fs');
          const path = await import('path');
          try {
            // Resolve the path without blocking .. traversal
            const resolvedPath = path.resolve(file.path);
            const normalizedPath = path.normalize(file.path);
            
            // Log path access for monitoring (optional)
            if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
              console.warn(`Accessing path: ${file.path}`);
            }
            
            const buffer = fs.readFileSync(resolvedPath);
            fileContent = buffer.toString('base64');
            fileName = path.basename(resolvedPath);
            
            // Check individual file size (approximate base64 size)
            const fileSize = buffer.length;
            totalSize += fileSize;
            
            if (totalSize > this.maxTotalFileSize) {
              results.errors.push({
                name: fileName,
                error: `Total file size exceeded: ${Math.round(totalSize / 1024 / 1024)}MB. Maximum allowed: ${Math.round(this.maxTotalFileSize / 1024 / 1024)}MB`
              });
              break;
            }
          } catch (error) {
            results.errors.push({
              name: file.path,
              error: `Failed to read file: ${error}`
            });
            continue;
          }
        } else {
          results.errors.push({
            error: 'Either content or path must be provided for each file'
          });
          continue;
        }
        
        const mimeType = file.type || (file.path ? this.getMimeType(file.path) : 'application/octet-stream');
        
        results.success.push({
          content: fileContent,
          type: mimeType,
          name: fileName
        });
      } catch (error) {
        results.errors.push({
          name: file.path || file.name || 'unknown',
          error: `Processing error: ${error}`
        });
      }
    }
    
    return results;
  }


  private async generateContent(args: any) {
    if (!this.genAI) {
      throw new Error('GenAI not initialized');
    }

    const model = args.model || this.defaultModel;
    
    // Build contents array for conversation
    const contents: any[] = [];
    
    // Build the current user message parts
    const currentMessageParts: any[] = [{ text: args.user_prompt }];

    // Process files if provided and add to current message
    if (args.files && args.files.length > 0) {
      const processedFiles = await this.processFiles(args.files);
      
      if (processedFiles.errors.length > 0) {
        const errorMessages = processedFiles.errors.map(err => 
          err.name ? `${err.name}: ${err.error}` : err.error
        ).join('\n');
        throw new Error(`File processing errors:\n${errorMessages}`);
      }
      
      // Add successfully processed files to current message parts
      processedFiles.success.forEach((file) => {
        currentMessageParts.push({
          inlineData: {
            mimeType: file.type,
            data: file.content,
          },
        });
      });
    }
    
    // Add the current user message
    contents.push({
      role: 'user',
      parts: currentMessageParts
    });

    // Prepare request configuration
    const requestConfig: any = {
      model,
      contents,
      config: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: args.temperature !== undefined ? args.temperature : this.defaultTemperature,
      },
    };
    
    // Add system instruction if provided
    if (args.system_prompt) {
      requestConfig.systemInstruction = {
        parts: [{ text: args.system_prompt }]
      };
    }

    try {
      const response = await this.genAI.models.generateContent(requestConfig);

      return {
        content: [
          {
            type: 'text',
            text: response.text || 'No content generated',
          },
        ],
      };
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('AI Studio MCP Server running on stdio');
  }
}

async function main() {
  const server = new AIStudioMCPServer();
  await server.start();
}

// Always run main when this file is loaded
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export { AIStudioMCPServer };