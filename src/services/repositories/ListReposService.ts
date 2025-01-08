import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from '../auth/GitHubAuthService.js';
import { BaseGitHubService } from '../base/BaseGitHubService.js';
import { Logger, GitHubRepo } from '../../types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface ListReposInput {
  org: string;
}

export class ListReposService extends BaseGitHubService {
  constructor(
    octokit: Octokit,
    authService: GitHubAuthService,
    logger: Logger
  ) {
    super(octokit, authService, logger);
  }

  async execute(params: ListReposInput): Promise<GitHubRepo[]> {
    try {
      // Validate required parameters
      if (!params.org) {
        this.handleError(
          new Error('Organization is required'),
          { action: 'list_repositories' }
        );
        return []; // This line will never be reached, but TypeScript needs it
      }

      this.logOperation('list_repositories', { org: params.org });

      // Verify required scopes before making API calls
      await this.verifyAccess(['read:org', 'repo']);

      // Get repositories
      const response = await this.octokit.repos.listForOrg({
        org: params.org,
        per_page: 100
      });

      // Log rate limit information
      this.logger.debug('Rate limit info',
        this.getRateLimitInfo(response.headers as Record<string, string>)
      );

      const repos: GitHubRepo[] = response.data.map(repo => ({
        name: repo.name,
        description: repo.description || undefined,
        private: repo.private,
        url: repo.url,
        clone_url: repo.clone_url || `https://github.com/${params.org}/${repo.name}.git`
      }));

      this.logger.info('Successfully listed repositories', {
        org: params.org,
        count: repos.length
      });
      
      return repos;
    } catch (error: any) {
      const context: {
        action: string;
        attempted_operation: string;
        organization?: string;
        rate_limit?: Record<string, string>;
        required_scopes?: string[];
      } = {
        action: 'list_repositories',
        attempted_operation: 'list_repos',
        organization: params?.org
      };

      // Handle authentication errors
      if (error.message?.includes('Bad credentials')) {
        context.attempted_operation = 'verify_auth';
        context.required_scopes = ['read:org', 'repo'];
      }

      // Handle rate limit errors
      if (error.status === 403 && error.message?.includes('rate limit')) {
        context.rate_limit = this.getRateLimitInfo(error.response?.headers || {});
      }

      this.handleError(error, context);
      return []; // This line will never be reached, but TypeScript needs it
    }
  }
}
