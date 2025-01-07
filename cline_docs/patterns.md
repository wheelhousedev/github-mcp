# Code Patterns & Conventions

## Core Architecture

### Service Layer Pattern
Each GitHub operation is implemented as a separate service class following a consistent pattern:

```typescript
// 1. Define interface
interface ServiceOperation<Input, Output> {
  execute(params: Input): Promise<Output>;
}

// 2. Base service with common functionality
abstract class BaseGitHubService {
  protected constructor(
    protected octokit: Octokit,
    protected authService: GitHubAuthService,
    protected logger: Logger
  ) {}
  
  protected async verifyAccess(requiredScopes: string[]): Promise<void>;
  protected handleError(error: any, context: Record<string, any>);
  protected getRateLimitInfo(headers: Record<string, string>);
  protected logOperation(operation: string, params: Record<string, any>);
}

// 3. Focused service implementation
class SpecificService extends BaseGitHubService implements ServiceOperation<Input, Output> {
  async execute(params: Input): Promise<Output> {
    try {
      await this.verifyAccess(['required:scope']);
      // Implementation
      return result;
    } catch (error) {
      return this.handleError(error, { params });
    }
  }
}
```

### Directory Structure
```
src/
  ├── services/
  │   ├── auth/           # Authentication services
  │   ├── organizations/  # Organization operations
  │   ├── repositories/   # Repository operations
  │   ├── collaborators/  # Collaborator operations
  │   ├── error/         # Error utilities
  │   └── base/          # Base classes
  └── types.ts           # Type definitions

test/
  ├── unit/
  │   └── services/      # Unit tests matching src structure
  ├── integration/       # End-to-end API tests
  └── fixtures/         # Shared test utilities and mocks
```

## Testing Approach

### Unit Test Structure
```typescript
describe('ServiceName', () => {
  // 1. Setup
  beforeEach(() => {
    mockDependencies();
    createService();
  });

  // 2. Happy path
  it('should complete operation successfully', async () => {
    // Given
    mockSuccessResponses();

    // When
    const result = await service.execute(validInput);

    // Then
    expect(result).toMatchExpectedOutput();
    verifyDependenciesCalled();
  });

  // 3. Error cases
  it('should handle specific error condition', async () => {
    // Given
    mockErrorCondition();

    // When/Then
    await expect(service.execute(input))
      .rejects
      .toThrow(expectedError);
  });
});
```

### Mock Patterns
```typescript
// 1. Type your mocks
type MockDependencies = {
  methodName: Mock<[input: InputType], Promise<OutputType>>;
};

// 2. Create typed mock instance
const mockDependency = {
  methodName: vi.fn()
} satisfies MockDependencies;

// 3. Use in tests
mockDependency.methodName.mockResolvedValue(expectedOutput);

// 4. Example GitHub API mock
type MockOctokit = {
  orgs: {
    listForAuthenticatedUser: Mock;
    list: Mock;
  };
};

const mockOctokit = {
  orgs: {
    listForAuthenticatedUser: vi.fn(),
    list: vi.fn()
  }
} as unknown as MockOctokit & Octokit;
```

### Response Transformation Pattern
```typescript
// 1. Define response interface
interface GitHubApiResponse {
  data: any;
  headers: Record<string, string>;
}

// 2. Transform in service
protected transformResponse(response: GitHubApiResponse): Output {
  const { data, headers } = response;
  
  // Include rate limit info
  const rateLimit = this.getRateLimitInfo(headers);
  
  // Transform data to match expected output
  const transformed = {
    ...this.mapApiResponse(data),
    rate_limit: rateLimit
  };
  
  return transformed;
}

// 3. Map specific fields
protected mapApiResponse(data: any): Partial<Output> {
  return {
    id: data.id,
    name: data.name,
    // Map other fields...
  };
}
```

### Integration Tests
Focus on complete workflows:
```typescript
describe('GitHub Operation Flow', () => {
  it('should complete full operation', async () => {
    // 1. Setup
    const input = validInput();
    
    // 2. Execute flow
    const auth = await authService.verify();
    const result = await operationService.execute(input);
    
    // 3. Verify
    expect(result).toMatchExpectedState();
  });
});
```

## Error Handling

### Pattern
```typescript
try {
  await operation();
} catch (error) {
  throw createGitHubError({
    message: 'Operation failed',
    code: determineErrorCode(error),
    error,
    context: {
      operation: 'operation_name',
      input: sanitizeInput(input),
      attempted_action: 'specific_action'
    }
  });
}
```

### Rate Limit Error Pattern
```typescript
// 1. Check rate limit before operation
protected async checkRateLimit(): Promise<void> {
  const limits = await this.getRateLimits();
  if (limits.remaining < 1) {
    throw new RateLimitError({
      message: 'Rate limit exceeded',
      resetTime: limits.reset,
      limit: limits.limit,
      remaining: limits.remaining
    });
  }
}

// 2. Handle rate limit errors
protected handleRateLimitError(error: RateLimitError): never {
  throw createGitHubError({
    message: `Rate limit exceeded. Resets at ${error.resetTime}`,
    code: ErrorCode.RateLimit,
    error,
    context: {
      limit: error.limit,
      remaining: error.remaining,
      reset_time: error.resetTime
    }
  });
}
```

### Error Categories
1. Authentication
   - Token invalid/expired
   - Missing required scopes
   - Rate limits

2. Validation
   - Invalid input
   - Missing required fields
   - Invalid state

3. API
   - GitHub API errors
   - Network issues
   - Rate limits

4. System
   - Internal errors
   - Configuration issues
   - State errors

## Logging

### Levels
```typescript
// Debug: Implementation details
logger.debug('Starting operation', { input });

// Info: Important operations
logger.info('Operation complete', { result });

// Warn: Potential issues
logger.warn('Approaching rate limit', { remaining });

// Error: Operation failures
logger.error('Operation failed', { error, context });
```

### Context
Always include relevant context:
```typescript
{
  operation: 'operation_name',
  input: sanitizedInput,
  result?: operationResult,
  error?: {
    message: error.message,
    code: error.code,
    stack: error.stack
  },
  timing: {
    started_at: startTime,
    duration: endTime - startTime
  }
}
```

## Development Workflow

1. Create Service
   - Extend BaseGitHubService
   - Implement ServiceOperation interface
   - Add proper error handling
   - Include comprehensive logging

2. Create Tests
   - Unit tests for service
   - Integration tests for workflows
   - Error case coverage
   - Mock patterns

3. Documentation
   - JSDoc comments
   - Usage examples
   - Error handling guide
   - Update patterns doc

4. Review
   - Type safety
   - Error handling
   - Test coverage
   - Documentation

## Troubleshooting Guide

### Common Issues
1. Authentication failures
   - Check token validity and scopes
   - Verify auth service is properly configured
   - Review error logs for auth context

2. Rate limiting
   - Monitor rate limit headers
   - Implement retry logic if needed
   - Consider token rotation for high-volume operations

3. Test failures
   - Verify mock implementations match real API
   - Check error handling coverage
   - Ensure proper typing of mocks and responses

### Best Practices
1. Always verify auth and scopes before API calls
2. Use proper error context for debugging
3. Keep services focused and minimal
4. Test both success and error paths
5. Document new patterns and improvements
6. Transform responses consistently
7. Handle rate limits proactively
8. Validate input thoroughly
9. Log meaningful context
10. Keep error messages actionable
