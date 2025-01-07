import { vi, type Mock } from 'vitest';
import type { Logger } from '../../../src/types.js';
import type { GitHubAuthService, AuthResult } from '../../../src/services/auth/GitHubAuthService';

// Mock Logger
export const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

// Mock Auth Service with properly typed mock functions
export const createMockAuthService = () => {
  const defaultAuthResult: AuthResult = {
    username: 'test-user',
    scopes: ['read:org', 'repo'],
    headers: {
      'x-oauth-scopes': 'read:org,repo'
    }
  };

  return {
    verifyAuth: vi.fn().mockResolvedValue(defaultAuthResult),
    verifyAuthAndScopes: vi.fn().mockResolvedValue(defaultAuthResult),
    verifyRequiredScopes: vi.fn(),
    getRateLimitInfo: vi.fn().mockReturnValue({
      limit: '5000',
      remaining: '4999',
      reset: '1609459200',
      used: '1'
    })
  } as unknown as GitHubAuthService & {
    verifyAuth: Mock;
    verifyAuthAndScopes: Mock;
    verifyRequiredScopes: Mock;
    getRateLimitInfo: Mock;
  };
};