# GitHub Manager MCP Server

## Overview

This MCP server provides tools for managing GitHub repositories and organizations through the Model Context Protocol (MCP). It wraps the GitHub REST API to provide standardized MCP tool interfaces.

## Configuration

The server requires a GitHub access token with appropriate scopes:
- `read:org` - For listing organizations
- `repo` - For repository operations
- `admin:org` - For organization management

Set the token in the MCP settings configuration:
```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/path/to/github-manager/build/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

## Tools

All tools follow standard MCP response formatting:
- Success responses include formatted JSON content
- Error responses include error code and details
- All operations are logged with appropriate context

### Available Tools

#### 1. list_orgs
Lists organizations the authenticated user belongs to.

**Parameters**: None required

**Response Format**:
```json
{
  "organizations": [
    {
      "login": "org-name",
      "id": 12345678,
      "url": "https://api.github.com/orgs/org-name",
      "description": "Organization description",
      "role": "member"
    }
  ]
}
```

**Example Usage**:
```typescript
const result = await use_mcp_tool({
  server_name: "github",
  tool_name: "list_orgs",
  arguments: {}
});
```

**See**: [GitHub API - List organizations](https://docs.github.com/en/rest/orgs/orgs#list-organizations-for-the-authenticated-user)

#### 2. list_repos
Lists repositories in an organization.

**Parameters**:
- `org` (string, required): Organization name

**Response Format**:
```json
{
  "repositories": [
    {
      "name": "repo-name",
      "full_name": "org-name/repo-name",
      "private": false,
      "description": "Repository description",
      "html_url": "https://github.com/org-name/repo-name",
      "visibility": "public"
    }
  ]
}
```

**Example Usage**:
```typescript
const result = await use_mcp_tool({
  server_name: "github",
  tool_name: "list_repos",
  arguments: {
    org: "my-organization"
  }
});
```

**See**: [GitHub API - List organization repositories](https://docs.github.com/en/rest/repos/repos#list-organization-repositories)

#### 3. create_repo
Creates a new repository in an organization.

**Parameters**:
- `org` (string, required): Organization name
- `name` (string, required): Repository name
- `description` (string, optional): Repository description
- `private` (boolean, optional): Whether the repository should be private. Defaults to false.

**Response Format**:
```json
{
  "name": "new-repo",
  "full_name": "org-name/new-repo",
  "private": false,
  "html_url": "https://github.com/org-name/new-repo",
  "clone_url": "https://github.com/org-name/new-repo.git",
  "visibility": "public"
}
```

**Example Usage**:
```typescript
const result = await use_mcp_tool({
  server_name: "github",
  tool_name: "create_repo",
  arguments: {
    org: "my-organization",
    name: "new-project",
    description: "A new project repository",
    private: true
  }
});
```

**See**: [GitHub API - Create an organization repository](https://docs.github.com/en/rest/repos/repos#create-an-organization-repository)

#### 4. add_collaborator
Adds a collaborator to a repository.

**Parameters**:
- `org` (string, required): Organization name
- `repo` (string, required): Repository name
- `username` (string, required): GitHub username to add
- `permission` (string, required): Permission level
  - Allowed values: "pull", "push", "admin", "maintain", "triage"

**Response Format**:
```json
{
  "id": 1234567,
  "repository": "org-name/repo-name",
  "invitee": "username",
  "permission": "push",
  "html_url": "https://github.com/org-name/repo-name/invitations"
}
```

**Example Usage**:
```typescript
const result = await use_mcp_tool({
  server_name: "github",
  tool_name: "add_collaborator",
  arguments: {
    org: "my-organization",
    repo: "project-repo",
    username: "collaborator",
    permission: "push"
  }
});
```

**See**: [GitHub API - Add a repository collaborator](https://docs.github.com/en/rest/collaborators/collaborators#add-a-repository-collaborator)

#### 5. update_repo_settings
Updates repository settings.

**Parameters**:
- `org` (string, required): Organization name
- `repo` (string, required): Repository name
- `settings` (object, required): Settings to update
  ```typescript
  {
    has_issues?: boolean;
    has_projects?: boolean;
    has_wiki?: boolean;
    allow_squash_merge?: boolean;
    allow_merge_commit?: boolean;
    allow_rebase_merge?: boolean;
    delete_branch_on_merge?: boolean;
  }
  ```

**Response Format**:
```json
{
  "name": "repo-name",
  "full_name": "org-name/repo-name",
  "settings_applied": {
    "has_issues": true,
    "has_projects": false
  }
}
```

**Example Usage**:
```typescript
const result = await use_mcp_tool({
  server_name: "github",
  tool_name: "update_repo_settings",
  arguments: {
    org: "my-organization",
    repo: "project-repo",
    settings: {
      has_issues: true,
      has_wiki: false,
      allow_squash_merge: true,
      delete_branch_on_merge: true
    }
  }
});
```

**See**: [GitHub API - Update a repository](https://docs.github.com/en/rest/repos/repos#update-a-repository)

## Error Handling

The server maps GitHub API errors to appropriate MCP error codes:

```typescript
ErrorCode.InternalError      // General GitHub API errors
ErrorCode.InvalidParams      // Missing or invalid parameters
ErrorCode.MethodNotFound     // Unknown tool requested
```

Error responses include:
- Error message with context
- MCP error code
- Original error details when available

### Common Error Scenarios

1. **Authentication Errors**
```json
{
  "error": {
    "code": "InternalError",
    "message": "GitHub API authentication failed",
    "details": "Bad credentials",
    "context": {
      "required_scopes": ["repo"],
      "provided_scopes": []
    }
  }
}
```

2. **Rate Limit Errors**
```json
{
  "error": {
    "code": "InternalError",
    "message": "GitHub API rate limit exceeded",
    "details": "Rate limit will reset at 2024-01-06T20:00:00Z",
    "context": {
      "rate": {
        "limit": 5000,
        "remaining": 0,
        "reset": 1704571200
      }
    }
  }
}
```

3. **Invalid Parameters**
```json
{
  "error": {
    "code": "InvalidParams",
    "message": "Missing required parameter: org",
    "details": "The organization name must be provided",
    "context": {
      "provided_params": ["repo", "username"],
      "missing_params": ["org"]
    }
  }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **Authentication Failed**
   - Verify your GitHub token is valid and not expired
   - Check that the token has the required scopes
   - Try generating a new token with the correct permissions

2. **Rate Limit Exceeded**
   - Wait until the rate limit reset time
   - Consider using a token with higher rate limits
   - Implement request throttling in your application

3. **Repository Not Found**
   - Verify the organization name is correct
   - Check that the repository exists
   - Ensure your token has access to the repository

4. **Permission Denied**
   - Verify your token has the required scopes
   - Check organization membership status
   - Request additional permissions if needed

### Best Practices

1. **Error Handling**
   - Always check for error responses
   - Handle rate limits gracefully
   - Implement exponential backoff for retries

2. **Performance**
   - Cache frequently accessed data
   - Batch operations when possible
   - Monitor rate limit usage

3. **Security**
   - Use the minimum required token scopes
   - Rotate tokens periodically
   - Never expose tokens in logs or responses

## Logging

All operations are logged with:
- Timestamp
- Operation context
- Success/failure status
- Relevant data/errors

Logs are:
- Stored in memory during server runtime
- Output to stderr
- Forwarded to MCP for error/warning levels

### Log Levels

```typescript
logger.debug('Starting operation', { params });     // Implementation details
logger.info('Operation complete', { result });      // Important operations
logger.warn('Rate limit low', { remaining });      // Potential issues
logger.error('Operation failed', { error });       // Operation failures
```

## References

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [GitHub API Rate Limits](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)
- [GitHub API Authentication](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#authentication)
