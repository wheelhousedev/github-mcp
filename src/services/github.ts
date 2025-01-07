import { Octokit } from '@octokit/rest';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { GitHubCollaborator, GitHubError, GitHubOrg, GitHubRepo, GitHubRepoSettings, GitHubService, Logger } from '../types.js';
import { createValidationError } from './error/errorUtils.js';

export class OctokitGitHubService implements GitHubService {
  private octokit: Octokit;
  private logger: Logger;

  constructor(token: string, logger: Logger) {
    if (!token) {
      throw new Error('GitHub token is required');
    }

    this.logger = logger;
    this.octokit = new Octokit({
      auth: token
    });

    this.logger.debug('GitHub service initialized');
  }

  async verifyAuth(): Promise<{ username: string; scopes: string[] }> {
    try {
      const { data: user, headers } = await this.octokit.users.getAuthenticated();
      const scopes = headers['x-oauth-scopes'] || '';
      const scopesList = scopes.split(',').map(s => s.trim());
      
      this.logger.info('Successfully authenticated as GitHub user', { 
        username: user.login,
        scopes: scopesList
      });

      return {
        username: user.login,
        scopes: scopesList
      };
    } catch (error: any) {
      const gitHubError: GitHubError = new Error('Unable to authenticate') as GitHubError;
      gitHubError.code = ErrorCode.InternalError;
      gitHubError.details = {
        action: 'verify_auth',
        originalError: {
          status: error.status,
          message: error.message,
          response: error.response
        },
        status: error.status,
        requestId: error.response?.headers?.['x-github-request-id'],
        documentation: error.response?.data?.documentation_url
      };

      this.logger.error('Authentication failed', {
        status: error.status,
        message: error.message,
        requestId: gitHubError.details.requestId
      });

      throw gitHubError;
    }
  }

  async listOrgs(): Promise<GitHubOrg[]> {
    try {
      // Get user info and scopes
      const userResponse = await this.octokit.users.getAuthenticated();
      const scopes = userResponse.headers['x-oauth-scopes'] || '';
      const scopesList = scopes.split(',').map(s => s.trim());

      // Check for required scope
      if (!scopesList.includes('read:org')) {
        const error: GitHubError = new Error(
          'Insufficient permissions to list organization memberships'
        ) as GitHubError;
        
        error.code = ErrorCode.InvalidParams;
        error.details = {
          action: 'list_orgs',
          originalError: {
            status: 403,
            message: 'Insufficient permissions',
            response: {
              data: {
                message: 'Insufficient permissions',
                documentation_url: 'https://docs.github.com/rest/orgs/orgs#list-organizations-for-the-authenticated-user'
              },
              headers: {}
            }
          },
          required_scopes: ['read:org'],
          current_scopes: scopesList,
          documentation: 'https://docs.github.com/rest/orgs/orgs#list-organizations-for-the-authenticated-user'
        };
        
        this.logger.error('Missing required scope', {
          required: 'read:org',
          current: scopesList
        });
        
        throw error;
      }

      // Get organizations using both methods
      const [memberOrgsResponse, visibleOrgsResponse] = await Promise.all([
        this.octokit.orgs.listForAuthenticatedUser({ per_page: 100 }),
        this.octokit.orgs.list({ per_page: 100 })
      ]);

      // Combine and deduplicate organizations
      const allOrgs = new Map<string, GitHubOrg>();
      
      [...memberOrgsResponse.data, ...visibleOrgsResponse.data].forEach(org => {
        if (!allOrgs.has(org.login)) {
          allOrgs.set(org.login, {
            name: org.login,
            display_name: org.login,
            description: org.description || undefined,
            url: org.url,
            membership: {
              is_member: memberOrgsResponse.data.some(memberOrg => memberOrg.login === org.login),
              is_visible: visibleOrgsResponse.data.some(visibleOrg => visibleOrg.login === org.login)
            }
          });
        }
      });

      return Array.from(allOrgs.values());
    } catch (error: any) {
      // Re-throw if it's already a GitHubError
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw createValidationError('Unable to list organizations. Please check your permissions.', {
        action: 'list_orgs',
        status: error.status,
        message: error.message,
        requestId: error.response?.headers?.['x-github-request-id'],
        documentation: error.response?.data?.documentation_url
      });
    }
  }

  async listRepos(org: string): Promise<GitHubRepo[]> {
    try {
      const { data: repos } = await this.octokit.repos.listForOrg({
        org,
        sort: 'updated',
        direction: 'desc'
      });

      return repos.map(repo => {
        if (!repo.clone_url) {
          throw createValidationError('Failed to get repository clone URL', {
            action: 'list_repos',
            organization: org,
            repository: repo.name
          });
        }
        return {
          name: repo.name,
          description: repo.description || undefined,
          private: repo.private,
          url: repo.html_url,
          clone_url: repo.clone_url
        };
      });
    } catch (error: any) {
      const isRateLimit = error.status === 403 && error.response?.data?.message?.includes('rate limit');
      const resetTime = error.response?.headers?.['x-ratelimit-reset'];
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toLocaleString() : 'unknown time';
      
      const errorMessage = isRateLimit 
        ? `GitHub API rate limit exceeded. You can try again after ${resetDate}`
        : 'Unable to list repositories. Please check your permissions.';
      
      throw createValidationError(errorMessage, {
        action: 'list_repos',
        organization: org,
        status: error.status,
        message: error.message,
        requestId: error.response?.headers?.['x-github-request-id'],
        documentation: error.response?.data?.documentation_url,
        rate_limit: isRateLimit ? {
          remaining: error.response?.headers?.['x-ratelimit-remaining'],
          reset: error.response?.headers?.['x-ratelimit-reset']
        } : undefined
      });
    }
  }

  async createRepo(org: string, name: string, description?: string, isPrivate = false): Promise<GitHubRepo> {
    try {
      const { data: repo } = await this.octokit.repos.createInOrg({
        org,
        name,
        description,
        private: isPrivate
      });

      if (!repo.clone_url) {
        throw createValidationError('Repository created but missing clone URL', {
          action: 'create_repo',
          repository: { org, name }
        });
      }
      return {
        name: repo.name,
        description: repo.description || undefined,
        private: repo.private,
        url: repo.html_url,
        clone_url: repo.clone_url
      };
    } catch (error: any) {
      throw createValidationError(
        `Unable to create repository '${name}' in organization '${org}'. ${error.response?.data?.message || ''}`,
        {
          action: 'create_repo',
          status: error.status,
          message: error.message,
          requestId: error.response?.headers?.['x-github-request-id'],
          documentation: error.response?.data?.documentation_url,
          repository: { org, name, description, isPrivate }
        }
      );
    }
  }

  async addCollaborator(org: string, repo: string, username: string, permission: 'pull' | 'push' | 'admin'): Promise<GitHubCollaborator> {
    try {
      const { data } = await this.octokit.repos.addCollaborator({
        owner: org,
        repo,
        username,
        permission
      });

      return {
        status: 'success',
        invitation_url: data.html_url
      };
    } catch (error: any) {
      throw createValidationError(
        `Unable to add collaborator '${username}' to repository '${org}/${repo}'. ${error.response?.data?.message || ''}`,
        {
          action: 'add_collaborator',
          status: error.status,
          message: error.message,
          requestId: error.response?.headers?.['x-github-request-id'],
          documentation: error.response?.data?.documentation_url,
          collaborator: { org, repo, username, permission }
        }
      );
    }
  }

  async updateRepoSettings(org: string, repo: string, settings: GitHubRepoSettings['settings']): Promise<GitHubRepoSettings> {
    try {
      const { data } = await this.octokit.repos.update({
        owner: org,
        repo,
        ...settings
      });

      return {
        name: data.name,
        settings: {
          has_issues: data.has_issues,
          has_projects: data.has_projects,
          has_wiki: data.has_wiki,
          allow_squash_merge: data.allow_squash_merge,
          allow_merge_commit: data.allow_merge_commit,
          allow_rebase_merge: data.allow_rebase_merge
        }
      };
    } catch (error: any) {
      throw createValidationError(
        `Unable to update settings for repository '${org}/${repo}'. ${error.response?.data?.message || ''}`,
        {
          action: 'update_repo_settings',
          status: error.status,
          message: error.message,
          requestId: error.response?.headers?.['x-github-request-id'],
          documentation: error.response?.data?.documentation_url,
          repository: { org, repo },
          settings: settings
        }
      );
    }
  }
}
