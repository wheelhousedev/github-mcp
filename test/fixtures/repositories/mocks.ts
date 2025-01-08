import { vi } from 'vitest';
import type { GitHubRepo, GitHubRepoSettings } from '../../../src/types.js';

// Test Data Generators
export const createTestRepo = (name: string, org: string): GitHubRepo => ({
  name,
  description: `Test repo ${name}`,
  private: false,
  url: `https://api.github.com/repos/${org}/${name}`,
  clone_url: `https://github.com/${org}/${name}.git`
});

// Common Test Responses
export const mockRepoResponses = {
  list: {
    data: [
      createTestRepo('test-repo-1', 'test-org'),
      createTestRepo('test-repo-2', 'test-org')
    ]
  },
  create: {
    data: createTestRepo('new-repo', 'test-org')
  },
  settings: {
    update: {
      data: {
        name: 'test-repo',
        settings: {
          has_issues: true,
          has_projects: true,
          has_wiki: true,
          allow_squash_merge: true,
          allow_merge_commit: true,
          allow_rebase_merge: true
        }
      } as GitHubRepoSettings
    }
  }
};

// Mock Octokit Repository Methods
export const createMockReposMethods = () => ({
  createInOrg: vi.fn(),
  listForOrg: vi.fn(),
  update: vi.fn()
});