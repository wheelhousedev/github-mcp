import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateRepoSettingsService } from '../../../../src/services/repositories/UpdateRepoSettingsService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockRepoResponses } from '../../../fixtures/repositories/mocks';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

interface RateLimitError extends Error {
  status: number;
  response: {
    data: { message: string };
    headers: Record<string, string>;
  };
}

interface NotFoundError extends Error {
  status: number;
  response: {
    data: { message: string };
  };
}

describe('UpdateRepoSettingsService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: UpdateRepoSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit.repos.update.mockReset();
    mockAuthService.verifyAuthAndScopes.mockReset();
    mockAuthService.getRateLimitInfo.mockReset();
    service = new UpdateRepoSettingsService(mockOctokit, mockAuthService, mockLogger);
  });

  describe('execute', () => {
    const testOrg = 'test-org';
    const testRepo = 'test-repo';
    const validSettings = {
      has_issues: true,
      has_projects: true,
      has_wiki: true,
      allow_squash_merge: true,
      allow_merge_commit: true,
      allow_rebase_merge: true
    };

    describe('input validation', () => {
      it('should handle missing required parameters', async () => {
        // When/Then
        const error = await service.execute({ repo: testRepo, settings: validSettings } as any).catch(e => e);
        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain('Organization, repository, and settings are required');
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'validate_input'
        });
      });

      it('should handle invalid settings keys', async () => {
        // Given
        const invalidSettings = {
          has_issues: true,
          invalid_setting: true
        };

        // When/Then
        const error = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: invalidSettings
        }).catch(e => e);

        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain('Invalid settings provided: invalid_setting');
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'validate_input',
          organization: testOrg,
          repository: {
            org: testOrg,
            repo: testRepo
          }
        });
      });

      it('should handle non-boolean setting values', async () => {
        // Given
        const invalidSettings = {
          has_issues: 'true' // string instead of boolean
        } as any;

        // When/Then
        const error = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: invalidSettings
        }).catch(e => e);

        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain("Setting 'has_issues' must be a boolean");
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'validate_input',
          organization: testOrg,
          repository: {
            org: testOrg,
            repo: testRepo
          }
        });
      });
    });

    describe('error handling', () => {
      it('should handle authentication errors', async () => {
        // Given
        const authError = new McpError(
          ErrorCode.InternalError,
          'Bad credentials',
          {
            action: 'update_repository_settings',
            attempted_operation: 'verify_auth',
            required_scopes: ['repo']
          }
        );
        mockAuthService.verifyAuthAndScopes.mockRejectedValue(authError);

        // When/Then
        const error = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: validSettings
        }).catch(e => e);

        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain('Bad credentials');
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'verify_auth',
          required_scopes: ['repo']
        });
      });

      it('should handle rate limit errors', async () => {
        // Given
        mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
        
        // Mock getRateLimitInfo to return rate limit values
        mockAuthService.getRateLimitInfo.mockReturnValue({
          limit: '5000',
          remaining: '0',
          reset: '1609459200',
          used: '5000'
        });
        
        // Create rate limit error with specific headers
        const rateLimitHeaders = {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1609459200'
        };
        
        const rateLimitError = new Error('API rate limit exceeded') as RateLimitError;
        rateLimitError.status = 403;
        rateLimitError.response = {
          data: {
            message: 'API rate limit exceeded'
          },
          headers: rateLimitHeaders
        };

        // Mock the update call to reject with our error
        mockOctokit.repos.update.mockRejectedValue(rateLimitError);

        // When/Then
        const error = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: validSettings
        }).catch(e => e);

        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain('API rate limit exceeded');
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: {
            org: testOrg,
            repo: testRepo
          },
          rate_limit: {
            remaining: '0',
            reset: '1609459200'
          }
        });
      });

      it('should handle repository not found errors', async () => {
        // Given
        mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
        
        const notFoundError = new Error('Not Found') as NotFoundError;
        notFoundError.status = 404;
        notFoundError.response = {
          data: {
            message: 'Not Found'
          }
        };

        mockOctokit.repos.update.mockRejectedValue(notFoundError);

        // When/Then
        const error = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: validSettings
        }).catch(e => e);

        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain('Not Found');
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: {
            org: testOrg,
            repo: testRepo
          }
        });
      });

      it('should handle network errors', async () => {
        // Given
        mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
        
        const networkError = new Error('Network error');
        mockOctokit.repos.update.mockRejectedValue(networkError);

        // When/Then
        const error = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: validSettings
        }).catch(e => e);

        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InternalError);
        expect(error.message).toContain('Network error');
        expect(error.data).toMatchObject({
          action: 'update_repository_settings',
          attempted_operation: 'update_repo_settings',
          organization: testOrg,
          repository: {
            org: testOrg,
            repo: testRepo
          }
        });
      });
    });

    describe('success cases', () => {
      it('should update repository settings successfully', async () => {
        // Given
        mockAuthService.verifyAuthAndScopes.mockResolvedValue(undefined);
        const response = {
          data: mockRepoResponses.settings.update.data,
          headers: { 'x-ratelimit-remaining': '4999' }
        };
        mockOctokit.repos.update.mockResolvedValue(response);

        // When
        const result = await service.execute({
          org: testOrg,
          repo: testRepo,
          settings: validSettings
        });

        // Then
        expect(result).toEqual(response.data);
        expect(mockAuthService.verifyAuthAndScopes).toHaveBeenCalledWith(['repo']);
        expect(mockOctokit.repos.update).toHaveBeenCalledWith({
          owner: testOrg,
          repo: testRepo,
          ...validSettings
        });
        expect(mockLogger.debug).toHaveBeenCalledWith('Executing update_repository_settings', {
          org: testOrg,
          repo: testRepo,
          settings: validSettings
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Successfully updated repository settings',
          expect.objectContaining({
            org: testOrg,
            repo: testRepo,
            settings: validSettings
          })
        );
      });
    });
  });
});