import { vi } from 'vitest';
import type { GitHubOrg } from '../../../src/types.js';

// Test Data Generators
export const createTestOrg = (name: string): GitHubOrg => ({
  name,
  display_name: name,
  description: `Test org ${name}`,
  url: `https://api.github.com/orgs/${name}`,
  membership: {
    is_member: true,
    is_visible: true
  }
});

// Common Test Responses
export const mockOrgResponses = {
  list: {
    data: [
      createTestOrg('test-org-1'),
      createTestOrg('test-org-2')
    ]
  }
};

// Mock Octokit Organizations Methods
export const createMockOrgsMethods = () => ({
  listForAuthenticatedUser: vi.fn(),
  list: vi.fn()
});