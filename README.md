# GitHub Manager MCP Server

A Model Context Protocol server for GitHub management

This TypeScript-based MCP server provides tools for managing GitHub organizations, repositories, and collaborators through the GitHub API.

## Features

### GitHub Management Tools
- `list_orgs`: List GitHub organizations the authenticated user belongs to
- `list_repos`: List repositories in a specified organization
- `create_repo`: Create a new repository in an organization
- `add_collaborator`: Add a collaborator to a repository
- `update_repo_settings`: Update repository settings

## Development

### Installation
```bash
npm install
```

### Build
```bash
npm run build
```

### Development with Auto-rebuild
```bash
npm run watch
```

### Testing
Run unit tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Configuration

### Environment Variables
- `GITHUB_TOKEN`: GitHub personal access token with required scopes

### MCP Server Installation
To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-manager": {
      "command": "/path/to/github-manager/build/index.js",
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

## Debugging

We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
