# GitHub Manager MCP Development Guide

## Memory Bank Integration

This project uses Memory Bank documentation as the source of truth. Before starting development:

1. Read all Memory Bank files in `cline_docs/`:
   - `productContext.md` - Project purpose and goals
   - `activeContext.md` - Current work and next steps
   - `systemPatterns.md` - Architecture and patterns
   - `techContext.md` - Technical requirements
   - `progress.md` - Project status

2. Update Memory Bank files when:
   - Starting new work
   - Making significant changes
   - Completing features
   - Updating documentation

## Quick Start

### Prerequisites
- Node.js >= 18
- GitHub token with scopes: `read:org`, `repo`, `admin:org`
- MCP SDK

### Setup
```bash
# Install dependencies
npm install

# Build project
npm run build

# Run server
node build/index.js
```

## Project Structure

### Core Components
- `src/index.ts` - Server entry point and tool definitions
- `src/github/` - GitHub API integration
- `src/tools/` - MCP tool implementations
- `src/utils/` - Shared utilities and helpers

### Documentation
- `cline_docs/` - Memory Bank documentation (source of truth)
  - `productContext.md` - Project purpose and goals
  - `activeContext.md` - Current work and next steps
  - `systemPatterns.md` - Architecture and patterns
  - `techContext.md` - Technical requirements
  - `progress.md` - Project status
- `DEVELOPMENT.md` - Development guide (this file)
- `README.md` - Project overview
- `LICENSE` - License information

## Development Workflow

### 1. Environment Setup
```bash
# Set GitHub token
export GITHUB_TOKEN=your_token_here

# Verify setup
node --version  # Should be >= 18
echo $GITHUB_TOKEN  # Should show token
```

### 2. Development Process
1. Review Memory Bank documentation
2. Update activeContext.md with planned changes
3. Follow Test Driven Development (TDD)
   - Focus on feature development
   - Balance coverage with progress
   - Prioritize critical path testing
4. Update documentation
5. Submit PR with tests

### 3. Testing Strategy

As defined in systemPatterns.md:

#### Unit Tests
- Tool handler logic
- Parameter validation
- Error handling
- Response formatting

#### Integration Tests
- GitHub API interaction
- Authentication flow
- Error propagation
- Response processing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Error Handling

### Response Format
```typescript
{
  content: [{
    type: "text",
    text: string | {
      error?: string,
      code?: string,
      details?: object
    }
  }],
  isError?: boolean
}
```

### Error Handling Patterns
Following systemPatterns.md:
1. Standardized error responses
2. Detailed error information
3. Proper error propagation
4. Context preservation

### Common Issues
1. Authentication
   - Check token scopes
   - Verify environment variables
   - Review auth logs

2. API Errors
   - Rate limiting
   - Permission issues
   - Invalid parameters

## Contributing

### Code Standards
- Use TypeScript strict mode
- Follow error handling patterns
- Include comprehensive logging
- Add JSDoc comments

### Pull Request Process
1. Review Memory Bank documentation
2. Update activeContext.md
3. Implement changes following TDD
4. Update relevant Memory Bank files
5. Include tests and documentation
6. Submit PR

## Resources
- [Memory Bank Documentation](./cline_docs/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [GitHub API Documentation](https://docs.github.com/rest)
