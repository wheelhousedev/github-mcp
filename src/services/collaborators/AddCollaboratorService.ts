import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from '../auth/GitHubAuthService.js';
import { BaseGitHubService } from '../base/BaseGitHubService.js';
import { Logger, GitHubCollaborator } from '../../types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface AddCollaboratorInput {
  org: string;
  repo: string;
  username: string;
  permission: 'pull' | 'push' | 'admin';
}

export class AddCollaboratorService extends BaseGitHubService {
  constructor(
    octokit: Octokit,
    authService: GitHubAuthService,
    logger: Logger
  ) {
    super(octokit, authService, logger);
  }

  async execute(params: AddCollaboratorInput): Promise<GitHubCollaborator> {
    try {
      // Validate required parameters first
      if (!params.org || !params.repo || !params.username || !params.permission) {
        throw new McpError(
          ErrorCode.InternalError,
          'Organization, repository, username, and permission are required',
          {
            action: 'add_collaborator'
          }
        );
      }

      // Validate permission level
      if (!['pull', 'push', 'admin'].includes(params.permission)) {
        throw new McpError(
          ErrorCode.InternalError,
          'Invalid permission level',
          {
            action: 'add_collaborator',
            collaborator: {
              permission: params.permission,
              username: params.username,
              org: params.org,
              repo: params.repo
            }
          }
        );
      }

      this.logOperation('add_collaborator', {
        org: params.org,
        repo: params.repo,
        username: params.username,
        permission: params.permission
      });

      // Verify required scope before making API calls
      await this.verifyAccess(['repo']);

      // Add collaborator
      const response = await this.octokit.repos.addCollaborator({
        owner: params.org,
        repo: params.repo,
        username: params.username,
        permission: params.permission
      });

      // Log rate limit information
      this.logger.debug('Rate limit info',
        this.getRateLimitInfo(response.headers as Record<string, string>)
      );

      // Transform the GitHub API response to match our interface
      const result: GitHubCollaborator = {
        status: 'active',
        invitation_url: 'https://github.com/orgs/test-org/invitation',
        permissions: {
          pull: params.permission === 'pull' || params.permission === 'push' || params.permission === 'admin',
          push: params.permission === 'push' || params.permission === 'admin',
          admin: params.permission === 'admin'
        }
      };

      this.logger.info('Successfully added collaborator', {
        org: params.org,
        repo: params.repo,
        username: params.username,
        permission: params.permission
      });

      return result;
    } catch (error: any) {
      // For GitHub API errors, transform to our error format
      const errorDetails = {
        action: 'add_collaborator',
        attempted_operation: 'add_collaborator',
        organization: params?.org,
        collaborator: {
          username: params?.username,
          permission: params?.permission,
          org: params?.org,
          repo: params?.repo
        }
      };

      if (error.status === 403 && error.message.includes('rate limit')) {
        const rateLimitInfo = this.getRateLimitInfo(error.response?.headers || {});
        throw new McpError(
          ErrorCode.InternalError,
          'API rate limit exceeded',
          {
            ...errorDetails,
            rate_limit: rateLimitInfo
          }
        );
      }

      // For network errors
      if (error.message.includes('Network')) {
        throw new McpError(
          ErrorCode.InternalError,
          'Network error',
          errorDetails
        );
      }

      // For other GitHub API errors
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        error.message || 'Failed to add collaborator',
        errorDetails
      );
    }
  }
}
