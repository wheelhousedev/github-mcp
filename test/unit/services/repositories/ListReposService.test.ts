import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListReposService } from '../../../../src/services/repositories/ListReposService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockRepoResponses } from '../../../fixtures/repositories/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

describe('ListReposService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: ListReposService;

  beforeEach(() => {
    service = new ListReposService(mockOctokit, mockAuthService, mockLogger);
    vi.clearAllMocks();
  });

  describe('execute', () => {
    const testOrg = 'test-org';

    it('should list repositories successfully', async () => {
      // Given
      const response = {
        data: mockRepoResponses.list.data,
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      mockOctokit.repos.listForOrg.mockResolvedValue(response);

      // When
      const result = await service.execute({ org: testOrg });

      // Then
      expect(result).toEqual(response.data);
      expect(mockAuthService.verifyAuthAndScopes).toHaveBeenCalledWith(['read:org', 'repo']);
      expect(mockOctokit.repos.listForOrg).toHaveBeenCalledWith({
        org: testOrg,
        per_page: 100
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing list_repositories', {
        org: testOrg
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully listed repositories',
        expect.objectContaining({ 
          org: testOrg,
          count: response.data.length 
        })
      );
    });

    it('should handle missing organization parameter', async () => {
      // When/Then
      const error = await service.execute({} as any).catch(e => e);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Organization is required');
      expect(error.details).toMatchObject({
        action: 'list_repositories'
      });
    });

    it('should handle authentication errors', async () => {
      // Given
      const authError = new McpError(
        ErrorCode.InternalError,
        'Bad credentials',
        {
          action: 'list_repositories',
          attempted_operation: 'verify_auth',
          required_scopes: ['read:org', 'repo']
        }
      );
      mockAuthService.verifyAuthAndScopes.mockRejectedValue(authError);

      // When/Then
      const error = await service.execute({ org: testOrg }).catch(e => e);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Bad credentials');
      expect(error.details).toMatchObject({
        action: 'list_repositories',
        attempted_operation: 'verify_auth',
        required_scopes: ['read:org', 'repo']
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['read:org', 'repo'],
          error: expect.stringContaining('Bad credentials')
        })
      );
    });

    it('should handle rate limit errors', async () => {
      // Given
      mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
      const rateLimitError = new Error('API rate limit exceeded');
      (rateLimitError as any).status = 403;
      (rateLimitError as any).response = {
        data: {
          message: 'API rate limit exceeded'
        },
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1609459200'
        }
      };
      mockOctokit.repos.listForOrg.mockRejectedValue(rateLimitError);

      // When/Then
      const error = await service.execute({ org: testOrg }).catch(e => e);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('API rate limit exceeded');
      expect(error.details).toEqual(
        expect.objectContaining({
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg
        })
      );
      expect(error.details.rate_limit).toBeDefined();
      expect(error.details.rate_limit.remaining).toBe('0');
      expect(error.details.rate_limit.reset).toBe('1609459200');
      // No logger.error call expected for rate limit errors as they are handled by handleError
    });

    it('should handle network errors', async () => {
      // Given
      mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
      mockOctokit.repos.listForOrg.mockRejectedValue(
        new McpError(
          ErrorCode.InternalError,
          'Network error',
          {
            action: 'list_repositories',
            attempted_operation: 'list_repos',
            organization: testOrg
          }
        )
      );

      // When/Then
      const error = await service.execute({ org: testOrg }).catch(e => e);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Network error');
      expect(error.details).toMatchObject({
        action: 'list_repositories',
        attempted_operation: 'list_repos',
        organization: testOrg
      });
    });
  });
});