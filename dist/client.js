"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubClient = void 0;
const graphql_1 = require("@octokit/graphql");
const auth_app_1 = require("@octokit/auth-app");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ quiet: true });
/**
 * Client for interacting with GitHub Projects (V2) and Issues.
 * Supports authentication via GitHub App or Personal Access Token.
 */
class GitHubClient {
    constructor(token) {
        this.token = token;
        this.graphqlClient = null;
    }
    /**
     * Initializes or returns the authenticated GraphQL client.
     */
    async getClient() {
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
                const auth = (0, auth_app_1.createAppAuth)({
                    appId,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                    installationId,
                });
                const authentication = await auth({ type: "installation" });
                authToken = authentication.token;
            }
            catch (error) {
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
        this.graphqlClient = graphql_1.graphql.defaults({
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
    async getProject(owner, number) {
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
            const result = await client(orgQuery, { owner, number });
            if (result.organization?.projectV2) {
                return result.organization.projectV2;
            }
        }
        catch (error) {
            if (!error.errors?.some((e) => e.type === 'NOT_FOUND')) {
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
            const result = await client(userQuery, { owner, number });
            return result.user?.projectV2 || null;
        }
        catch (error) {
            if (!error.errors?.some((e) => e.type === 'NOT_FOUND')) {
                console.error('Error fetching user project:', error.message);
            }
            return null;
        }
    }
    /**
     * List all projects for a given owner.
     */
    async getProjects(owner) {
        const client = await this.getClient();
        const projects = [];
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
            let after = null;
            do {
                const result = await client(orgQuery, { owner, after });
                const page = result.organization?.projectsV2;
                if (page?.nodes)
                    projects.push(...page.nodes);
                after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
            } while (after);
        }
        catch (error) {
            if (!error.errors?.some((e) => e.type === 'NOT_FOUND')) {
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
                let after = null;
                do {
                    const result = await client(userQuery, { owner, after });
                    const page = result.user?.projectsV2;
                    if (page?.nodes)
                        projects.push(...page.nodes);
                    after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
                } while (after);
            }
            catch (error) {
                if (!error.errors?.some((e) => e.type === 'NOT_FOUND')) {
                    console.error('Error fetching user projects:', error.message);
                }
            }
        }
        return projects;
    }
    /**
     * Resolve a project by either its number or its title.
     */
    async resolveProject(owner, identifier) {
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
    async getRepositories(owner) {
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
            const repos = [];
            let after = null;
            do {
                const result = await client(orgQuery, { owner, after });
                const page = result.organization?.repositories;
                if (page?.nodes)
                    repos.push(...page.nodes);
                after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
            } while (after);
            if (repos.length > 0)
                return repos;
        }
        catch (error) {
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
            const repos = [];
            let after = null;
            do {
                const result = await client(userQuery, { owner, after });
                const page = result.user?.repositories;
                if (page?.nodes)
                    repos.push(...page.nodes);
                after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
            } while (after);
            return repos;
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Get project columns (Status field options).
     */
    async getProjectColumns(projectId, statusFieldName = 'Status') {
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
        const fields = [];
        let after = null;
        do {
            const result = await client(query, { projectId, after });
            const page = result.node?.fields;
            if (page?.nodes)
                fields.push(...page.nodes);
            after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
        } while (after);
        // Find the "Status" field
        const statusField = fields.find((f) => f.name === statusFieldName);
        if (!statusField || !statusField.options)
            return [];
        return statusField.options.map((opt) => ({
            id: statusField.id,
            name: opt.name,
            optionId: opt.id,
        }));
    }
    /**
     * Create a new issue in a repository.
     */
    async createIssue(params) {
        const repoQuery = `
            query($owner: String!, $name: String!) {
              repository(owner: $owner, name: $name) {
                id
              }
            }
        `;
        const client = await this.getClient();
        const repoResult = await client(repoQuery, {
            owner: params.owner,
            name: params.repo,
        });
        if (!repoResult.repository)
            throw new Error(`Repository ${params.owner}/${params.repo} not found`);
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
        const result = await client(mutation, {
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
    async updateIssue(params) {
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
    async moveIssue(params) {
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
    async getProjectItems(projectId, statusFieldName = 'Status') {
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
        const nodes = [];
        let after = null;
        do {
            const result = await client(query, { projectId, after });
            const page = result.node?.items;
            if (page?.nodes)
                nodes.push(...page.nodes);
            after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
        } while (after);
        return nodes
            .map((node) => {
            const statusValue = node.fieldValues?.nodes?.find((fv) => fv.field?.name === statusFieldName);
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
            .filter((item) => item.id); // Filter out dead items?
    }
    /**
     * Add a comment to an issue.
     */
    async addComment(params) {
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
    async addProjectItem(params) {
        const mutation = `
            mutation($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
                item { id }
              }
            }
        `;
        const client = await this.getClient();
        const result = await client(mutation, params);
        return result.addProjectV2ItemById.item.id;
    }
    /**
     * Add a draft issue to a project.
     */
    async addDraftItem(params) {
        const mutation = `
            mutation($projectId: ID!, $title: String!, $body: String) {
              addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
                projectItem { id }
              }
            }
        `;
        const client = await this.getClient();
        const result = await client(mutation, params);
        return result.addProjectV2DraftIssue.projectItem.id;
    }
    /**
     * Archive a project item.
     */
    async archiveProjectItem(params) {
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
    async deleteProjectItem(params) {
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
    async closeIssue(issueId) {
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
    async getIssue(owner, repo, issueNumber) {
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
        const result = await client(query, { owner, repo, number: issueNumber });
        const issue = result.repository?.issue;
        if (!issue)
            return null;
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
    async getIssueById(issueId) {
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
        const result = await client(query, { id: issueId });
        const node = result.node;
        if (!node || node.__typename !== 'Issue')
            return null;
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
    async listIssueComments(issueId, options = {}) {
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
        const results = [];
        let after = null;
        while (results.length < limit) {
            const response = await client(query, { id: issueId, after });
            const node = response.node;
            if (!node || node.__typename !== 'Issue')
                return [];
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
                if (results.length >= limit)
                    break;
            }
            after = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
            if (!after)
                break;
        }
        return results;
    }
    /**
     * List issues in a repository.
     * Uses GraphQL pagination; returns up to `limit` issues.
     */
    async listIssues(owner, repo, options = {}) {
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
        const results = [];
        let after = null;
        while (results.length < limit) {
            const result = await client(query, { owner, repo, after, states });
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
                if (results.length >= limit)
                    break;
            }
            after = issuesConn?.pageInfo?.hasNextPage ? issuesConn.pageInfo.endCursor : null;
            if (!after)
                break;
        }
        return results;
    }
    /**
     * Fetch a single ProjectV2 item by its node ID (PVTI_*).
     * Useful when listing project items is incomplete due to permissions/redaction.
     */
    async getProjectItem(itemId, statusFieldName = 'Status') {
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
        const result = await client(query, { id: itemId });
        const node = result.node;
        if (!node || node.__typename !== 'ProjectV2Item')
            return null;
        const statusValue = node.fieldValues?.nodes?.find((fv) => fv.field?.name === statusFieldName);
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
    async listProjectIssues(owner, projectId, statusFieldName = 'Status', options = {}) {
        const limit = typeof options.limit === 'number' ? Math.max(1, options.limit) : 50;
        const state = options.state || 'open';
        const qualifiers = [`org:${owner}`, 'is:issue'];
        if (state === 'open')
            qualifiers.push('is:open');
        if (state === 'closed')
            qualifiers.push('is:closed');
        if (options.repo)
            qualifiers.push(`repo:${options.repo}`);
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
        const results = [];
        let after = null;
        while (results.length < limit) {
            const response = await client(query, { q: searchQuery, after });
            const conn = response.search;
            const nodes = conn?.nodes || [];
            for (const node of nodes) {
                if (node?.__typename !== 'Issue')
                    continue;
                const projectItem = (node.projectItems?.nodes || []).find((pi) => pi?.project?.id === projectId);
                if (!projectItem)
                    continue;
                const statusValue = projectItem.fieldValues?.nodes?.find((fv) => fv.field?.name === statusFieldName);
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
                if (results.length >= limit)
                    break;
            }
            after = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
            if (!after)
                break;
        }
        return results;
    }
}
exports.GitHubClient = GitHubClient;
