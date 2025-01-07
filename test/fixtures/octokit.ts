import type { Mock } from 'vitest';
import type { Octokit } from '@octokit/rest';
import type { GitHubOrg, GitHubRepo, GitHubRepoSettings, GitHubCollaborator } from '../../src/types.js';
import { createMockOrgsMethods } from './organizations/mocks.js';
import { createMockReposMethods } from './repositories/mocks.js';
import { createMockCollaboratorMethods } from './collaborators/mocks.js';

// Mock Octokit Types
export type MockOctokit = {
  orgs: {
    listForAuthenticatedUser: Mock<() => Promise<{ data: GitHubOrg[]; headers: Record<string, string> }>>;
    list: Mock<() => Promise<{ data: GitHubOrg[]; headers: Record<string, string> }>>;
  };
  repos: {
    createInOrg: Mock<(params: { org: string; name: string; description?: string; private?: boolean }) => Promise<{ data: GitHubRepo }>>;
    listForOrg: Mock<(params: { org: string }) => Promise<{ data: GitHubRepo[] }>>;
    update: Mock<(params: { owner: string; repo: string; settings: GitHubRepoSettings['settings'] }) => Promise<{ data: GitHubRepoSettings }>>;
    addCollaborator: Mock<(params: { owner: string; repo: string; username: string; permission: string }) => Promise<{ data: GitHubCollaborator }>>;
  };
};

// Create typed mock Octokit
export const createMockOctokit = () => ({
  orgs: createMockOrgsMethods(),
  repos: {
    ...createMockReposMethods(),
    ...createMockCollaboratorMethods()
  }
} as unknown as MockOctokit & Octokit);