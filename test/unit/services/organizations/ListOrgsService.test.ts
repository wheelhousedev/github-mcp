import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListOrgsService } from '../../../../src/services/organizations/ListOrgsService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockOrgResponses } from '../../../fixtures/organizations/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('ListOrgsService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: ListOrgsService;

  beforeEach(() => {
    service = new ListOrgsService(mockOctokit, mockAuthService, mockLogger);
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should list organizations successfully', async () => {
      // Given
      const memberOrgs = {
        data: [mockOrgResponses.list.data[0]],
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      const visibleOrgs = {
        data: [mockOrgResponses.list.data[1]],
        headers: { 'x-ratelimit-remaining': '4998' }
      };

      mockOctokit.orgs.listForAuthenticatedUser.mockResolvedValue(memberOrgs);
      mockOctokit.orgs.list.mockResolvedValue(visibleOrgs);

      // When
      const result = await service.execute();

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].membership.is_member).toBe(true);
      expect(result[1].membership.is_visible).toBe(true);
      
      expect(mockAuthService.verifyAuthAndScopes).toHaveBeenCalledWith(['read:org']);
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing list_organizations', {});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully listed organizations',
        expect.objectContaining({ count: 2 })
      );
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
      await expect(service.execute()).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Bad credentials'),
        details: expect.objectContaining({
          action: 'list_organizations',
          attempted_operation: 'list_orgs'
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['read:org']
        })
      );
    });

    it('should handle rate limit errors', async () => {
      // Given
      mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
      const rateLimitError = createRateLimitError();
      mockOctokit.orgs.listForAuthenticatedUser.mockRejectedValue(rateLimitError);

      // When/Then
      const error = await service.execute().catch(e => e);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.details).toMatchObject({
        action: 'list_organizations',
        attempted_operation: 'list_orgs',
        originalError: {
          message: 'API rate limit exceeded',
          status: 403,
          response: {
            headers: {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': '1609459200'
            }
          }
        }
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          action: 'list_organizations',
          attempted_operation: 'list_orgs',
          rate_limit: expect.objectContaining({
            remaining: '0',
            reset: '1609459200'
          })
        })
      );
    });

    it('should handle network errors', async () => {
      // Given
      mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
      const networkError = new Error('Network error');
      mockOctokit.orgs.listForAuthenticatedUser.mockRejectedValue(networkError);

      // When/Then
      const error = await service.execute().catch(e => e);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.details).toMatchObject({
        action: 'list_organizations',
        attempted_operation: 'list_orgs',
        originalError: {
          message: 'Network error'
        }
      });
    });
  });
});