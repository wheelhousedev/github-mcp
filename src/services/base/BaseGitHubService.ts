import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from '../auth/GitHubAuthService.js';
import { createGitHubError } from '../error/errorUtils.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../../types.js';

export abstract class BaseGitHubService {
  protected constructor(
    protected octokit: Octokit,
    protected authService: GitHubAuthService,
    protected logger: Logger
  ) {}

  protected async verifyAccess(requiredScopes: string[]): Promise<void> {
    try {
      await this.authService.verifyAuthAndScopes(requiredScopes);
    } catch (error: any) {
      this.logger.error('Access verification failed', {
        required_scopes: requiredScopes,
        error: error.message
      });
      throw error;
    }
  }

  protected handleError(error: any, context: { action: string; [key: string]: any }) {
    // If it's already a GitHubError, just add additional context and re-throw
    if (error.code && error.details) {
      error.details = {
        ...error.details,
        ...context
      };
      throw error;
    }

    // Create new GitHubError with context
    throw createGitHubError({
      message: error.message || 'An error occurred during the operation',
      code: ErrorCode.InternalError,
      error,
      context
    });
  }

  protected getRateLimitInfo(headers: Record<string, string>) {
    return this.authService.getRateLimitInfo(headers);
  }

  protected logOperation(operation: string, params: Record<string, any>) {
    this.logger.debug(`Executing ${operation}`, params);
  }
}
