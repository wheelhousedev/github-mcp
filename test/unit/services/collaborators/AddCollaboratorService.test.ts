import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddCollaboratorService } from '../../../../src/services/collaborators/AddCollaboratorService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockCollaboratorResponses } from '../../../fixtures/collaborators/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('AddCollaboratorService', () => {
  const mockOctokit = createMockOctokit();
  const mockLogger = createMockLogger();
  const mockAuthService = createMockAuthService();
  let service: AddCollaboratorService;

  beforeEach(() => {
    service = new AddCollaboratorService(mockOctokit, mockAuthService, mockLogger);
    vi.clearAllMocks();
  });

  describe('execute', () => {
    const testOrg = 'test-org';
    const testRepo = 'test-repo';
    const testUsername = 'test-user';
    const testPermission = 'push';

    it('should add collaborator successfully', async () => {
      // Given
      const response = {
        data: mockCollaboratorResponses.add.data,
        headers: { 'x-ratelimit-remaining': '4999' }
      };
      mockOctokit.repos.addCollaborator.mockResolvedValue(response);

      // When
      const result = await service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      });

      // Then
      expect(result).toEqual(response.data);
      expect(mockAuthService.verifyAuthAndScopes).toHaveBeenCalledWith(['repo']);
      expect(mockOctokit.repos.addCollaborator).toHaveBeenCalledWith({
        owner: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing add_collaborator', {
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully added collaborator',
        expect.objectContaining({
          org: testOrg,
          repo: testRepo,
          username: testUsername
        })
      );
    });

    it('should handle different permission levels', async () => {
      // Test each permission level
      const permissions = ['pull', 'push', 'admin'] as const;
      
      for (const permission of permissions) {
        // Given
        const response = {
          data: mockCollaboratorResponses.add.data,
          headers: { 'x-ratelimit-remaining': '4999' }
        };
        mockOctokit.repos.addCollaborator.mockResolvedValue(response);

        // When
        await service.execute({
          org: testOrg,
          repo: testRepo,
          username: testUsername,
          permission
        });

        // Then
        expect(mockOctokit.repos.addCollaborator).toHaveBeenCalledWith(
          expect.objectContaining({ permission })
        );
      }
    });

    it('should handle missing required parameters', async () => {
      // When/Then
      await expect(service.execute({} as any)).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Organization, repository, username, and permission are required'),
        details: expect.objectContaining({
          action: 'add_collaborator'
        })
      });
    });

    it('should handle invalid permission level', async () => {
      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: 'invalid' as any
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Invalid permission level'),
        details: expect.objectContaining({
          action: 'add_collaborator',
          collaborator: expect.objectContaining({
            permission: 'invalid'
          })
        })
      });
    });

    it('should handle user not found error', async () => {
      // Given
      mockOctokit.repos.addCollaborator.mockRejectedValue(
        createGitHubError({
          message: 'Not Found',
          status: 404
        })
      );

      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Not Found'),
        details: expect.objectContaining({
          action: 'add_collaborator',
          collaborator: expect.objectContaining({
            username: testUsername
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
        username: testUsername,
        permission: testPermission
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Bad credentials'),
        details: expect.objectContaining({
          action: 'add_collaborator',
          attempted_operation: 'add_collaborator',
          organization: testOrg,
          collaborator: expect.objectContaining({
            username: testUsername,
            permission: testPermission
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Access verification failed',
        expect.objectContaining({
          required_scopes: ['repo'],
          action: 'add_collaborator',
          attempted_operation: 'add_collaborator',
          organization: testOrg,
          collaborator: expect.objectContaining({
            username: testUsername,
            permission: testPermission
          })
        })
      );
    });

    it('should handle rate limit errors', async () => {
      // Given
      mockOctokit.repos.addCollaborator.mockRejectedValue(
        createRateLimitError()
      );

      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('API rate limit exceeded'),
        details: expect.objectContaining({
          action: 'add_collaborator',
          attempted_operation: 'add_collaborator',
          organization: testOrg,
          collaborator: expect.objectContaining({
            username: testUsername,
            permission: testPermission
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
          action: 'add_collaborator',
          attempted_operation: 'add_collaborator',
          organization: testOrg,
          collaborator: expect.objectContaining({
            username: testUsername,
            permission: testPermission
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
      mockOctokit.repos.addCollaborator.mockRejectedValue(networkError);

      // When/Then
      await expect(service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      })).rejects.toMatchObject({
        code: ErrorCode.InternalError,
        message: expect.stringContaining('Network error'),
        details: expect.objectContaining({
          action: 'add_collaborator',
          attempted_operation: 'add_collaborator',
          organization: testOrg,
          collaborator: expect.objectContaining({
            username: testUsername,
            permission: testPermission
          })
        })
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Network error occurred',
        expect.objectContaining({
          error: networkError,
          action: 'add_collaborator',
          attempted_operation: 'add_collaborator',
          organization: testOrg,
          collaborator: expect.objectContaining({
            username: testUsername,
            permission: testPermission
          })
        })
      );
    });
  });
});