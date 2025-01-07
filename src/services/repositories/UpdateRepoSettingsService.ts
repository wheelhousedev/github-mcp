import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from '../auth/GitHubAuthService.js';
import { BaseGitHubService } from '../base/BaseGitHubService.js';
import { Logger, GitHubRepoSettings } from '../../types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface UpdateRepoSettingsInput {
  org: string;
  repo: string;
  settings: GitHubRepoSettings['settings'];
}

export class UpdateRepoSettingsService extends BaseGitHubService {
  constructor(
    octokit: Octokit,
    authService: GitHubAuthService,
    logger: Logger
  ) {
    super(octokit, authService, logger);
  }

  async execute(params: UpdateRepoSettingsInput): Promise<GitHubRepoSettings> {
    try {
      // Validate required parameters
      if (!params.org || !params.repo || !params.settings) {
        throw new McpError(
          ErrorCode.InternalError,
          'Organization, repository, and settings are required',
          {
            action: 'update_repository_settings'
          }
        );
      }

      // Validate settings object
      const validSettings = [
        'has_issues',
        'has_projects',
        'has_wiki',
        'allow_squash_merge',
        'allow_merge_commit',
        'allow_rebase_merge'
      ];

      // Check for invalid settings
      const invalidSettings = Object.keys(params.settings).filter(
        key => !validSettings.includes(key)
      );

      if (invalidSettings.length > 0) {
        throw new McpError(
          ErrorCode.InternalError,
          `Invalid settings provided: ${invalidSettings.join(', ')}`,
          {
            action: 'update_repository_settings',
            organization: params.org,
            repository: {
              org: params.org,
              repo: params.repo
            }
          }
        );
      }

      // Validate setting values are boolean
      Object.entries(params.settings).forEach(([key, value]) => {
        if (typeof value !== 'boolean') {
          throw new McpError(
            ErrorCode.InternalError,
            `Setting '${key}' must be a boolean`,
            {
              action: 'update_repository_settings',
              organization: params.org,
              repository: {
                org: params.org,
                repo: params.repo
              }
            }
          );
        }
      });

      this.logOperation('update_repository_settings', {
        org: params.org,
        repo: params.repo,
        settings: params.settings
      });

      // Verify required scope before making API calls
      await this.verifyAccess(['repo']);

      // Update repository settings
      const response = await this.octokit.repos.update({
        owner: params.org,
        repo: params.repo,
        ...params.settings
      });

      // Log rate limit information
      this.logger.debug('Rate limit info',
        this.getRateLimitInfo(response.headers as Record<string, string>)
      );

      const result: GitHubRepoSettings = {
        name: response.data.name,
        settings: {
          has_issues: response.data.has_issues ?? false,
          has_projects: response.data.has_projects ?? false,
          has_wiki: response.data.has_wiki ?? false,
          allow_squash_merge: response.data.allow_squash_merge ?? false,
          allow_merge_commit: response.data.allow_merge_commit ?? false,
          allow_rebase_merge: response.data.allow_rebase_merge ?? false
        }
      };

      this.logger.info('Successfully updated repository settings', {
        org: params.org,
        repo: params.repo,
        settings: result.settings
      });

      return result;
    } catch (error: any) {
      const errorDetails = {
        action: 'update_repository_settings',
        attempted_operation: 'update_repo_settings',
        organization: params?.org,
        repository: params?.org && params?.repo ? {
          org: params.org,
          repo: params.repo
        } : undefined
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
      if (!params.org || !params.repo || !params.settings) {
        throw new McpError(
          ErrorCode.InternalError,
          'Organization, repository, and settings are required',
          {
            action: 'update_repository_settings'
          }
        );
      }

      // For other GitHub API errors
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        error.message || 'Failed to update repository settings',
        errorDetails
      );
    }
  }
}
