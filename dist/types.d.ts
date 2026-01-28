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
export interface GitHubProjectItem {
    id: string;
    content: {
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
//# sourceMappingURL=types.d.ts.map