import { GitHubProject, GitHubProjectColumn, GitHubIssue, GitHubIssueDetails, GitHubIssueListItem, GitHubIssueComment, GitHubProjectItemDetails, ListIssuesOptions, ListIssueCommentsOptions, ListProjectIssuesOptions, GitHubProjectIssueItem, CreateIssueParams, MoveIssueParams, GitHubProjectItem, UpdateIssueParams, AddCommentParams, AddProjectItemParams } from './types';
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
     * List all projects for a given owner.
     */
    getProjects(owner: string): Promise<GitHubProject[]>;
    /**
     * Resolve a project by either its number or its title.
     */
    resolveProject(owner: string, identifier: string | number): Promise<GitHubProject | null>;
    /**
     * List repositories for an owner.
     */
    getRepositories(owner: string): Promise<any[]>;
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
     * Add a draft issue to a project.
     */
    addDraftItem(params: {
        projectId: string;
        title: string;
        body?: string;
    }): Promise<string>;
    /**
     * Archive a project item.
     */
    archiveProjectItem(params: {
        projectId: string;
        itemId: string;
        archived: boolean;
    }): Promise<void>;
    /**
     * Delete a project item from the project.
     */
    deleteProjectItem(params: {
        projectId: string;
        itemId: string;
    }): Promise<void>;
    /**
     * Close an issue.
     */
    closeIssue(issueId: string): Promise<void>;
    /**
     * Get issue details by owner/repo/number.
     */
    getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue | null>;
    /**
     * Get issue details by node ID.
     * Useful for automation workflows where you already have `Issue.id`.
     */
    getIssueById(issueId: string): Promise<GitHubIssueDetails | null>;
    /**
     * List comments for an issue by issue node ID.
     * Uses GraphQL pagination; returns up to `limit` comments.
     */
    listIssueComments(issueId: string, options?: ListIssueCommentsOptions): Promise<GitHubIssueComment[]>;
    /**
     * List issues in a repository.
     * Uses GraphQL pagination; returns up to `limit` issues.
     */
    listIssues(owner: string, repo: string, options?: ListIssuesOptions): Promise<GitHubIssueListItem[]>;
    /**
     * Fetch a single ProjectV2 item by its node ID (PVTI_*).
     * Useful when listing project items is incomplete due to permissions/redaction.
     */
    getProjectItem(itemId: string, statusFieldName?: string): Promise<GitHubProjectItemDetails | null>;
    /**
     * List issues that are linked to a specific ProjectV2.
     *
     * Why: In some GitHub App setups, `ProjectV2.items` may not list Issue/PR items reliably.
     * This uses `search(type: ISSUE, ...)` and filters by `Issue.projectItems.project.id == projectId`.
     *
     * Notes:
     * - GitHub Search API has a 1000-result cap per query.
     * - Draft issues are not returned by search.
     */
    listProjectIssues(owner: string, projectId: string, statusFieldName?: string, options?: ListProjectIssuesOptions): Promise<GitHubProjectIssueItem[]>;
}
//# sourceMappingURL=client.d.ts.map