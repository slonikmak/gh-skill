import { graphql } from '@octokit/graphql';
import { createAppAuth } from "@octokit/auth-app";
import * as dotenv from 'dotenv';
import {
  GitHubProject,
  GitHubProjectColumn,
  GitHubIssue,
  GitHubIssueDetails,
  GitHubIssueListItem,
  GitHubIssueComment,
  GitHubProjectItemDetails,
  ListIssuesOptions,
  ListIssueCommentsOptions,
  ListProjectIssuesOptions,
  GitHubProjectIssueItem,
  CreateIssueParams,
  MoveIssueParams,
  GitHubProjectItem,
  UpdateIssueParams,
  AddCommentParams,
  AddProjectItemParams,
} from './types';

dotenv.config({ quiet: true });

/**
 * Client for interacting with GitHub Projects (V2) and Issues.
 * Supports authentication via GitHub App or Personal Access Token.
 */
export class GitHubClient {
  private graphqlClient: typeof graphql | null = null;

  constructor(private token?: string) {
  }

  /**
   * Initializes or returns the authenticated GraphQL client.
   */
  private async getClient(): Promise<typeof graphql> {
    if (this.graphqlClient) {
      return this.graphqlClient;
    }

    let authToken = this.token;

    // Try GitHub App Auth if credentials are present in env
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

    if (!authToken && appId && privateKey && installationId) {
      try {
        const auth = createAppAuth({
          appId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          installationId,
        });
        const authentication = await auth({ type: "installation" });
        authToken = authentication.token;
      } catch (error: any) {
        console.warn(`⚠️ GitHub App auth failed: ${error.message}. Checking for GITHUB_TOKEN fallback...`);
      }
    }

    // Fallback to GITHUB_TOKEN if App auth didn't produce a token
    if (!authToken) {
      authToken = process.env.GITHUB_TOKEN;
    }

    if (!authToken) {
      throw new Error('GitHub authentication failed. Please provide either GITHUB_TOKEN or (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID) in your .env file.');
    }

    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${authToken}`,
      },
    });

    return this.graphqlClient;
  }

  /**
   * Get a project by owner (user or org) and project number.
   * Robust implementation that tries Organization first, then User.
   */
  async getProject(owner: string, number: number): Promise<GitHubProject | null> {
    const client = await this.getClient();

    // 1. Try Organization
    const orgQuery = `
            query($owner: String!, $number: Int!) {
                organization(login: $owner) {
                    projectV2(number: $number) {
                        id
                        number
                        title
                        url
                        shortDescription
                    }
                }
            }
        `;

    try {
      const result: any = await client(orgQuery, { owner, number });
      if (result.organization?.projectV2) {
        return result.organization.projectV2;
      }
    } catch (error: any) {
      if (!error.errors?.some((e: any) => e.type === 'NOT_FOUND')) {
        console.error('Error fetching org project:', error.message);
      }
    }

    // 2. Try User fallback
    const userQuery = `
            query($owner: String!, $number: Int!) {
                user(login: $owner) {
                    projectV2(number: $number) {
                        id
                        number
                        title
                        url
                        shortDescription
                    }
                }
            }
        `;

    try {
      const result: any = await client(userQuery, { owner, number });
      return result.user?.projectV2 || null;
    } catch (error: any) {
      if (!error.errors?.some((e: any) => e.type === 'NOT_FOUND')) {
        console.error('Error fetching user project:', error.message);
      }
      return null;
    }
  }

  /**
   * List all projects for a given owner.
   */
  async getProjects(owner: string): Promise<GitHubProject[]> {
    const client = await this.getClient();
    const projects: GitHubProject[] = [];

    // 1. Try Organization
    const orgQuery = `
            query($owner: String!, $after: String) {
                organization(login: $owner) {
                    projectsV2(first: 50, after: $after) {
                        pageInfo { hasNextPage endCursor }
                        nodes {
                            id
                            number
                            title
                            url
                            shortDescription
                        }
                    }
                }
            }
        `;

    try {
      let after: string | null = null;
      do {
        const result: any = await client(orgQuery, { owner, after });
        const page = result.organization?.projectsV2;
        if (page?.nodes) projects.push(...page.nodes);
        after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after);
    } catch (error: any) {
      if (!error.errors?.some((e: any) => e.type === 'NOT_FOUND')) {
        console.error('Error fetching org projects:', error.message);
      }
    }

    // 2. Try User fallback if projects are empty (or always try both?)
    // Most users won't be both org and user with same name but let's be safe.
    if (projects.length === 0) {
      const userQuery = `
                query($owner: String!, $after: String) {
                    user(login: $owner) {
                        projectsV2(first: 50, after: $after) {
                            pageInfo { hasNextPage endCursor }
                            nodes {
                                id
                                number
                                title
                                url
                                shortDescription
                            }
                        }
                    }
                }
            `;

      try {
        let after: string | null = null;
        do {
          const result: any = await client(userQuery, { owner, after });
          const page = result.user?.projectsV2;
          if (page?.nodes) projects.push(...page.nodes);
          after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
        } while (after);
      } catch (error: any) {
        if (!error.errors?.some((e: any) => e.type === 'NOT_FOUND')) {
          console.error('Error fetching user projects:', error.message);
        }
      }
    }

    return projects;
  }

  /**
   * Resolve a project by either its number or its title.
   */
  async resolveProject(owner: string, identifier: string | number): Promise<GitHubProject | null> {
    const num = typeof identifier === 'number' ? identifier : parseInt(identifier, 10);
    if (!isNaN(num)) {
      return this.getProject(owner, num);
    }

    // If not a number, search by title
    const projects = await this.getProjects(owner);
    const searchTitle = String(identifier).toLowerCase().trim();
    return projects.find(p => p.title.toLowerCase().trim() === searchTitle) || null;
  }

  /**
   * List repositories for an owner.
   */
  async getRepositories(owner: string): Promise<any[]> {
    const client = await this.getClient();

    // 1. Try Organization
    const orgQuery = `
        query($owner: String!, $after: String) {
          organization(login: $owner) {
            repositories(first: 50, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
              pageInfo { hasNextPage endCursor }
              nodes {
                name
                nameWithOwner
                id
              }
            }
          }
        }
      `;

    try {
      const repos: any[] = [];
      let after: string | null = null;
      do {
      const result: any = await client(orgQuery, { owner, after });
      const page = result.organization?.repositories;
      if (page?.nodes) repos.push(...page.nodes);
      after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after);
      if (repos.length > 0) return repos;
    } catch (error) {
      // Ignore NOT_FOUND errors
    }

    // 2. Try User fallback
    const userQuery = `
        query($owner: String!, $after: String) {
          user(login: $owner) {
            repositories(first: 50, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
              pageInfo { hasNextPage endCursor }
              nodes {
                name
                nameWithOwner
                id
              }
            }
          }
        }
      `;

    try {
      const repos: any[] = [];
      let after: string | null = null;
      do {
      const result: any = await client(userQuery, { owner, after });
      const page = result.user?.repositories;
      if (page?.nodes) repos.push(...page.nodes);
      after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after);
      return repos;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get project columns (Status field options).
   */
  async getProjectColumns(projectId: string, statusFieldName: string = 'Status'): Promise<GitHubProjectColumn[]> {
    const query = `
            query($projectId: ID!, $after: String) {
              node(id: $projectId) {
                ... on ProjectV2 {
                  fields(first: 50, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                        options {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
        `;

    const client = await this.getClient();
    const fields: any[] = [];
    let after: string | null = null;
    do {
      const result: any = await client(query, { projectId, after });
      const page = result.node?.fields;
      if (page?.nodes) fields.push(...page.nodes);
      after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    // Find the "Status" field
    const statusField = fields.find((f: any) => f.name === statusFieldName);
    if (!statusField || !statusField.options) return [];

    return statusField.options.map((opt: any) => ({
      id: statusField.id,
      name: opt.name,
      optionId: opt.id,
    }));
  }

  /**
   * Create a new issue in a repository.
   */
  async createIssue(params: CreateIssueParams): Promise<GitHubIssue> {
    const repoQuery = `
            query($owner: String!, $name: String!) {
              repository(owner: $owner, name: $name) {
                id
              }
            }
        `;

    const client = await this.getClient();
    const repoResult: any = await client(repoQuery, {
      owner: params.owner,
      name: params.repo,
    });

    if (!repoResult.repository) throw new Error(`Repository ${params.owner}/${params.repo} not found`);

    const mutation = `
            mutation($repositoryId: ID!, $title: String!, $body: String) {
              createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
                issue {
                  id
                  number
                  title
                  body
                  state
                  url
                  repository {
                    owner { login }
                    name
                  }
                }
              }
            }
        `;

    const result: any = await client(mutation, {
      repositoryId: repoResult.repository.id,
      title: params.title,
      body: params.body || '',
    });

    const issue = result.createIssue.issue;
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      url: issue.url,
      repository: {
        owner: issue.repository.owner.login,
        name: issue.repository.name,
      },
    };
  }

  /**
   * Update an issue's title or body.
   */
  async updateIssue(params: UpdateIssueParams): Promise<void> {
    const mutation = `
            mutation($issueId: ID!, $title: String, $body: String) {
              updateIssue(input: { id: $issueId, title: $title, body: $body }) {
                issue { id }
              }
            }
        `;
    const client = await this.getClient();
    await client(mutation, params);
  }

  /**
   * Move a project item to a different status column.
   */
  async moveIssue(params: MoveIssueParams): Promise<void> {
    const mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: $value
              }) {
                projectV2Item { id }
              }
            }
        `;
    const client = await this.getClient();
    await client(mutation, {
      projectId: params.projectId,
      itemId: params.issueId,
      fieldId: params.statusFieldId,
      value: {
        singleSelectOptionId: params.statusOptionId,
      },
    });
  }

  /**
   * Get all items (Issues/PRs) in a project.
   */
  async getProjectItems(projectId: string, statusFieldName: string = 'Status'): Promise<GitHubProjectItem[]> {
    const query = `
            query($projectId: ID!, $after: String) {
              node(id: $projectId) {
                ... on ProjectV2 {
                  items(first: 100, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                      id
                      content {
                        __typename
                        ... on Issue {
                          id
                          number
                          title
                          url
                          repository { nameWithOwner }
                        }
                        ... on PullRequest {
                          id
                          number
                          title
                          url
                          repository { nameWithOwner }
                        }
                        ... on DraftIssue {
                          id
                          title
                        }
                      }
                      fieldValues(first: 50) {
                        nodes {
                          ... on ProjectV2ItemFieldSingleSelectValue {
                            name
                            field { ... on ProjectV2FieldCommon { name } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
        `;

    const client = await this.getClient();
    const nodes: any[] = [];
    let after: string | null = null;
    do {
      const result: any = await client(query, { projectId, after });
      const page = result.node?.items;
      if (page?.nodes) nodes.push(...page.nodes);
      after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    return nodes
      .map((node: any) => {
        const statusValue = node.fieldValues?.nodes?.find((fv: any) => fv.field?.name === statusFieldName);
        return {
          id: node.id,
          type: node.content?.__typename,
          content: {
            id: node.content?.id,
            number: typeof node.content?.number === 'number' ? node.content.number : 0,
            title: node.content?.title || 'No Title',
            url: node.content?.url || '',
            repository: node.content?.repository?.nameWithOwner || 'N/A',
          },
          status: statusValue?.name,
        };
      })
      .filter((item: any) => item.id); // Filter out dead items?
  }

  /**
   * Add a comment to an issue.
   */
  async addComment(params: AddCommentParams): Promise<void> {
    const mutation = `
            mutation($subjectId: ID!, $body: String!) {
              addComment(input: { subjectId: $subjectId, body: $body }) {
                clientMutationId
              }
            }
        `;
    const client = await this.getClient();
    await client(mutation, params);
  }

  /**
   * Add an existing issue/PR content to a project.
   */
  async addProjectItem(params: AddProjectItemParams): Promise<string> {
    const mutation = `
            mutation($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
                item { id }
              }
            }
        `;
    const client = await this.getClient();
    const result: any = await client(mutation, params);
    return result.addProjectV2ItemById.item.id;
  }

  /**
   * Add a draft issue to a project.
   */
  async addDraftItem(params: { projectId: string; title: string; body?: string }): Promise<string> {
    const mutation = `
            mutation($projectId: ID!, $title: String!, $body: String) {
              addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
                projectItem { id }
              }
            }
        `;
    const client = await this.getClient();
    const result: any = await client(mutation, params);
    return result.addProjectV2DraftIssue.projectItem.id;
  }

  /**
   * Archive a project item.
   */
  async archiveProjectItem(params: { projectId: string; itemId: string; archived: boolean }): Promise<void> {
    const mutation = params.archived
      ? `mutation archiveItem($projectId: ID!, $itemId: ID!) {
          archiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
            clientMutationId
          }
        }`
      : `mutation unarchiveItem($projectId: ID!, $itemId: ID!) {
          unarchiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
            clientMutationId
          }
        }`;
    const client = await this.getClient();
    await client(mutation, { projectId: params.projectId, itemId: params.itemId });
  }

  /**
   * Delete a project item from the project.
   */
  async deleteProjectItem(params: { projectId: string; itemId: string }): Promise<void> {
    const mutation = `
            mutation deleteItem($projectId: ID!, $itemId: ID!) {
              deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
                deletedItemId
              }
            }
        `;
    const client = await this.getClient();
    await client(mutation, params);
  }

  /**
   * Close an issue.
   */
  async closeIssue(issueId: string): Promise<void> {
    const mutation = `
            mutation($issueId: ID!) {
              closeIssue(input: { issueId: $issueId }) {
                issue { state }
              }
            }
        `;
    const client = await this.getClient();
    await client(mutation, { issueId });
  }

  /**
   * Get issue details by owner/repo/number.
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue | null> {
    const query = `
            query($owner: String!, $repo: String!, $number: Int!) {
              repository(owner: $owner, name: $repo) {
                issue(number: $number) {
                  id
                  number
                  title
                  body
                  state
                  url
                  repository {
                    owner { login }
                    name
                  }
                }
              }
            }
        `;
    const client = await this.getClient();
    const result: any = await client(query, { owner, repo, number: issueNumber });
    const issue = result.repository?.issue;
    if (!issue) return null;

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      url: issue.url,
      repository: {
        owner: issue.repository.owner.login,
        name: issue.repository.name,
      },
    };
  }

  /**
   * Get issue details by node ID.
   * Useful for automation workflows where you already have `Issue.id`.
   */
  async getIssueById(issueId: string): Promise<GitHubIssueDetails | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          __typename
          ... on Issue {
            id
            number
            title
            body
            state
            url
            createdAt
            updatedAt
            author { login }
            repository {
              owner { login }
              name
            }
          }
        }
      }
    `;

    const client = await this.getClient();
    const result: any = await client(query, { id: issueId });
    const node = result.node;
    if (!node || node.__typename !== 'Issue') return null;

    return {
      id: node.id,
      number: node.number,
      title: node.title,
      body: node.body,
      state: node.state,
      url: node.url,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      author: node.author?.login || null,
      repository: {
        owner: node.repository?.owner?.login || '',
        name: node.repository?.name || '',
      },
    };
  }

  /**
   * List comments for an issue by issue node ID.
   * Uses GraphQL pagination; returns up to `limit` comments.
   */
  async listIssueComments(issueId: string, options: ListIssueCommentsOptions = {}): Promise<GitHubIssueComment[]> {
    const limit = typeof options.limit === 'number' ? Math.max(1, options.limit) : 50;

    const query = `
      query($id: ID!, $after: String) {
        node(id: $id) {
          __typename
          ... on Issue {
            comments(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                url
                body
                createdAt
                updatedAt
                author { login }
              }
            }
          }
        }
      }
    `;

    const client = await this.getClient();
    const results: GitHubIssueComment[] = [];
    let after: string | null = null;

    while (results.length < limit) {
      const response: any = await client(query, { id: issueId, after });
      const node = response.node;
      if (!node || node.__typename !== 'Issue') return [];

      const conn = node.comments;
      const nodes = conn?.nodes || [];
      for (const comment of nodes) {
        results.push({
          id: comment.id,
          url: comment.url,
          body: comment.body,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          author: comment.author?.login || null,
        });
        if (results.length >= limit) break;
      }

      after = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      if (!after) break;
    }

    return results;
  }

  /**
   * List issues in a repository.
   * Uses GraphQL pagination; returns up to `limit` issues.
   */
  async listIssues(owner: string, repo: string, options: ListIssuesOptions = {}): Promise<GitHubIssueListItem[]> {
    const limit = typeof options.limit === 'number' ? Math.max(1, options.limit) : 50;
    const state = options.state || 'open';

    const states = state === 'closed' ? ['CLOSED'] : state === 'all' ? ['OPEN', 'CLOSED'] : ['OPEN'];

    const query = `
      query($owner: String!, $repo: String!, $after: String, $states: [IssueState!]) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, after: $after, states: $states, orderBy: { field: CREATED_AT, direction: DESC }) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              number
              title
              state
              url
              createdAt
              updatedAt
              author { login }
            }
          }
        }
      }
    `;

    const client = await this.getClient();
    const results: GitHubIssueListItem[] = [];
    let after: string | null = null;

    while (results.length < limit) {
      const result: any = await client(query, { owner, repo, after, states });
      const issuesConn = result.repository?.issues;
      const nodes = issuesConn?.nodes || [];

      for (const node of nodes) {
        results.push({
          id: node.id,
          number: node.number,
          title: node.title,
          state: node.state,
          url: node.url,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          author: node.author?.login || null,
        });
        if (results.length >= limit) break;
      }

      after = issuesConn?.pageInfo?.hasNextPage ? issuesConn.pageInfo.endCursor : null;
      if (!after) break;
    }

    return results;
  }

  /**
   * Fetch a single ProjectV2 item by its node ID (PVTI_*).
   * Useful when listing project items is incomplete due to permissions/redaction.
   */
  async getProjectItem(itemId: string, statusFieldName: string = 'Status'): Promise<GitHubProjectItemDetails | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          __typename
          ... on ProjectV2Item {
            id
            isArchived
            project { id title number }
            content {
              __typename
              ... on Issue {
                id
                number
                title
                url
                repository { nameWithOwner }
              }
              ... on PullRequest {
                id
                number
                title
                url
                repository { nameWithOwner }
              }
              ... on DraftIssue {
                id
                title
              }
            }
            fieldValues(first: 50) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2FieldCommon { name } }
                }
              }
            }
          }
        }
      }
    `;

    const client = await this.getClient();
    const result: any = await client(query, { id: itemId });
    const node = result.node;
    if (!node || node.__typename !== 'ProjectV2Item') return null;

    const statusValue = node.fieldValues?.nodes?.find((fv: any) => fv.field?.name === statusFieldName);

    const contentTypename = node.content?.__typename;
    const content = {
      __typename: contentTypename || null,
      id: node.content?.id || '',
      number: typeof node.content?.number === 'number' ? node.content.number : 0,
      title: node.content?.title || (contentTypename ? 'No Title' : 'REDACTED'),
      url: node.content?.url || '',
      repository: node.content?.repository?.nameWithOwner || 'N/A',
    };

    return {
      id: node.id,
      isArchived: !!node.isArchived,
      project: node.project ? { id: node.project.id, title: node.project.title, number: node.project.number } : null,
      content,
      status: statusValue?.name,
    };
  }

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
  async listProjectIssues(owner: string, projectId: string, statusFieldName: string = 'Status', options: ListProjectIssuesOptions = {}): Promise<GitHubProjectIssueItem[]> {
    const limit = typeof options.limit === 'number' ? Math.max(1, options.limit) : 50;
    const state = options.state || 'open';

    const qualifiers: string[] = [`org:${owner}`, 'is:issue'];
    if (state === 'open') qualifiers.push('is:open');
    if (state === 'closed') qualifiers.push('is:closed');
    if (options.repo) qualifiers.push(`repo:${options.repo}`);

    const searchQuery = qualifiers.join(' ');

    const query = `
      query($q: String!, $after: String) {
        search(type: ISSUE, query: $q, first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            __typename
            ... on Issue {
              id
              number
              title
              state
              url
              createdAt
              updatedAt
              author { login }
              repository { nameWithOwner }
              projectItems(first: 50) {
                nodes {
                  id
                  project { id }
                  fieldValues(first: 50) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field { ... on ProjectV2FieldCommon { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const client = await this.getClient();
    const results: GitHubProjectIssueItem[] = [];
    let after: string | null = null;

    while (results.length < limit) {
      const response: any = await client(query, { q: searchQuery, after });
      const conn = response.search;
      const nodes = conn?.nodes || [];

      for (const node of nodes) {
        if (node?.__typename !== 'Issue') continue;

        const projectItem = (node.projectItems?.nodes || []).find((pi: any) => pi?.project?.id === projectId);
        if (!projectItem) continue;

        const statusValue = projectItem.fieldValues?.nodes?.find((fv: any) => fv.field?.name === statusFieldName);

        results.push({
          issue: {
            id: node.id,
            number: node.number,
            title: node.title,
            state: node.state,
            url: node.url,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            author: node.author?.login || null,
          },
          projectItemId: projectItem.id,
          status: statusValue?.name,
        });

        if (results.length >= limit) break;
      }

      after = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      if (!after) break;
    }

    return results;
  }
}
