import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LogMessage, Logger } from '../types.js';

export class McpLogger implements Logger {
  private logs: LogMessage[] = [];
  private server?: Server;

  constructor(server?: Server) {
    this.server = server;
  }

  setServer(server: Server) {
    this.server = server;
  }

  private log(level: LogMessage['level'], message: string, data?: unknown) {
    const logMessage: LogMessage = {
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Store in memory
    this.logs.push(logMessage);
    
    // Console output with proper formatting
    const formattedMessage = `[${logMessage.timestamp}] ${level.toUpperCase()}: ${message}`;
    console.error(formattedMessage);
    if (data) {
      console.error(JSON.stringify(data, null, 2));
    }

    // Send to MCP if initialized and error/warning
    if (this.server?.onerror && (level === 'error' || level === 'warn')) {
      this.server.onerror(new Error(formattedMessage));
    }
  }

  debug(message: string, data?: unknown) {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.log('error', message, data);
  }

  // Get logs for debugging/testing
  getLogs(): LogMessage[] {
    return [...this.logs];
  }

  // Clear logs (useful for testing)
  clearLogs() {
    this.logs = [];
  }
}
