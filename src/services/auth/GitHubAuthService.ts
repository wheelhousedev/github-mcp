import { Octokit } from '@octokit/rest';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { GitHubError } from '../../types.js';
import { createGitHubError } from '../error/errorUtils.js';

export interface AuthResult {
  username: string;
  scopes: string[];
  headers?: Record<string, string>;
}

export class GitHubAuthService {
  constructor(private octokit: Octokit) {}

  async verifyAuth(): Promise<AuthResult> {
    try {
      const { data: user, headers } = await this.octokit.users.getAuthenticated();
      const scopes = headers['x-oauth-scopes'] || '';
      const scopesList = scopes.split(',').map(s => s.trim());
      
      return {
        username: user.login,
        scopes: scopesList,
        headers: headers as Record<string, string>
      };
    } catch (error: any) {
      throw createGitHubError({
        message: 'Unable to authenticate',
        code: ErrorCode.InternalError,
        error,
        context: { 
          action: 'verify_auth',
          attempted_operation: 'authenticate_user'
        }
      });
    }
  }

  verifyRequiredScopes(currentScopes: string[], requiredScopes: string[]): void {
    const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope));
    
    if (missingScopes.length > 0) {
      throw createGitHubError({
        message: 'Insufficient permissions',
        code: ErrorCode.InvalidParams,
        error: new Error('Missing required scopes'),
        context: {
          action: 'verify_scopes',
          required_scopes: requiredScopes,
          current_scopes: currentScopes,
          missing_scopes: missingScopes,
          documentation: 'https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps'
        }
      });
    }
  }

  async verifyAuthAndScopes(requiredScopes: string[]): Promise<AuthResult> {
    const authResult = await this.verifyAuth();
    this.verifyRequiredScopes(authResult.scopes, requiredScopes);
    return authResult;
  }

  getRateLimitInfo(headers: Record<string, string>) {
    return {
      limit: headers['x-ratelimit-limit'],
      remaining: headers['x-ratelimit-remaining'],
      reset: headers['x-ratelimit-reset'],
      used: headers['x-ratelimit-used']
    };
  }
}
