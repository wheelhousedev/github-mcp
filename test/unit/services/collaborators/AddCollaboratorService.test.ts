import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddCollaboratorService } from '../../../../src/services/collaborators/AddCollaboratorService';
import { createMockOctokit } from '../../../fixtures/octokit';
import { createMockLogger, createMockAuthService } from '../../../fixtures/utils/common';
import { mockCollaboratorResponses } from '../../../fixtures/collaborators/mocks';
import { createGitHubError, createRateLimitError } from '../../../fixtures/utils/errors';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

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
      const error = await service.execute({} as any).catch(e => e);
      
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Organization, repository, username, and permission are required');
      expect(error.data).toMatchObject({
        action: 'add_collaborator',
        attempted_operation: 'validate_input'
      });
    });

    it('should handle invalid permission level', async () => {
      // When/Then
      const error = await service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: 'invalid' as any
      }).catch(e => e);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Invalid permission level');
      expect(error.data).toMatchObject({
        action: 'add_collaborator',
        attempted_operation: 'validate_input',
        collaborator: {
          permission: 'invalid'
        }
      });
    });

    it('should handle rate limit errors', async () => {
      // Given
      const rateLimitError = createRateLimitError();
      mockOctokit.repos.addCollaborator.mockRejectedValue(rateLimitError);

      // When/Then
      const error = await service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      }).catch(e => e);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('API rate limit exceeded');
      expect(error.data).toMatchObject({
        action: 'add_collaborator',
        attempted_operation: 'add_collaborator',
        organization: testOrg,
        collaborator: {
          username: testUsername,
          permission: testPermission
        },
        rate_limit: expect.any(Object)
      });
    });

    it('should handle not found errors', async () => {
      // Given
      const notFoundError = createGitHubError({
        message: 'Not Found',
        status: 404
      });
      mockOctokit.repos.addCollaborator.mockRejectedValue(notFoundError);

      // When/Then
      const error = await service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      }).catch(e => e);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Not Found');
      expect(error.data).toMatchObject({
        action: 'add_collaborator',
        attempted_operation: 'add_collaborator',
        organization: testOrg,
        collaborator: {
          username: testUsername
        }
      });
    });

    it('should handle network errors', async () => {
      // Given
      const networkError = new Error('Network error occurred');
      (networkError as any).code = 'ETIMEDOUT';
      mockOctokit.repos.addCollaborator.mockRejectedValue(networkError);

      // When/Then
      const error = await service.execute({
        org: testOrg,
        repo: testRepo,
        username: testUsername,
        permission: testPermission
      }).catch(e => e);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Network error');
      expect(error.data).toMatchObject({
        action: 'add_collaborator',
        attempted_operation: 'add_collaborator',
        organization: testOrg,
        collaborator: {
          username: testUsername,
          permission: testPermission
        }
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Network error occurred', expect.objectContaining({
        error: networkError.message
      }));
    });
  });
});