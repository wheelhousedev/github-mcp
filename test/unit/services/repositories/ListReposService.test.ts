import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListReposService } from '../../../../src/services/repositories/ListReposService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockRepoResponses } from '../../../fixtures/repositories/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

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
      await expect(service.execute({} as any)).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Organization is required'),
        details: expect.objectContaining({
          action: 'list_repositories'
        })
      });
    });

    it('should handle authentication errors', async () => {
      // Given
      mockAuthService.verifyAuthAndScopes.mockRejectedValue(
        createGitHubError({
          message: 'Bad credentials',
          status: 401
        })
      );

      // When/Then
      await expect(service.execute({ org: testOrg })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Bad credentials'),
        details: expect.objectContaining({
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['read:org', 'repo'],
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg
        })
      );
    });

    it('should handle rate limit errors', async () => {
      // Given
      mockOctokit.repos.listForOrg.mockRejectedValue(
        createRateLimitError()
      );

      // When/Then
      await expect(service.execute({ org: testOrg })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('API rate limit exceeded'),
        details: expect.objectContaining({
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg,
          rate_limit: expect.objectContaining({
            remaining: '0',
            reset: '1609459200'
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg,
          rate_limit: expect.objectContaining({
            remaining: '0',
            reset: '1609459200'
          })
        })
      );
    });

    it('should handle network errors', async () => {
      // Given
      const networkError = new Error('Network error');
      mockOctokit.repos.listForOrg.mockRejectedValue(networkError);

      // When/Then
      await expect(service.execute({ org: testOrg })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Network error'),
        details: expect.objectContaining({
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Network error occurred',
        expect.objectContaining({
          error: networkError,
          action: 'list_repositories',
          attempted_operation: 'list_repos',
          organization: testOrg
        })
      );
    });
  });
});