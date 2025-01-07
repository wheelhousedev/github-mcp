import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { GitHubError } from '../../types.js';

interface ErrorParams {
  message: string;
  code: ErrorCode;
  error: any;
  context: {
    action: string;
    attempted_operation?: string;
    [key: string]: any;
  };
}

export function createGitHubError({ message, code, error, context }: ErrorParams): GitHubError {
  const gitHubError = new Error(message) as GitHubError;
  
  gitHubError.code = code;
  gitHubError.details = {
    action: context.action,
    ...context.attempted_operation && { attempted_operation: context.attempted_operation },
    originalError: {
      status: error.status,
      message: error.message,
      response: error.response && {
        data: error.response.data,
        headers: error.response.headers
      },
      headers: error.headers
    }
  };

  // Add rate limit information if present
  if (error.status === 403 && error.response?.data?.message?.toLowerCase().includes('rate limit')) {
    gitHubError.details.rate_limit = {
      remaining: error.response.headers?.['x-ratelimit-remaining'],
      reset: error.response.headers?.['x-ratelimit-reset']
    };
  }

  // Add additional context
  if (context) {
    const { action, attempted_operation, ...rest } = context;
    
    // Add known properties from context
    if (rest.required_scopes) gitHubError.details.required_scopes = rest.required_scopes;
    if (rest.current_scopes) gitHubError.details.current_scopes = rest.current_scopes;
    if (rest.organization) gitHubError.details.organization = rest.organization;
    if (rest.repository) gitHubError.details.repository = rest.repository;
    if (rest.collaborator) gitHubError.details.collaborator = rest.collaborator;
    if (rest.settings) gitHubError.details.settings = rest.settings;
  }

  // Add request and documentation info
  if (error.response) {
    gitHubError.details.requestId = error.response.headers?.['x-github-request-id'];
    gitHubError.details.documentation = error.response.data?.documentation_url;
  }

  return gitHubError;
}

export function createValidationError(message: string, context: { action: string; [key: string]: any }): GitHubError {
  const error = new Error(message) as GitHubError;
  error.code = ErrorCode.InternalError;
  const { action, ...rest } = context;
  error.details = {
    action,
    originalError: {
      status: 400,
      message: message,
      response: undefined,
      headers: undefined
    },
    ...rest
  };
  return error;
}

export function isRateLimitError(error: any): boolean {
  return error.status === 403 && error.response?.data?.message?.includes('rate limit');
}

export function getErrorHelp(error: any): string | undefined {
  // Rate limit error help
  if (isRateLimitError(error)) {
    const resetTime = error.response?.headers?.['x-ratelimit-reset'];
    const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toLocaleString() : 'unknown time';
    return `Rate limit exceeded. You can try again after ${resetDate}. Consider using a token with higher rate limits.`;
  }

  // Scope/permission error help
  if (error.details?.required_scopes) {
    return `Token needs additional permissions: ${error.details.required_scopes.join(', ')}. Update token scopes in GitHub settings.`;
  }

  // Authentication error help
  if (error.status === 401) {
    return 'Invalid GitHub token. Please check your token and ensure it has the necessary permissions.';
  }

  // Return documentation URL if available
  if (error.response?.data?.documentation_url) {
    return `For more information, see: ${error.response.data.documentation_url}`;
  }

  return undefined;
}
