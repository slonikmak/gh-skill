export interface GitHubProject {
    id: string;
    number: number;
    title: string;
    url: string;
    shortDescription?: string;
}

export interface GitHubProjectColumn {
    id: string;
    name: string;
    optionId?: string;
}

export interface GitHubIssue {
    id: string;
    number: number;
    title: string;
    body?: string;
    state: string;
    url: string;
    repository: {
        owner: string;
        name: string;
    };
}

export interface GitHubIssueDetails {
    id: string;
    number: number;
    title: string;
    body?: string;
    state: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    author: string | null;
    repository: {
        owner: string;
        name: string;
    };
}

export interface GitHubIssueListItem {
    id: string;
    number: number;
    title: string;
    state: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    author: string | null;
}

export interface ListIssuesOptions {
    state?: 'open' | 'closed' | 'all';
    limit?: number;
}

export interface ListIssueCommentsOptions {
    limit?: number;
}

export interface GitHubIssueComment {
    id: string;
    url: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    author: string | null;
}

export interface ListProjectIssuesOptions {
    state?: 'open' | 'closed' | 'all';
    limit?: number;
    repo?: string; // optional: owner/repo to scope the search
}

export interface GitHubProjectIssueItem {
    issue: GitHubIssueListItem;
    projectItemId: string;
    status?: string;
}

export interface GitHubProjectItem {
    id: string;
    type?: string;
    content: {
        id: string;
        number: number;
        title: string;
        url: string;
        repository: string;
    };
    status?: string;
}

export interface GitHubProjectItemDetails {
    id: string;
    isArchived: boolean;
    project: { id: string; title: string; number: number } | null;
    content: {
        __typename: string | null;
        id: string;
        number: number;
        title: string;
        url: string;
        repository: string;
    };
    status?: string;
}

export interface CreateIssueParams {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    assignees?: string[];
    labels?: string[];
    [key: string]: any;
}

export interface MoveIssueParams {
    issueId: string;
    projectId: string;
    statusFieldId: string;
    statusOptionId: string;
    [key: string]: any;
}

export interface UpdateIssueParams {
    issueId: string;
    title?: string;
    body?: string;
    [key: string]: any;
}

export interface AddCommentParams {
    subjectId: string;
    body: string;
    [key: string]: any;
}

export interface AddProjectItemParams {
    projectId: string;
    contentId: string;
    [key: string]: any;
}
