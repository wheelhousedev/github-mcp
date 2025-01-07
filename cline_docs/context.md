# Project Context

## Purpose & Goals
The GitHub Manager MCP server provides a bridge between Cline and GitHub's API, enabling Cline to perform GitHub operations directly through MCP tools. This integration allows Cline to manage GitHub repositories, organizations, and collaborators programmatically.

## Problems Solved
1. Provides a standardized interface for GitHub operations through MCP
2. Handles GitHub API authentication and request management
3. Enables automated GitHub repository management
4. Simplifies organization and collaborator management
5. Handles rate limiting and error recovery scenarios
6. Manages API permissions and scopes

## Current Architecture
- Modular service-based design
- Each GitHub operation in its own service
- Centralized authentication and error handling
- Clear separation of concerns

## Technologies Used
1. Core Technologies
   - Node.js: Runtime environment
   - TypeScript: Programming language
   - @modelcontextprotocol/sdk: MCP server implementation
   - @octokit/rest: GitHub API client

2. Testing Technologies
   - Vitest: Testing framework
   - @vitest/coverage-v8: Code coverage
   - Vi.mock: Mocking system

## Development Setup
1. Project Configuration
   - TypeScript configuration in tsconfig.json
   - Vitest configuration in vitest.config.ts
   - Package.json scripts:
     * build: Compiles TypeScript and sets permissions
     * test: Runs test suite
     * test:watch: Runs tests in watch mode
     * test:coverage: Runs tests with coverage
     * test:ui: Runs tests with UI

2. Environment Requirements
   - GITHUB_TOKEN: Required for GitHub API authentication
     * Must have appropriate scopes:
       - read:org
       - repo
     * Used for all GitHub API operations

## Available Tools
1. list_orgs
   - Lists GitHub organizations the authenticated user belongs to
   - Handles both user organizations and memberships
   - Includes debug information about user and server state

2. list_repos
   - Lists repositories in a specified organization
   - Requires organization name
   - Returns repository details including name, description, and visibility

3. create_repo
   - Creates a new repository in an organization
   - Required parameters: org, name
   - Optional parameters: description, private
   - Returns repository details and URLs

4. add_collaborator
   - Adds a collaborator to a repository
   - Required parameters: org, repo, username, permission
   - Supports different permission levels (pull, push, admin)
   - Returns invitation status and URL

5. update_repo_settings
   - Updates repository settings
   - Required parameters: org, repo, settings
   - Configurable settings include:
     * Issues, Projects, Wiki features
     * Merge strategies (squash, merge commit, rebase)

## Current Status & Next Steps

### Implementation Status
- Base service infrastructure complete
- First modular service (ListOrgsService) implemented
- Unit test structure and patterns established
- Documentation framework in place
- User-focused error handling implemented

### In Progress
- Converting remaining operations to modular services
- Updating integration tests
- Improving error handling patterns

### Current Issues
- Integration tests still using old monolithic approach
- Some operations not yet converted to modular pattern
- Error handling needs standardization across services

### Next Actions
1. Convert remaining GitHub operations to modular services
2. Update integration tests to match new architecture
3. Implement improved error handling
4. Add comprehensive documentation

## Technical Constraints
1. MCP Protocol Requirements
   - Must follow MCP server protocol
   - Tool-based interface
   - Specific response formats
   - Error handling patterns

2. GitHub API Limitations
   - Rate limits
   - Authentication requirements
   - API version compatibility
   - Response structure requirements

3. Testing Constraints
   - Mock server limitations
   - API simulation requirements
   - Environment isolation needs
   - Coverage requirements

4. Security Considerations
   - Token management
   - Permission scopes
   - API access control
   - Error message safety
