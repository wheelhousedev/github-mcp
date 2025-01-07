# Contributing to GitHub Manager MCP Server

## Development Setup

1. Prerequisites
   - Node.js >= 18 (for native fetch support)
   - npm
   - GitHub account with appropriate access tokens

2. Installation
   ```bash
   git clone <repository-url>
   cd github-manager
   npm install
   ```

3. Environment Setup
   - Copy `.env.example` to `.env`
   - Add your GitHub token with required scopes:
     - `read:org`
     - `repo`
     - `admin:org`

## Development Patterns

### Code Organization
- `src/` - Source code
  - `index.ts` - Main server implementation
  - `utils/` - Utility functions and helpers
- `test/` - Test files
  - `unit/` - Unit tests
  - `integration/` - Integration tests
  - `fixtures/` - Test utilities and mocks

### Testing Strategy
1. Unit Tests
   - Test individual components in isolation
   - Mock external dependencies
   - Focus on edge cases and error handling

2. Integration Tests
   - Test complete workflows
   - Verify tool interactions
   - Test error recovery scenarios

3. Running Tests
   ```bash
   # Run all tests
   npm test

   # Run with coverage
   npm run test:coverage

   # Run specific test file
   npm test test/unit/GitHubManager.test.ts
   ```

### Error Handling
- Use the RequestHandler utility for consistent error handling
- Map errors to appropriate MCP error codes
- Include relevant context in error messages
- Log errors with appropriate detail level

### Logging
- Use the built-in logging system
- Include relevant context with each log
- Use appropriate log levels:
  - `debug` - Detailed debugging information
  - `info` - General operational information
  - `warn` - Warning messages
  - `error` - Error conditions

## Pull Request Process

1. Create a feature branch
2. Add/update tests as needed
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR with clear description

## Code Style

- Use TypeScript strict mode
- Follow existing patterns
- Include JSDoc comments for public APIs
- Use meaningful variable/function names

## Documentation

- Update API.md for tool changes
- Keep code comments current
- Include examples for new features

## Questions?

Feel free to open an issue for:
- Feature requests
- Bug reports
- Documentation improvements
- General questions
