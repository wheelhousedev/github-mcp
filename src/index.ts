#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { McpLogger } from './services/logger.js';
import { GitHubAuthService } from './services/auth/GitHubAuthService.js';
import { ListOrgsService } from './services/organizations/ListOrgsService.js';
import { ListReposService, ListReposInput } from './services/repositories/ListReposService.js';
import { CreateRepoService, CreateRepoInput } from './services/repositories/CreateRepoService.js';
import { AddCollaboratorService, AddCollaboratorInput } from './services/collaborators/AddCollaboratorService.js';
import { UpdateRepoSettingsService, UpdateRepoSettingsInput } from './services/repositories/UpdateRepoSettingsService.js';
import { GitHubRepoSettings } from './types.js';
import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';

export class GitHubManager {
  private server: Server;
  private logger: McpLogger;
  private octokit: Octokit;
  private authService: GitHubAuthService;
  private initialized = false;

  // Service instances
  private listOrgsService: ListOrgsService;
  private listReposService: ListReposService;
  private createRepoService: CreateRepoService;
  private addCollaboratorService: AddCollaboratorService;
  private updateRepoSettingsService: UpdateRepoSettingsService;

  constructor() {
    // Initialize logger first
    this.logger = new McpLogger();
    this.logger.info('Starting GitHub Manager initialization');

    // Get GitHub token
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      this.logger.error('GITHUB_TOKEN environment variable is required');
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    // Initialize server
    this.server = new Server(
      {
        name: 'github-manager',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Update logger with server reference
    this.logger.setServer(this.server);

    // Initialize Octokit and auth service
    this.octokit = new Octokit({
      auth: token,
      request: {
        fetch: fetch as any
      }
    });
    this.authService = new GitHubAuthService(this.octokit);

    // Initialize services
    this.listOrgsService = new ListOrgsService(this.octokit, this.authService, this.logger);
    this.listReposService = new ListReposService(this.octokit, this.authService, this.logger);
    this.createRepoService = new CreateRepoService(this.octokit, this.authService, this.logger);
    this.addCollaboratorService = new AddCollaboratorService(this.octokit, this.authService, this.logger);
    this.updateRepoSettingsService = new UpdateRepoSettingsService(this.octokit, this.authService, this.logger);

    // Set up tool handlers
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // Register tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_orgs',
          description: 'List GitHub organizations the authenticated user belongs to',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'list_repos',
          description: 'List repositories in an organization',
          inputSchema: {
            type: 'object',
            properties: {
              org: {
                type: 'string',
                description: 'Organization name',
              },
            },
            required: ['org'],
          },
        },
        {
          name: 'create_repo',
          description: 'Create a new repository in an organization',
          inputSchema: {
            type: 'object',
            properties: {
              org: {
                type: 'string',
                description: 'Organization name',
              },
              name: {
                type: 'string',
                description: 'Repository name',
              },
              description: {
                type: 'string',
                description: 'Repository description',
              },
              private: {
                type: 'boolean',
                description: 'Whether the repository should be private',
              },
            },
            required: ['org', 'name'],
          },
        },
        {
          name: 'add_collaborator',
          description: 'Add a collaborator to a repository',
          inputSchema: {
            type: 'object',
            properties: {
              org: {
                type: 'string',
                description: 'Organization name',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              username: {
                type: 'string',
                description: 'GitHub username to add',
              },
              permission: {
                type: 'string',
                description: 'Permission level (pull, push, admin)',
                enum: ['pull', 'push', 'admin'],
              },
            },
            required: ['org', 'repo', 'username', 'permission'],
          },
        },
        {
          name: 'update_repo_settings',
          description: 'Update repository settings',
          inputSchema: {
            type: 'object',
            properties: {
              org: {
                type: 'string',
                description: 'Organization name',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              settings: {
                type: 'object',
                description: 'Repository settings to update',
                properties: {
                  has_issues: {
                    type: 'boolean',
                    description: 'Enable issues',
                  },
                  has_projects: {
                    type: 'boolean',
                    description: 'Enable projects',
                  },
                  has_wiki: {
                    type: 'boolean',
                    description: 'Enable wiki',
                  },
                  allow_squash_merge: {
                    type: 'boolean',
                    description: 'Allow squash merging',
                  },
                  allow_merge_commit: {
                    type: 'boolean',
                    description: 'Allow merge commits',
                  },
                  allow_rebase_merge: {
                    type: 'boolean',
                    description: 'Allow rebase merging',
                  },
                },
              },
            },
            required: ['org', 'repo', 'settings'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        await this.ensureInitialized();

        switch (request.params.name) {
          case 'list_orgs': {
            const result = await this.listOrgsService.execute();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'list_repos': {
            if (!request.params.arguments) {
              throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
            }
            const args = request.params.arguments as Record<string, unknown>;
            const input: ListReposInput = {
              org: args.org as string
            };
            const result = await this.listReposService.execute(input);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'create_repo': {
            if (!request.params.arguments) {
              throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
            }
            const args = request.params.arguments as Record<string, unknown>;
            const input: CreateRepoInput = {
              org: args.org as string,
              name: args.name as string,
              description: args.description as string | undefined,
              private: args.private as boolean | undefined
            };
            const result = await this.createRepoService.execute(input);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'add_collaborator': {
            if (!request.params.arguments) {
              throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
            }
            const args = request.params.arguments as Record<string, unknown>;
            const input: AddCollaboratorInput = {
              org: args.org as string,
              repo: args.repo as string,
              username: args.username as string,
              permission: args.permission as 'pull' | 'push' | 'admin'
            };
            const result = await this.addCollaboratorService.execute(input);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'update_repo_settings': {
            if (!request.params.arguments) {
              throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
            }
            const args = request.params.arguments as Record<string, unknown>;
            const input: UpdateRepoSettingsInput = {
              org: args.org as string,
              repo: args.repo as string,
              settings: args.settings as GitHubRepoSettings['settings']
            };
            const result = await this.updateRepoSettingsService.execute(input);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        // Format error response
        const errorResponse = {
          error: error.message,
          code: error.code || ErrorCode.InternalError,
          details: error.details || {
            originalError: {
              status: error.status,
              message: error.message,
              response: error.response
            }
          }
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2)
          }],
          isError: true
        };
      }
    });
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      this.logger.info('Connecting transport');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('Transport connected successfully');

      await this.authService.verifyAuth();
      this.initialized = true;
      this.logger.info('GitHub Manager initialized successfully');
    } catch (error: any) {
      this.logger.error('Initialization failed', error);
      throw new McpError(
        ErrorCode.InternalError,
        'Unable to authenticate',
        {
          details: {
            originalError: {
              status: error.status || 401,
              message: error.message || 'Bad credentials'
            }
          }
        }
      );
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      this.logger.warn('Server not initialized, attempting initialization');
      await this.initialize();
    }
  }

  async run() {
    try {
      await this.initialize();
      this.logger.info('GitHub Manager MCP server running');
    } catch (error) {
      this.logger.error('Fatal error during startup', error);
      throw error;
    }
  }
}

// Startup with error handling
const manager = new GitHubManager();
manager.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
