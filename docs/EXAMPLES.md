# GitHub Manager Usage Examples

This document provides real-world examples of using the GitHub Manager MCP tools for common workflows and scenarios.

## Organization Management Workflows

### 1. Setting Up a New Project Repository

This example demonstrates creating a new repository and configuring it with best practices:

```typescript
// 1. Create the repository
const repo = await use_mcp_tool({
  server_name: "github",
  tool_name: "create_repo",
  arguments: {
    org: "my-organization",
    name: "new-service",
    description: "Microservice for handling user notifications",
    private: true
  }
});

// 2. Configure repository settings
await use_mcp_tool({
  server_name: "github",
  tool_name: "update_repo_settings",
  arguments: {
    org: "my-organization",
    repo: "new-service",
    settings: {
      has_issues: true,
      has_projects: true,
      has_wiki: true,
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: true,
      delete_branch_on_merge: true
    }
  }
});

// 3. Add team members
const developers = ["dev1", "dev2", "dev3"];
for (const dev of developers) {
  await use_mcp_tool({
    server_name: "github",
    tool_name: "add_collaborator",
    arguments: {
      org: "my-organization",
      repo: "new-service",
      username: dev,
      permission: "push"
    }
  });
}
```

### 2. Repository Audit

This example shows how to audit repository settings across an organization:

```typescript
// 1. List all repositories
const { repositories } = await use_mcp_tool({
  server_name: "github",
  tool_name: "list_repos",
  arguments: {
    org: "my-organization"
  }
});

// 2. Check settings for each repository
for (const repo of repositories) {
  // Update settings to enforce security policies
  await use_mcp_tool({
    server_name: "github",
    tool_name: "update_repo_settings",
    arguments: {
      org: "my-organization",
      repo: repo.name,
      settings: {
        // Enforce branch protection
        allow_squash_merge: true,
        allow_merge_commit: false,
        delete_branch_on_merge: true
      }
    }
  });
}
```

## Team Management Scenarios

### 1. Onboarding New Team Members

This example demonstrates adding a new developer to multiple repositories:

```typescript
// 1. List all repositories
const { repositories } = await use_mcp_tool({
  server_name: "github",
  tool_name: "list_repos",
  arguments: {
    org: "my-organization"
  }
});

// 2. Add new team member to relevant repositories
const newDeveloper = "new-hire";
const relevantRepos = repositories.filter(repo => 
  repo.name.startsWith("team-") || repo.name.startsWith("shared-")
);

for (const repo of relevantRepos) {
  await use_mcp_tool({
    server_name: "github",
    tool_name: "add_collaborator",
    arguments: {
      org: "my-organization",
      repo: repo.name,
      username: newDeveloper,
      permission: "push"
    }
  });
}
```

### 2. Managing Access Levels

This example shows managing different access levels for different team roles:

```typescript
const teamRoles = {
  admin: ["tech-lead", "senior-dev"],
  maintain: ["team-lead"],
  push: ["developer1", "developer2"],
  triage: ["qa-team", "support-team"]
};

for (const [permission, users] of Object.entries(teamRoles)) {
  for (const user of users) {
    await use_mcp_tool({
      server_name: "github",
      tool_name: "add_collaborator",
      arguments: {
        org: "my-organization",
        repo: "main-service",
        username: user,
        permission
      }
    });
  }
}
```

## Error Recovery Scenarios

### 1. Handling Rate Limits

This example shows how to handle rate limit errors gracefully:

```typescript
async function withRateLimitRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "InternalError" && error.details?.includes("rate limit")) {
      const resetTime = new Date(error.context.rate.reset * 1000);
      console.log(`Rate limit exceeded. Waiting until ${resetTime}`);
      
      // Wait until rate limit resets
      const waitMs = (resetTime - new Date()) + 1000; // Add 1s buffer
      await new Promise(resolve => setTimeout(resolve, waitMs));
      
      // Retry operation
      return await operation();
    }
    throw error;
  }
}

// Usage example
await withRateLimitRetry(async () => {
  return await use_mcp_tool({
    server_name: "github",
    tool_name: "list_repos",
    arguments: { org: "my-organization" }
  });
});
```

### 2. Handling Authentication Issues

This example demonstrates recovering from authentication errors:

```typescript
async function withAuthRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "InternalError" && error.details?.includes("Bad credentials")) {
      console.error("Authentication failed. Please check:");
      console.error("1. Token validity");
      console.error("2. Required scopes:", error.context.required_scopes);
      console.error("3. Provided scopes:", error.context.provided_scopes);
      
      throw new Error("Authentication failed - please update token with required scopes");
    }
    throw error;
  }
}

// Usage example
await withAuthRetry(async () => {
  return await use_mcp_tool({
    server_name: "github",
    tool_name: "create_repo",
    arguments: {
      org: "my-organization",
      name: "new-repo",
      private: true
    }
  });
});
```

## Automation Tasks

### 1. Repository Cleanup

This example shows automating repository maintenance:

```typescript
// List all repositories
const { repositories } = await use_mcp_tool({
  server_name: "github",
  tool_name: "list_repos",
  arguments: {
    org: "my-organization"
  }
});

// Update settings for archived/inactive repositories
const inactiveRepos = repositories.filter(repo => 
  repo.archived || 
  new Date(repo.updated_at) < new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
);

for (const repo of inactiveRepos) {
  await use_mcp_tool({
    server_name: "github",
    tool_name: "update_repo_settings",
    arguments: {
      org: "my-organization",
      repo: repo.name,
      settings: {
        // Disable features for inactive repos
        has_issues: false,
        has_projects: false,
        has_wiki: false
      }
    }
  });
}
```

### 2. Bulk Repository Updates

This example demonstrates updating multiple repositories with consistent settings:

```typescript
const standardSettings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: true,
  delete_branch_on_merge: true,
  has_issues: true,
  has_projects: true
};

// List all active repositories
const { repositories } = await use_mcp_tool({
  server_name: "github",
  tool_name: "list_repos",
  arguments: {
    org: "my-organization"
  }
});

const activeRepos = repositories.filter(repo => !repo.archived);

// Apply standard settings to all active repos
for (const repo of activeRepos) {
  await use_mcp_tool({
    server_name: "github",
    tool_name: "update_repo_settings",
    arguments: {
      org: "my-organization",
      repo: repo.name,
      settings: standardSettings
    }
  });
}
```

## Best Practices

1. **Error Handling**
   - Always implement retry logic for rate limits
   - Handle authentication errors gracefully
   - Validate inputs before making API calls
   - Log errors with appropriate context

2. **Performance**
   - Batch operations when possible
   - Cache frequently accessed data
   - Monitor rate limit usage
   - Use appropriate scopes for tokens

3. **Security**
   - Review access levels regularly
   - Remove unused collaborators
   - Audit repository settings
   - Keep tokens secure and rotate regularly

4. **Maintenance**
   - Document automation workflows
   - Keep settings consistent across repositories
   - Regular audits of access and settings
   - Clean up inactive repositories