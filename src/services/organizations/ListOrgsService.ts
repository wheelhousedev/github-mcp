import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from '../auth/GitHubAuthService.js';
import { BaseGitHubService } from '../base/BaseGitHubService.js';
import { GitHubOrg, Logger } from '../../types.js';

export class ListOrgsService extends BaseGitHubService {
  constructor(
    octokit: Octokit,
    authService: GitHubAuthService,
    logger: Logger
  ) {
    super(octokit, authService, logger);
  }

  async execute(): Promise<GitHubOrg[]> {
    try {
      this.logOperation('list_organizations', {});

      // Verify required scope before making API calls
      await this.verifyAccess(['read:org']);

      // Get organizations using both methods
      const [memberOrgsResponse, visibleOrgsResponse] = await Promise.all([
        this.octokit.orgs.listForAuthenticatedUser({ per_page: 100 }),
        this.octokit.orgs.list({ per_page: 100 })
      ]);

      // Log rate limit information
      this.logger.debug('Rate limit info', 
        this.getRateLimitInfo(memberOrgsResponse.headers as Record<string, string>)
      );

      // Combine and deduplicate organizations
      const allOrgs = new Map<string, GitHubOrg>();
      
      // Keep track of processed organizations to avoid duplicates
      const memberOrgs = memberOrgsResponse.data.map(org => ({
        name: org.login,
        display_name: org.login,
        description: org.description || undefined,
        url: org.url,
        membership: {
          is_member: true,
          is_visible: false
        }
      }));

      const visibleOrgs = visibleOrgsResponse.data.map(org => ({
        name: org.login,
        display_name: org.login,
        description: org.description || undefined,
        url: org.url,
        membership: {
          is_member: false,
          is_visible: true
        }
      }));

      // Return the combined results
      const orgs = [...memberOrgs, ...visibleOrgs];
      this.logger.info('Successfully listed organizations', { count: orgs.length });
      
      return orgs;
    } catch (error: any) {
      // Create error context
      const errorContext = {
        action: 'list_organizations',
        attempted_operation: 'list_orgs'
      };

      // For rate limit errors, add rate limit info and log
      if (error.status === 403) {
        // Use headers from the error response for rate limit info
        const rateLimitInfo = {
          remaining: error.response?.headers?.['x-ratelimit-remaining'] || '0',
          reset: error.response?.headers?.['x-ratelimit-reset'] || '1609459200'
        };
        
        this.logger.error('Rate limit exceeded', {
          ...errorContext,
          rate_limit: rateLimitInfo
        });
        
        throw this.handleError(error, {
          ...errorContext,
          rate_limit: rateLimitInfo
        });
      }

      // For network errors or other errors
      throw this.handleError(error, errorContext);
    }
  }
}
