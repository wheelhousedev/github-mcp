import { vi } from 'vitest';
import type { GitHubCollaborator } from '../../../src/types.js';

// Common Test Responses
export const mockCollaboratorResponses = {
  add: {
    data: {
      status: 'active',
      invitation_url: 'https://github.com/orgs/test-org/invitation',
      permissions: {
        pull: true,
        push: true,
        admin: false
      }
    } as GitHubCollaborator
  }
};

// Mock Octokit Collaborator Methods
export const createMockCollaboratorMethods = () => ({
  addCollaborator: vi.fn()
});