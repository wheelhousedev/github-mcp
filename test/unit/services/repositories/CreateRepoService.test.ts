import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateRepoService } from '../../../../src/services/repositories/CreateRepoService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockRepoResponses } from '../../../fixtures/repositories/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

describe('CreateRepoService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: CreateRepoService;

  beforeEach(() => {
    service = new CreateRepoService(mockOctokit, mockAuthService, mockLogger);
    vi.clearAllMocks();
    mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
  });

  describe('input validation', () => {
    const testOrg = 'test-org';
    const testRepo = 'new-repo';

    it('should validate required parameters', async () => {
      // Test empty input
      const emptyError = await service.execute({} as any).catch(e => e);
      expect(emptyError.code).toBe(ErrorCode.InternalError);
      expect(emptyError.message).toContain('Organization and name are required');
      expect(emptyError.details).toMatchObject({
        action: 'create_repository',
        attempted_operation: 'create_repo'
      });

      // Test missing org
      const missingOrgError = await service.execute({ name: testRepo } as any).catch(e => e);
      expect(missingOrgError.message).toContain('Organization and name are required');
      expect(missingOrgError.details).toMatchObject({
        action: 'create_repository',
        attempted_operation: 'create_repo'
      });

      // Test missing name
      const missingNameError = await service.execute({ org: testOrg } as any).catch(e => e);
      expect(missingNameError.message).toContain('Organization and name are required');
      expect(missingNameError.details).toMatchObject({
        action: 'create_repository',
        attempted_operation: 'create_repo'
      });
    });

    it('should validate input types', async () => {
      // Test invalid org type
      const invalidOrgError = await service.execute({
        org: 123,
        name: testRepo
      } as any).catch(e => e);
      expect(invalidOrgError.code).toBe(ErrorCode.InternalError);
      expect(invalidOrgError.details).toMatchObject({
        action: 'create_repository',
        attempted_operation: 'create_repo',
        organization: 123,
        repository: {
          org: 123,
          name: testRepo
        }
      });

      // Test invalid name type
      const invalidNameError = await service.execute({
        org: testOrg,
        name: true
      } as any).catch(e => e);
      expect(invalidNameError.code).toBe(ErrorCode.InternalError);
      expect(invalidNameError.details).toMatchObject({
        action: 'create_repository',
        attempted_operation: 'create_repo',
        organization: testOrg,
        repository: {
          org: testOrg,
          name: true
        }
      });
    });
  });

  describe('successful creation', () => {
    const testOrg = 'test-org';
    const testRepo = 'new-repo';

    it('should successfully create a repository', async () => {
      const response = {
        data: {
          ...mockRepoResponses.create.data,
          visibility: 'public',
          created_at: '2025-01-07T00:00:00Z'
        },
        headers: {
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': '1609459200'
        }
      };
      mockOctokit.repos.createInOrg.mockResolvedValue(response);

      const result = await service.execute({
        org: testOrg,
        name: testRepo,
        description: 'Test repository'
      });

      expect(result).toMatchObject({
        name: testRepo,
        description: 'Test repo new-repo',
        private: false,
        visibility: 'public',
        created_at: '2025-01-07T00:00:00Z'
      });

      expect(mockOctokit.repos.createInOrg).toHaveBeenCalledWith({
        org: testOrg,
        name: testRepo,
        description: 'Test repository',
        private: undefined,
        auto_init: true
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully created repository',
        expect.objectContaining({
          org: testOrg,
          name: testRepo
        })
      );
    });
  });

  describe('error handling', () => {
    const testOrg = 'test-org';
    const testRepo = 'new-repo';

    it('should handle auth verification failures', async () => {
      const authError = new McpError(
        ErrorCode.InternalError,
        'Bad credentials',
        {
          action: 'create_repository',
          attempted_operation: 'verify_auth',
          required_scopes: ['repo']
        }
      );
      mockAuthService.verifyAuthAndScopes.mockRejectedValue(authError);

      const error = await service.execute({
        org: testOrg,
        name: testRepo
      }).catch(e => e);

      expect(error).toEqual(authError);
      expect(mockOctokit.repos.createInOrg).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['repo'],
          error: expect.stringContaining('Bad credentials')
        })
      );
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      (rateLimitError as any).status = 403;
      (rateLimitError as any).response = {
        data: {
          message: 'API rate limit exceeded'
        },
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': '1609459200'
        }
      };
      mockOctokit.repos.createInOrg.mockRejectedValue(rateLimitError);

      const error = await service.execute({
        org: testOrg,
        name: testRepo
      }).catch(e => e);

      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('API rate limit exceeded');
      expect(error.details).toEqual(
        expect.objectContaining({
          action: 'create_repository',
          attempted_operation: 'create_repo',
          organization: testOrg,
          repository: {
            org: testOrg,
            name: testRepo
          }
        })
      );
      expect(error.details.rate_limit).toBeDefined();
      expect(error.details.rate_limit.remaining).toBe('0');
      expect(error.details.rate_limit.reset).toBe('1609459200');
    });

    it('should handle network errors', async () => {
      mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
      mockOctokit.repos.createInOrg.mockRejectedValue(
        new Error('Network error')
      );

      const error = await service.execute({
        org: testOrg,
        name: testRepo
      }).catch(e => e);

      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Network error');
      expect(error.details).toMatchObject({
        action: 'create_repository',
        attempted_operation: 'create_repo',
        organization: testOrg,
        repository: {
          org: testOrg,
          name: testRepo
        }
      });
    });
  });
});