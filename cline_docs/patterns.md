# Code Patterns & Conventions

## Testing Approach
- Unit tests are organized by service type
- Each service has its own test file
- Tests are written in TypeScript and compiled to JavaScript
- Legacy tests should be removed from both source and build directories
- Test coverage excludes build directory and test files

## Test Maintenance
1. When removing tests:
   - Delete source test files from test/ directory
   - Remove compiled test files from build/test/ directory
   - Verify test suite runs cleanly after removal
2. Keep test files focused on specific services
3. Avoid generic manager-level tests in favor of service-specific tests

## GitHub API Error Handling Patterns

### Error Simulation Approach
1. Centralized error factories in test/fixtures/utils/errors.ts
2. Consistent error structure across all services
3. Comprehensive error context including:
   - Error type
   - Status code
   - Rate limit information
   - Debugging details

### Common Error Types
1. Rate limit errors
   - Simulates GitHub API rate limiting
   - Includes rate limit headers
   - Provides reset time information
2. Authentication errors
   - Simulates invalid credentials
   - Includes required scopes when applicable
3. Network errors
   - Simulates connection failures
   - Includes error codes and messages
4. Not found errors
   - Simulates missing resources
   - Includes resource identification
5. Validation errors
   - Simulates invalid input
   - Includes detailed validation messages

### Error Handling Patterns
1. Consistent error wrapping using McpError
2. Detailed error context including:
   - Action being performed
   - Attempted operation
   - Relevant resource information
3. Comprehensive logging of error details
4. Type-safe error creation

### Best Practices for Error Testing
1. Test all expected error scenarios
2. Verify error context is complete and accurate
3. Ensure consistent error handling across services
4. Validate error logging includes necessary details
5. Maintain type safety throughout error handling
