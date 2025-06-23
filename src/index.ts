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

  constructor() {
    // Read configuration from environment variables
    this.timeout = parseInt(process.env.GEMINI_TIMEOUT || '300000'); // Default 5 minutes
    this.maxOutputTokens = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '8192'); // Default 8192
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // Default gemini-2.5-flash
    this.maxFiles = parseInt(process.env.GEMINI_MAX_FILES || '10'); // Default maximum 10 files
    this.maxTotalFileSize = parseInt(process.env.GEMINI_MAX_TOTAL_FILE_SIZE || '52428800'); // Default 50MB

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
            name: 'convert_pdf_to_markdown',
            description: 'Convert PDF files to Markdown using Gemini Vision. Supports single or multiple PDF files. MIME type is auto-detected from file extension.\n\nExample usage:\n```json\n{\n  "files": [\n    {\n      "path": "/path/to/document.pdf"\n    }\n  ],\n  "prompt": "Convert to Markdown format"\n}\n```\n\nFor multiple files:\n```json\n{\n  "files": [\n    {"path": "/doc1.pdf"},\n    {"content": "base64content", "type": "application/pdf"}\n  ]\n}\n```',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  description: 'Array of PDF files to convert. Each file needs either path or content.',
                  items: {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        description: 'Path to PDF file',
                      },
                      content: {
                        type: 'string',
                        description: 'Base64 encoded PDF file content (alternative to path)',
                      },
                      type: {
                        type: 'string',
                        description: 'MIME type of the file (optional, auto-detected from file extension)',
                      },
                    },
                    required: [],
                    oneOf: [
                      { required: ['path'] },
                      { required: ['content'] },
                    ],
                  },
                  minItems: 1,
                  maxItems: this.maxFiles,
                },
                prompt: {
                  type: 'string',
                  description: 'Additional instructions for conversion (optional)',
                  default: 'Convert this PDF to well-formatted Markdown, preserving structure and formatting. Return only the Markdown content without any additional text.',
                },
                model: {
                  type: 'string',
                  description: 'Gemini model to use (optional)',
                  default: this.defaultModel,
                },
              },
              required: ['files'],
            },
          },
          {
            name: 'generate_content',
            description: 'Generate content using Gemini with optional file inputs. Supports multiple files of various types (images, PDFs, documents). MIME type is auto-detected from file extension.\n\nExample usage:\n```json\n{\n  "prompt": "Analyze this image",\n  "files": [\n    {\n      "path": "/path/to/image.jpg"\n    }\n  ]\n}\n```\n\nMultiple files example:\n```json\n{\n  "prompt": "Compare these documents",\n  "files": [\n    {"path": "/doc.pdf"},\n    {"path": "/image.png"}\n  ]\n}\n```',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Text prompt for generation',
                },
                files: {
                  type: 'array',
                  description: 'Array of files to include in generation (optional). Supports images, PDFs, documents, etc.',
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
              },
              required: ['prompt'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'convert_pdf_to_markdown':
            return await this.convertPdfToMarkdown(args);
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
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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

  private async convertPdfToMarkdown(args: any) {
    if (!this.genAI) {
      throw new Error('GenAI not initialized');
    }

    const prompt = args.prompt || 'Convert this PDF to well-formatted Markdown, preserving structure and formatting. Return only the Markdown content without any additional text.';
    const model = args.model || this.defaultModel;
    const contents: any[] = [prompt];

    const processedFiles = await this.processFiles(args.files);
    
    if (processedFiles.errors.length > 0) {
      const errorMessages = processedFiles.errors.map(err => 
        err.name ? `${err.name}: ${err.error}` : err.error
      ).join('\n');
      throw new Error(`File processing errors:\n${errorMessages}`);
    }
    
    if (processedFiles.success.length === 0) {
      throw new Error('No files were successfully processed');
    }
    
    // Add each file to contents
    processedFiles.success.forEach((file, index) => {
      contents.push({
        inlineData: {
          mimeType: file.type,
          data: file.content,
        },
      });
    });
    
    // Update prompt for multi-file processing
    if (processedFiles.success.length > 1) {
      contents[0] = `${prompt}\n\nProcessing ${processedFiles.success.length} files. Please provide the converted Markdown for each file with clear section headers indicating the source file name.`;
    }

    try {
      const response = await this.genAI.models.generateContent({
        model,
        contents,
        config: {
          maxOutputTokens: this.maxOutputTokens,
        },
      });

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

  private async generateContent(args: any) {
    if (!this.genAI) {
      throw new Error('GenAI not initialized');
    }

    const model = args.model || this.defaultModel;
    const contents: any[] = [args.prompt];

    // Process files if provided
    if (args.files && args.files.length > 0) {
      const processedFiles = await this.processFiles(args.files);
      
      if (processedFiles.errors.length > 0) {
        const errorMessages = processedFiles.errors.map(err => 
          err.name ? `${err.name}: ${err.error}` : err.error
        ).join('\n');
        throw new Error(`File processing errors:\n${errorMessages}`);
      }
      
      // Add successfully processed files to contents
      processedFiles.success.forEach((file) => {
        contents.push({
          inlineData: {
            mimeType: file.type,
            data: file.content,
          },
        });
      });
    }

    try {
      const response = await this.genAI.models.generateContent({
        model,
        contents,
        config: {
          maxOutputTokens: this.maxOutputTokens,
        },
      });

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