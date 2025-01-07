import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateRepoSettingsService } from '../../../../src/services/repositories/UpdateRepoSettingsService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockRepoResponses } from '../../../fixtures/repositories/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('UpdateRepoSettingsService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: UpdateRepoSettingsService;

  beforeEach(() => {
    service = new UpdateRepoSettingsService(mockOctokit, mockAuthService, mockLogger);
    vi.clearAllMocks();
  });

  describe('execute', () => {
    const testOrg = 'test-org';
    const testRepo = 'test-repo';
    const testSettings = {
      has_issues: true,
      has_projects: true,
      has_wiki: true,
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: true
    };

    it('should update repository settings successfully', async () => {
      // Given
      const response = {
        data: mockRepoResponses.settings.update.data,
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      mockOctokit.repos.update.mockResolvedValue(response);

      // When
      const result = await service.execute({
        org: testOrg,
        repo: testRepo,
        settings: testSettings
      });

      // Then
      expect(result).toEqual(response.data);
      expect(mockAuthService.verifyAuthAndScopes).toHaveBeenCalledWith(['repo']);
      expect(mockOctokit.repos.update).toHaveBeenCalledWith({
        owner: testOrg,
        repo: testRepo,
        ...testSettings
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing update_repository_settings', {
        org: testOrg,
        repo: testRepo,
        settings: testSettings
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully updated repository settings',
        expect.objectContaining({
          org: testOrg,
          repo: testRepo
        })
      );
    });

    it('should handle partial settings updates', async () => {
      // Given
      const partialSettings = {
        has_issues: true,
        has_wiki: false
      };
      const response = {
        data: {
          ...mockRepoResponses.settings.update.data,
          settings: {
            ...mockRepoResponses.settings.update.data.settings,
            ...partialSettings
          }
        },
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      mockOctokit.repos.update.mockResolvedValue(response);

      // When
      const result = await service.execute({
        org: testOrg,
        repo: testRepo,
        settings: partialSettings
      });

      // Then
      expect(result).toEqual(response.data);
      expect(mockOctokit.repos.update).toHaveBeenCalledWith({
        owner: testOrg,
        repo: testRepo,
        ...partialSettings
      });
    });

    it('should handle missing required parameters', async () => {
      // When/Then
      await expect(service.execute({} as any)).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Organization, repository, and settings are required'),
        details: expect.objectContaining({
          action: 'update_repository_settings'
        })
      });
    });

    it('should handle repository not found error', async () => {
      // Given
      mockOctokit.repos.update.mockRejectedValue(
        createGitHubError({
          message: 'Not Found',
          status: 404
        })
      );

      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        settings: testSettings
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Not Found'),
        details: expect.objectContaining({
          action: 'update_repository_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          })
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
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        settings: testSettings
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Bad credentials'),
        details: expect.objectContaining({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['repo'],
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          })
        })
      );
    });

    it('should handle rate limit errors', async () => {
      // Given
      mockOctokit.repos.update.mockRejectedValue(
        createRateLimitError()
      );

      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        settings: testSettings
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('API rate limit exceeded'),
        details: expect.objectContaining({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          }),
          rate_limit: expect.objectContaining({
            remaining: '0',
            reset: '1609459200'
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          }),
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
      mockOctokit.repos.update.mockRejectedValue(networkError);

      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        settings: testSettings
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Network error'),
        details: expect.objectContaining({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Network error occurred',
        expect.objectContaining({
          error: networkError,
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            repo: testRepo
          })
        })
      );
    });
  });
});