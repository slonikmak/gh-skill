# GitHub Projects & Issues Toolkit (gh-skill)

A powerful toolkit for working with GitHub Projects (V2) and Issues. Includes a convenient CLI utility and a Node.js library for integration.

## 🚀 Installation

### Option 1: Install directly from GitHub (for CLI usage)
To make the `ghs` command available globally on your system:

```bash
npm install -g github:slonikmak/gh-skill
```

### Option 2: For Development
1. Clone the repository:
   ```bash
   git clone https://github.com/slonikmak/gh-skill.git
   cd gh-skill
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   npm link
   ```
Now the `ghs` command is available in your terminal.

## 🔐 Authentication

You can authenticate using either a Personal Access Token (PAT) or a GitHub App.

### Option A: GitHub App (Recommended)
This method is more secure and avoids rate limits.

1. **Create a GitHub App**:
   - Go to [Developer Settings > GitHub Apps](https://github.com/settings/apps).
   - Click "New GitHub App".
   - Name it (e.g., `my-project-helper`).
   - Disable "Webhook" (unless you need it for other things).
   - **Permissions**:
     - `Repository permissions`: Issues (Read & Write)
     - `Organization permissions`: Projects (Read & Write) (or `User permissions` if it's a user project)
   - Save the App.

2. **Get Credentials**:
   - **App ID**: Find it on the "General" page.
   - **Private Key**: Scroll down and generate a private key. It will download a `.pem` file.
   - **Install App**: Go to "Install App" on the left menu, and install it on your account/repositories. Note the **Installation ID** from the URL (e.g. `.../installations/123456`).

3. **Configure Environment**:
   Add these to your `.env` file:
   ```env
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   GITHUB_APP_INSTALLATION_ID=567890
   ```
   *Note: For the private key, replace newlines in the `.pem` file with `\n` to fit it on one line.*

### Option B: Personal Access Token (Legacy)
1. [Generate a token](https://github.com/settings/tokens) with `repo` and `project` scopes.
2. Add to `.env`:
   ```env
   GITHUB_TOKEN=your_token_here
   ```


### 🖥️ CLI Usage

After installation, use the `ghs` command.

**Global Options:**
- `-j, --json`: Output results in JSON format (useful for scripts and AI agents).

### 📋 Project Management

#### View Board
Shows a project board status and available columns.
```bash
ghs board <owner> <project_number> [--status-field "Status"]
```

#### List Items
Lists all issues and PRs currently on the project board.
```bash
ghs items <owner> <project_number> [--status-field "Status"]
```

### 🆕 Issue Management

#### Create Issue
Creates a new issue in a repository.
```bash
ghs issue-create <owner/repo> "<title>" [--body "<body>"]
```

#### Update Issue
Updates title or description of an existing issue.
```bash
ghs issue-update <issueNodeId> [--title "<new_title>"] [--body "<new_body>"]
```

#### Show Issue Details
```bash
ghs issue-show <owner/repo> <issue_number>
```

#### Comment on Issue
```bash
ghs issue-comment <issueNodeId> "Your comment here"
```

### 🚚 Project Item Operations

#### Move Item
Moves a project item to a different status column.
```bash
ghs issue-move <itemId> <projectId> <statusFieldId> <optionId>
```
*Note: IDs can be obtained via `ghs board` and `ghs items` commands.*

#### Add Issue to Project
```bash
ghs issue-add-to-project <owner> <project_number> <issueNodeId>
```

---

## 📦 Using as a Library

You can use `GitHubClient` in your own Node.js scripts.

```typescript
import { GitHubClient } from 'gh-skill';

const client = new GitHubClient(); // Uses env variables by default

async function main() {
    const project = await client.getProject('org-name', 1);
    const items = await client.getProjectItems(project.id);
    console.log(items);
}
```

## ⚠️ Limitations

- **Column Creation**: GitHub's GraphQL API doesn't support adding options to SingleSelectField. Use the GitHub UI to create new columns.
- **Project V2 Only**: This tool targets GitHub Projects V2 (the modern project boards). Classic Projects are not supported.

## Requirements
- Node.js >= 16
- GitHub App or Personal Access Token

## License
ISC
