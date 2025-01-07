// Error Factories
interface GitHubErrorOptions {
  message: string;
  status?: number;
  headers?: Record<string, string>;
  documentation_url?: string;
  required_scopes?: string[];
}

export const createGitHubError = ({
  message,
  status = 400,
  headers = {},
  documentation_url,
  required_scopes
}: GitHubErrorOptions) => {
  const error = new Error(message);
  (error as any).status = status;
  (error as any).response = {
    data: {
      message: message,
      documentation_url: documentation_url || `https://docs.github.com/rest/overview/resources-in-the-rest-api#${status}-error`
    },
    headers: {
      'x-github-request-id': 'TEST-123',
      ...headers
    }
  };

  if (required_scopes) {
    (error as any).details = {
      required_scopes
    };
  }

  return error;
};

export const createRateLimitError = (resetTime = '1609459200') => 
  createGitHubError({
    message: 'API rate limit exceeded',
    status: 403,
    headers: {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': resetTime
    }
  });

export const createAuthError = () =>
  createGitHubError({
    message: 'Bad credentials',
    status: 401
  });

export const createScopeError = (scopes: string[]) =>
  createGitHubError({
    message: 'Requires additional scopes',
    status: 403,
    required_scopes: scopes
  });

// Error validation helpers
export const expectRateLimitError = (error: any) => {
  expect(error.status).toBe(403);
  expect(error.response.data.message).toContain('rate limit');
  expect(error.response.headers['x-ratelimit-remaining']).toBeDefined();
  expect(error.response.headers['x-ratelimit-reset']).toBeDefined();
};

export const expectAuthError = (error: any) => {
  expect(error.status).toBe(401);
  expect(error.response.data.message).toBe('Bad credentials');
};

export const expectScopeError = (error: any, requiredScopes: string[]) => {
  expect(error.status).toBe(403);
  expect(error.details.required_scopes).toEqual(requiredScopes);
};