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
        this.handleError(
          new Error('Organization and name are required'),
          {
            action: 'create_repository',
            attempted_operation: 'create_repo'
          }
        );
        return {} as GitHubRepo; // This line will never be reached
      }

      // Validate input types
      if (typeof params.org !== 'string' || typeof params.name !== 'string') {
        this.handleError(
          new Error('Invalid input types for organization or name'),
          {
            action: 'create_repository',
            attempted_operation: 'create_repo',
            organization: params.org,
            repository: {
              org: params.org,
              name: params.name
            }
          }
        );
        return {} as GitHubRepo; // This line will never be reached
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
      const context: {
        action: string;
        attempted_operation: string;
        organization?: string;
        repository?: {
          org: string;
          name: string;
        };
        rate_limit?: Record<string, string>;
        required_scopes?: string[];
      } = {
        action: 'create_repository',
        attempted_operation: 'create_repo',
        organization: params?.org,
        repository: {
          org: params?.org,
          name: params?.name
        }
      };

      // Handle authentication errors
      if (error.message?.includes('Bad credentials')) {
        context.attempted_operation = 'verify_auth';
        context.required_scopes = ['repo'];
      }

      // Handle rate limit errors
      if (error.status === 403 && error.message?.includes('rate limit')) {
        context.rate_limit = this.getRateLimitInfo(error.response?.headers || {});
      }

      this.handleError(error, context);
      return {} as GitHubRepo; // This line will never be reached
    }
  }
}
