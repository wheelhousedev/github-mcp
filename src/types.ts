import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface GitHubErrorDetails {
  action: string;
  attempted_operation?: string;
  originalError: {
    status: number;
    response?: {
      data?: {
        message?: string;
        documentation_url?: string;
      };
      headers?: Record<string, string>;
    };
    headers?: Record<string, string>;
    message: string;
  };
  status?: number;
  requestId?: string;
  documentation?: string;
  required_scopes?: string[];
  current_scopes?: string[];
  organization?: string;
  rate_limit?: {
    remaining?: string;
    reset?: string;
  };
  repository?: {
    org: string;
    repo?: string;
    name?: string;
    description?: string;
    isPrivate?: boolean;
  };
  collaborator?: {
    org: string;
    repo: string;
    username: string;
    permission: 'pull' | 'push' | 'admin';
  };
  settings?: GitHubRepoSettings['settings'];
}

export interface GitHubError extends Error {
  code: ErrorCode;
  details: GitHubErrorDetails;
}

export interface GitHubApiError {
  status: number;
  response: {
    data: {
      message: string;
      documentation_url?: string;
    };
    headers: Record<string, string>;
  };
  message: string;
}

export interface GitHubApiResponse<T> {
  data: T;
  headers: {
    'x-ratelimit-remaining'?: string;
    'x-ratelimit-reset'?: string;
    'x-oauth-scopes'?: string;
    'x-github-request-id'?: string;
  };
}

export interface GitHubOrg {
  name: string;
  display_name: string;
  description?: string;
  url: string;
  membership: {
    is_member: boolean;
    is_visible: boolean;
  };
}

export interface GitHubRepo {
  name: string;
  description?: string;
  private: boolean;
  url: string;
  clone_url: string;
  html_url?: string;
  visibility?: string;
  created_at?: string;
}

export interface GitHubCollaborator {
  status: string;
  invitation_url: string;
  permissions?: {
    pull: boolean;
    push: boolean;
    admin: boolean;
  };
}

export interface GitHubRepoSettings {
  name: string;
  settings: {
    has_issues?: boolean;
    has_projects?: boolean;
    has_wiki?: boolean;
    allow_squash_merge?: boolean;
    allow_merge_commit?: boolean;
    allow_rebase_merge?: boolean;
  };
}

export interface LogMessage {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export interface GitHubAuthInfo {
  username: string;
  scopes: string[];
}

export interface GitHubService {
  verifyAuth(): Promise<GitHubAuthInfo>;
  listOrgs(): Promise<GitHubOrg[]>;
  listRepos(org: string): Promise<GitHubRepo[]>;
  createRepo(org: string, name: string, description?: string, isPrivate?: boolean): Promise<GitHubRepo>;
  addCollaborator(org: string, repo: string, username: string, permission: 'pull' | 'push' | 'admin'): Promise<GitHubCollaborator>;
  updateRepoSettings(org: string, repo: string, settings: GitHubRepoSettings['settings']): Promise<GitHubRepoSettings>;
}
