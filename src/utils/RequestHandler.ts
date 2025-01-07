import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Simple error handler for MCP server operations
 */
export class RequestHandler {
  constructor(
    private logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) => void
  ) {}

  /**
   * Execute a request and handle errors appropriately for MCP
   */
  async executeRequest<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger('error', `Error in ${context}`, error);
      throw this.wrapError(error as Error, context);
    }
  }

  /**
   * Convert errors to appropriate MCP error types
   */
  private wrapError(error: Error, context: string): McpError {
    const message = `Failed to ${context}: ${error.message}`;
    
    if (error instanceof McpError) {
      return error;
    }

    return new McpError(ErrorCode.InternalError, message);
  }
}
