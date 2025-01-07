import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from '../auth/GitHubAuthService.js';
import { BaseGitHubService } from '../base/BaseGitHubService.js';
import { Logger, GitHubRepo } from '../../types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface CreateRepoInput {
  org: string;
  name: string;
  description?: string;
  private?: boolean;
}

export class CreateRepoService extends BaseGitHubService {
  constructor(
    octokit: Octokit,
    authService: GitHubAuthService,
    logger: Logger
  ) {
    super(octokit, authService, logger);
  }

  async execute(params: CreateRepoInput): Promise<GitHubRepo> {
    try {
      // Validate required parameters
      if (!params.org || !params.name) {
        throw new McpError(
          ErrorCode.InternalError,
          'Organization and name are required',
          {
            action: 'create_repository'
          }
        );
      }

      this.logOperation('create_repository', {
        org: params.org,
        name: params.name,
        private: params.private
      });

      // Verify required scope before making API calls
      await this.verifyAccess(['repo']);

      // Create repository
      const response = await this.octokit.repos.createInOrg({
        org: params.org,
        name: params.name,
        description: params.description,
        private: params.private,
        auto_init: true // Initialize with README
      });

      // Log rate limit information
      this.logger.debug('Rate limit info',
        this.getRateLimitInfo(response.headers as Record<string, string>)
      );

      const result: GitHubRepo = {
        name: response.data.name,
        description: response.data.description || undefined,
        private: response.data.private,
        url: response.data.url,
        clone_url: response.data.clone_url,
        html_url: response.data.html_url,
        visibility: response.data.visibility || (response.data.private ? 'private' : 'public'),
        created_at: response.data.created_at
      };

      this.logger.info('Successfully created repository', {
        org: params.org,
        name: params.name,
        url: result.url
      });

      return result;
    } catch (error: any) {
      const errorDetails = {
        action: 'create_repository',
        attempted_operation: 'create_repo',
        organization: params?.org,
        repository: {
          org: params?.org,
          name: params?.name
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

      // For validation errors
      if (!params.org || !params.name) {
        throw new McpError(
          ErrorCode.InternalError,
          'Organization and name are required',
          errorDetails
        );
      }

      // For other GitHub API errors
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        error.message || 'Failed to create repository',
        errorDetails
      );
    }
  }
}
