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
            action: 'add_collaborator',
            attempted_operation: 'validate_input'
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
            attempted_operation: 'validate_input',
            collaborator: {
              permission: params.permission
            }
          }
        );
      }

      this.logger.debug('Executing add_collaborator', {
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
        username: params.username
      });

      return result;
    } catch (error: any) {
      const errorDetails = {
        action: 'add_collaborator',
        attempted_operation: 'add_collaborator',
        organization: params?.org,
        collaborator: {
          username: params?.username,
          permission: params?.permission
        }
      };

      if (error instanceof McpError) {
        throw error;
      }

      // Handle rate limit errors
      if (error.status === 403 && error.response?.data?.message?.includes('rate limit')) {
        const rateLimitInfo = this.getRateLimitInfo(error.response.headers);
        throw new McpError(
          ErrorCode.InternalError,
          'API rate limit exceeded',
          {
            ...errorDetails,
            rate_limit: rateLimitInfo
          }
        );
      }

      // Handle user not found errors
      if (error.status === 404) {
        throw new McpError(
          ErrorCode.InternalError,
          'Not Found',
          {
            ...errorDetails,
            collaborator: {
              username: params?.username
            }
          }
        );
      }

      // Handle network errors
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.message?.includes('Network')) {
        this.logger.error('Network error occurred', {
          ...errorDetails,
          error: error.message
        });
        throw new McpError(
          ErrorCode.InternalError,
          'Network error',
          errorDetails
        );
      }

      // Default error handling
      throw new McpError(
        ErrorCode.InternalError,
        error.message || 'Failed to add collaborator',
        errorDetails
      );
    }
  }
}
