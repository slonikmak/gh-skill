import { GitHubProject, GitHubProjectColumn, GitHubIssue, CreateIssueParams, MoveIssueParams, GitHubProjectItem, UpdateIssueParams, AddCommentParams, AddProjectItemParams } from './types';
/**
 * Client for interacting with GitHub Projects (V2) and Issues.
 * Supports authentication via GitHub App or Personal Access Token.
 */
export declare class GitHubClient {
    private token?;
    private graphqlClient;
    constructor(token?: string | undefined);
    /**
     * Initializes or returns the authenticated GraphQL client.
     */
    private getClient;
    /**
     * Get a project by owner (user or org) and project number.
     * Robust implementation that tries Organization first, then User.
     */
    getProject(owner: string, number: number): Promise<GitHubProject | null>;
    /**
     * Get project columns (Status field options).
     */
    getProjectColumns(projectId: string, statusFieldName?: string): Promise<GitHubProjectColumn[]>;
    /**
     * Create a new issue in a repository.
     */
    createIssue(params: CreateIssueParams): Promise<GitHubIssue>;
    /**
     * Update an issue's title or body.
     */
    updateIssue(params: UpdateIssueParams): Promise<void>;
    /**
     * Move a project item to a different status column.
     */
    moveIssue(params: MoveIssueParams): Promise<void>;
    /**
     * Get all items (Issues/PRs) in a project.
     */
    getProjectItems(projectId: string, statusFieldName?: string): Promise<GitHubProjectItem[]>;
    /**
     * Add a comment to an issue.
     */
    addComment(params: AddCommentParams): Promise<void>;
    /**
     * Add an existing issue/PR content to a project.
     */
    addProjectItem(params: AddProjectItemParams): Promise<string>;
    /**
     * Get issue details by owner/repo/number.
     */
    getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue | null>;
}
//# sourceMappingURL=client.d.ts.map