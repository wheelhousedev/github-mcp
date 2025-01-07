import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateRepoService } from '../../../../src/services/repositories/CreateRepoService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockRepoResponses } from '../../../fixtures/repositories/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('CreateRepoService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: CreateRepoService;

  beforeEach(() => {
    service = new CreateRepoService(mockOctokit, mockAuthService, mockLogger);
    vi.clearAllMocks();
  });

  describe('execute', () => {
    const testOrg = 'test-org';
    const testRepo = 'new-repo';
    const testDescription = 'Test repository';

    it('should create a public repository successfully', async () => {
      // Given
      const response = {
        data: mockRepoResponses.create.data,
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      mockOctokit.repos.createInOrg.mockResolvedValue(response);

      // When
      const result = await service.execute({
        org: testOrg,
        name: testRepo,
        description: testDescription
      });

      // Then
      expect(result).toEqual(response.data);
      expect(mockAuthService.verifyAuthAndScopes).toHaveBeenCalledWith(['repo']);
      expect(mockOctokit.repos.createInOrg).toHaveBeenCalledWith({
        org: testOrg,
        name: testRepo,
        description: testDescription,
        private: false
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing create_repository', {
        org: testOrg,
        name: testRepo,
        private: false
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully created repository',
        expect.objectContaining({
          org: testOrg,
          name: testRepo
        })
      );
    });

    it('should create a private repository successfully', async () => {
      // Given
      const response = {
        data: { ...mockRepoResponses.create.data, private: true },
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      mockOctokit.repos.createInOrg.mockResolvedValue(response);

      // When
      const result = await service.execute({
        org: testOrg,
        name: testRepo,
        description: testDescription,
        private: true
      });

      // Then
      expect(result).toEqual(response.data);
      expect(mockOctokit.repos.createInOrg).toHaveBeenCalledWith({
        org: testOrg,
        name: testRepo,
        description: testDescription,
        private: true
      });
    });

    it('should handle missing required parameters', async () => {
      // When/Then
      await expect(service.execute({} as any)).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Organization and name are required'),
        details: expect.objectContaining({
          action: 'create_repository'
        })
      });
    });

    it('should handle repository already exists error', async () => {
      // Given
      mockOctokit.repos.createInOrg.mockRejectedValue(
        createGitHubError({
          message: 'Repository already exists',
          status: 422
        })
      );

      // When/Then
      await expect(service.execute({
        org: testOrg,
        name: testRepo
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Repository already exists'),
        details: expect.objectContaining({
          action: 'create_repository',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            name: testRepo
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
        name: testRepo
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Bad credentials'),
        details: expect.objectContaining({
          action: 'create_repository',
          attempted_operation: 'create_repo',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            name: testRepo
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['repo'],
          action: 'create_repository',
          attempted_operation: 'create_repo',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            name: testRepo
          })
        })
      );
    });

    it('should handle rate limit errors', async () => {
      // Given
      mockOctokit.repos.createInOrg.mockRejectedValue(
        createRateLimitError()
      );

      // When/Then
      await expect(service.execute({
        org: testOrg,
        name: testRepo
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('API rate limit exceeded'),
        details: expect.objectContaining({
          action: 'create_repository',
          attempted_operation: 'create_repo',
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
          action: 'create_repository',
          attempted_operation: 'create_repo',
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
      mockOctokit.repos.createInOrg.mockRejectedValue(networkError);

      // When/Then
      await expect(service.execute({
        org: testOrg,
        name: testRepo
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Network error'),
        details: expect.objectContaining({
          action: 'create_repository',
          attempted_operation: 'create_repo',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            name: testRepo
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Network error occurred',
        expect.objectContaining({
          error: networkError,
          action: 'create_repository',
          attempted_operation: 'create_repo',
          organization: testOrg,
          repository: expect.objectContaining({
            org: testOrg,
            name: testRepo
          })
        })
      );
    });
  });
});