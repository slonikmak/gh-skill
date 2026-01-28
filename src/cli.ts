#!/usr/bin/env node

import { Command } from 'commander';
import { GitHubClient } from './client';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

const program = new Command();
const client = new GitHubClient();

program
    .name('ghs')
    .description('GitHub Projects & Issues CLI Tool')
    .version('1.0.0')
    .option('-j, --json', 'Output results in JSON format');

function printOutput(data: any, humanReadableFn: () => void) {
    if (program.opts().json) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        humanReadableFn();
    }
}

function handleError(error: any) {
    const serialized = serializeError(error);
    if (program.opts().json) {
        console.error(JSON.stringify({ error: serialized }, null, 2));
    } else {
        console.error('Error:', serialized.message);
    }
    process.exit(1);
}

function serializeError(error: any) {
    const message = error?.message ? String(error.message) : String(error);
    const status = typeof error?.status === 'number' ? error.status : undefined;
    const name = error?.name ? String(error.name) : undefined;
    const errors = Array.isArray(error?.errors) ? error.errors : undefined;

    return {
        message,
        ...(name ? { name } : {}),
        ...(status ? { status } : {}),
        ...(errors ? { errors } : {}),
    };
}

// --- Project Commands ---

program
    .command('project-list')
    .description('List all projects for an owner')
    .argument('<owner>', 'Repository owner (user or org)')
    .action(async (owner: string) => {
        try {
            const projects = await client.getProjects(owner);
            printOutput(projects, () => {
                console.log(`\n📋 Projects for ${owner}:`);
                projects.forEach((p) => {
                    console.log(`- [#${p.number}] ${p.title}`);
                    console.log(`  ID:  ${p.id}`);
                    console.log(`  URL: ${p.url}\n`);
                });
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('repo-list')
    .description('List repositories for an owner')
    .argument('<owner>', 'Repository owner')
    .action(async (owner: string) => {
        try {
            const repos = await client.getRepositories(owner);
            printOutput(repos, () => {
                console.log(`\n📦 Repositories for ${owner}:`);
                repos.forEach((r) => {
                    console.log(`- ${r.nameWithOwner} (ID: ${r.id})`);
                });
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('board')
    .description('Show project board details and columns')
    .argument('<owner>', 'Repository owner (user or org)')
    .argument('<project>', 'Project number or title')
    .option('-s, --status-field <name>', 'Name of the status field', 'Status')
    .action(async (owner: string, projectIdent: string, options: any) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');

            const columns = await client.getProjectColumns(project.id, options.statusField);

            printOutput({ project, columns }, () => {
                console.log(`\n📋 ${project.title} (#${project.number})`);
                console.log(`   ID: ${project.id}`);
                if (project.shortDescription) console.log(`   ${project.shortDescription}`);
                console.log(`   ${project.url}\n`);

                console.log(`Columns (Field: "${options.statusField}"):`);
                if (columns.length > 0) {
                    console.log(`   (Status Field ID: ${columns[0].id})`);
                }
                columns.forEach((col) => {
                    console.log(`  • ${col.name} (Option ID: ${col.optionId})`);
                });
                console.log('');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('items')
    .description('List all items (issues/PRs) in a project')
    .argument('<owner>', 'Repository owner (user or org)')
    .argument('<project>', 'Project number or title')
    .option('-s, --status-field <name>', 'Name of the status field', 'Status')
    .action(async (owner: string, projectIdent: string, options: any) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');

            const items = await client.getProjectItems(project.id, options.statusField);

            printOutput(items, () => {
                console.log(`\nItems in "${project.title}":`);
                items.forEach((item) => {
                    console.log(`- [#${item.content.number}] ${item.content.title}`);
                    console.log(`  Status:  ${item.status || 'No Status'}`);
                    console.log(`  Repo:    ${item.content.repository}`);
                    console.log(`  Item ID: ${item.id}`);
                    console.log(`  Node ID: ${item.content.id}\n`);
                });
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('project-issues')
    .description('List issues linked to a Project V2 (project-centric)')
    .argument('<owner>', 'Project owner (user or org)')
    .argument('<project>', 'Project number or title')
    .option('-s, --status-field <name>', 'Name of the status field', 'Status')
    .option('--state <state>', 'Issue state: open|closed|all', 'open')
    .option('--limit <n>', 'Max issues to return', (v) => parseInt(v, 10), 50)
    .option('--repo <ownerRepo>', 'Optional repo scope in format owner/repo')
    .action(async (owner: string, projectIdent: string, options: any) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');

            const stateInput = String(options.state || 'open').toLowerCase();
            const state = stateInput === 'closed' ? 'closed' : stateInput === 'all' ? 'all' : 'open';
            const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 50;

            const issues = await client.listProjectIssues(owner, project.id, options.statusField, {
                state,
                limit,
                repo: options.repo,
            });

            printOutput(issues, () => {
                console.log(`\n📌 Issues linked to project "${project.title}" (#${project.number})`);
                issues.forEach((it) => {
                    console.log(`- [#${it.issue.number}] (${it.issue.state}) ${it.issue.title}`);
                    console.log(`  Repo:   ${options.repo || 'org-wide'}`);
                    console.log(`  URL:    ${it.issue.url}`);
                    console.log(`  IssueID:${it.issue.id}`);
                    console.log(`  ItemID: ${it.projectItemId}`);
                    console.log(`  Status: ${it.status || 'No Status'}\n`);
                });
            });
        } catch (error: any) {
            handleError(error);
        }
    });

// --- Issue Commands ---

program
    .command('issue-show')
    .description('Show detailed information about an issue')
    .argument('<repo>', 'Repository in format owner/repo')
    .argument('<number>', 'Issue number', parseInt)
    .action(async (repo: string, number: number) => {
        try {
            const [owner, repoName] = repo.split('/');
            if (!owner || !repoName) {
                throw new Error('Repository must be in format owner/repo');
            }

            const issue = await client.getIssue(owner, repoName, number);
            if (!issue) throw new Error('Issue not found');

            printOutput(issue, () => {
                console.log(`\n#${issue.number}: ${issue.title}`);
                console.log(`Node ID: ${issue.id}`);
                console.log(`State:   ${issue.state}`);
                console.log(`URL:     ${issue.url}`);
                if (issue.body) {
                    console.log(`\nDescription:\n${issue.body}\n`);
                }
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-get')
    .description('Get issue details by issue node ID')
    .argument('<issueId>', 'Issue node ID')
    .action(async (issueId: string) => {
        try {
            const issue = await client.getIssueById(issueId);
            if (!issue) throw new Error('Issue not found');

            printOutput(issue, () => {
                console.log(`\n#${issue.number}: ${issue.title}`);
                console.log(`Node ID: ${issue.id}`);
                console.log(`Repo:    ${issue.repository.owner}/${issue.repository.name}`);
                console.log(`State:   ${issue.state}`);
                console.log(`URL:     ${issue.url}`);
                console.log(`Updated: ${issue.updatedAt}`);
                if (issue.body) {
                    console.log(`\nDescription:\n${issue.body}\n`);
                }
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-list')
    .description('List issues in a repository')
    .argument('<repo>', 'Repository in format owner/repo')
    .option('-s, --state <state>', 'Issue state: open|closed|all', 'open')
    .option('-l, --limit <n>', 'Max issues to return', (v) => parseInt(v, 10), 50)
    .action(async (repo: string, options: any) => {
        try {
            const [owner, repoName] = repo.split('/');
            if (!owner || !repoName) {
                throw new Error('Repository must be in format owner/repo');
            }

            const stateInput = String(options.state || 'open').toLowerCase();
            const state = stateInput === 'closed' ? 'closed' : stateInput === 'all' ? 'all' : 'open';
            const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 50;

            const issues = await client.listIssues(owner, repoName, { state, limit });

            printOutput(issues, () => {
                console.log(`\n🧾 Issues for ${owner}/${repoName} (state: ${state}, limit: ${limit}):`);
                issues.forEach((i) => {
                    console.log(`- [#${i.number}] (${i.state}) ${i.title}`);
                    console.log(`  ID:  ${i.id}`);
                    console.log(`  URL: ${i.url}\n`);
                });
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-create')
    .description('Create a new issue')
    .argument('<repo>', 'Repository in format owner/repo')
    .argument('<title>', 'Issue title')
    .option('-b, --body <body>', 'Issue body/description')
    .action(async (repo: string, title: string, options: any) => {
        try {
            const [owner, repoName] = repo.split('/');
            if (!owner || !repoName) {
                throw new Error('Repository must be in format owner/repo');
            }

            const issue = await client.createIssue({
                owner,
                repo: repoName,
                title,
                body: options.body,
            });

            printOutput(issue, () => {
                console.log(`\n✅ Issue created: #${issue.number}`);
                console.log(`   Node ID: ${issue.id}`);
                console.log(`   ${issue.url}\n`);
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-update')
    .description('Update an issue title or body')
    .argument('<issueId>', 'Issue node ID')
    .option('-t, --title <title>', 'New title')
    .option('-b, --body <body>', 'New body')
    .action(async (issueId: string, options: any) => {
        try {
            await client.updateIssue({
                issueId,
                title: options.title,
                body: options.body,
            });

            printOutput({ success: true, issueId }, () => {
                console.log('✅ Issue updated successfully');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-comment')
    .description('Add a comment to an issue')
    .argument('<issueId>', 'Issue node ID')
    .argument('<body>', 'Comment text')
    .action(async (issueId: string, body: string) => {
        try {
            await client.addComment({
                subjectId: issueId,
                body,
            });

            printOutput({ success: true, issueId }, () => {
                console.log('✅ Comment added successfully');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-comments')
    .description('List comments for an issue (by issue node ID)')
    .argument('<issueId>', 'Issue node ID')
    .option('-l, --limit <n>', 'Max comments to return', (v) => parseInt(v, 10), 50)
    .action(async (issueId: string, options: any) => {
        try {
            const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 50;
            const comments = await client.listIssueComments(issueId, { limit });

            printOutput(comments, () => {
                console.log(`\n💬 Comments (limit: ${limit}):`);
                comments.forEach((c) => {
                    console.log(`- ${c.author || 'unknown'} @ ${c.createdAt}`);
                    console.log(`  ${c.url}`);
                    console.log(`  ${c.body}\n`);
                });
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-move')
    .description('Move project item to a different column')
    .argument('<itemId>', 'Project item ID')
    .argument('<projectId>', 'Project node ID')
    .argument('<statusFieldId>', 'Status field ID')
    .argument('<optionId>', 'Status option ID')
    .action(async (itemId, projectId, statusFieldId, optionId) => {
        try {
            await client.moveIssue({
                issueId: itemId,
                projectId,
                statusFieldId,
                statusOptionId: optionId,
            });

            printOutput({ success: true, itemId, projectId, statusFieldId, optionId }, () => {
                console.log('✅ Item moved successfully');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('item-move')
    .description('Move a project item by status name (no option IDs required)')
    .argument('<owner>', 'Project owner')
    .argument('<project>', 'Project number or title')
    .argument('<itemId>', 'Project item ID (PVTI_...)')
    .requiredOption('--status <name>', 'Target status/column name (e.g., "To Do")')
    .option('-s, --status-field <name>', 'Name of the status field', 'Status')
    .action(async (owner: string, projectIdent: string, itemId: string, options: any) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');

            const columns = await client.getProjectColumns(project.id, options.statusField);
            if (columns.length === 0) {
                throw new Error(`Status field "${options.statusField}" not found or has no options`);
            }

            const normalize = (s: string) => String(s || '').trim().toLowerCase();
            const desired = normalize(options.status);
            const col = columns.find((c) => normalize(c.name) === desired);
            if (!col?.optionId) {
                const available = columns.map((c) => c.name).join(', ');
                throw new Error(`Unknown status "${options.status}". Available: ${available}`);
            }

            await client.moveIssue({
                issueId: itemId,
                projectId: project.id,
                statusFieldId: columns[0].id,
                statusOptionId: col.optionId,
            });

            printOutput({ success: true, owner, project: projectIdent, itemId, status: col.name }, () => {
                console.log(`✅ Item moved to "${col.name}" successfully`);
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('draft-create')
    .description('Create a draft issue in a project')
    .argument('<owner>', 'Project owner')
    .argument('<project>', 'Project number or title')
    .argument('<title>', 'Draft title')
    .option('-b, --body <body>', 'Draft body')
    .action(async (owner, projectIdent, title, options) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');
            const itemId = await client.addDraftItem({
                projectId: project.id,
                title,
                body: options.body,
            });
            printOutput({ success: true, itemId, projectId: project.id }, () => {
                console.log(`✅ Draft created. Item ID: ${itemId}`);
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('item-show')
    .description('Show details for a project item by item ID')
    .argument('<itemId>', 'Project item ID (PVTI_...)')
    .option('-s, --status-field <name>', 'Name of the status field', 'Status')
    .action(async (itemId: string, options: any) => {
        try {
            const item = await client.getProjectItem(itemId, options.statusField);
            if (!item) throw new Error('Item not found');

            printOutput(item, () => {
                console.log(`\n🧩 Project Item: ${item.id}`);
                console.log(`Archived: ${item.isArchived ? 'yes' : 'no'}`);
                if (item.project) {
                    console.log(`Project:  ${item.project.title} (#${item.project.number})`);
                    console.log(`Project ID: ${item.project.id}`);
                }
                if (item.status) {
                    console.log(`Status:  ${item.status}`);
                }
                if (item.content) {
                    console.log(`Type:    ${item.content.__typename || 'N/A'}`);
                    if (item.content.title) console.log(`Title:   ${item.content.title}`);
                    if (item.content.url) console.log(`URL:     ${item.content.url}`);
                    if (item.content.repository) console.log(`Repo:    ${item.content.repository}`);
                    if (item.content.id) console.log(`Node ID: ${item.content.id}`);
                }
                console.log('');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('item-archive')
    .description('Archive or unarchive a project item')
    .argument('<owner>', 'Project owner')
    .argument('<project>', 'Project number or title')
    .argument('<itemId>', 'Item ID')
    .option('--unarchive', 'Unarchive the item', false)
    .action(async (owner, projectIdent, itemId, options) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');
            await client.archiveProjectItem({
                projectId: project.id,
                itemId,
                archived: !options.unarchive,
            });
            printOutput({ success: true, itemId, archived: !options.unarchive }, () => {
                console.log(`✅ Item ${options.unarchive ? 'unarchived' : 'archived'} successfully`);
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('item-delete')
    .description('Delete an item from a project')
    .argument('<owner>', 'Project owner')
    .argument('<project>', 'Project number or title')
    .argument('<itemId>', 'Item ID')
    .action(async (owner, projectIdent, itemId) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');
            await client.deleteProjectItem({
                projectId: project.id,
                itemId,
            });
            printOutput({ success: true, itemId }, () => {
                console.log('✅ Item deleted from project successfully');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-close')
    .description('Close a repository issue')
    .argument('<issueId>', 'Issue node ID')
    .action(async (issueId) => {
        try {
            await client.closeIssue(issueId);
            printOutput({ success: true, issueId }, () => {
                console.log('✅ Issue closed successfully');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-delete')
    .description('Delete an issue (GitHub API limitation: this closes the issue)')
    .argument('<issueId>', 'Issue node ID')
    .action(async (issueId: string) => {
        try {
            await client.closeIssue(issueId);
            printOutput({ success: true, issueId, deleted: false, closed: true }, () => {
                console.log('✅ Issue closed (hard-delete is not supported by GitHub APIs)');
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program
    .command('issue-add-to-project')
    .description('Add an existing issue/PR to a project')
    .argument('<owner>', 'Project owner')
    .argument('<project>', 'Project number or title')
    .argument('<issueId>', 'Issue node ID')
    .action(async (owner, projectIdent, issueId) => {
        try {
            const project = await client.resolveProject(owner, projectIdent);
            if (!project) throw new Error('Project not found');
            const itemId = await client.addProjectItem({
                projectId: project.id,
                contentId: issueId,
            });

            printOutput({ success: true, itemId, projectId: project.id }, () => {
                console.log(`✅ Issue added to project. Item ID: ${itemId}`);
            });
        } catch (error: any) {
            handleError(error);
        }
    });

program.parse();
