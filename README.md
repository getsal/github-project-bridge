# GitHub Projects v2 Bridge

Reusable GitHub Operations Adapter for GitHub Projects v2, issues, and PR comments.

The CLI and MCP server are thin interfaces on top of the same shared core service:
`GitHubProjectsBridge`.

## Setup

1. Install Node.js 20 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and set `GITHUB_TOKEN`.
4. Run the CLI:
   ```bash
   npm run cli -- whoami
   ```

## PAT Scopes

Classic PAT:

- `repo`
- `read:project`
- `project`

Fine-grained PAT:

- Repository access: your target repository
- Issues: Read/Write
- Pull requests: Read/Write
- Contents: Read
- Metadata: Read
- Projects: Read/Write

## Environment

Example:

```env
# GitHub personal access token with Projects and repo permissions.
GITHUB_TOKEN=

# GitHub account or organization that owns the Project v2 board.
GITHUB_PROJECT_OWNER=GH_ACCOUNTNAME

# Allowed: user | org
GITHUB_PROJECT_OWNER_TYPE=user

# Project v2 number, for example 1.
GITHUB_PROJECT_NUMBER=1

# GitHub account that owns the issue repository.
GITHUB_OWNER=YOUR_GITHUB_OWNER

# Repository that the bridge operates on.
GITHUB_REPO=<actual repo for issues>

```

## CLI

Check auth:

```bash
npm run cli -- whoami
```

List project items:

```bash
npm run cli -- project:list-items
```

Create issue:

```bash
npm run cli -- issue:create \
  --title "[BE] Example task" \
  --body-file ./tmp/body.md \
  --labels backend,p1
```

Add issue to project:

```bash
npm run cli -- project:add-issue --issue-number 12
```

Set project field:

```bash
npm run cli -- project:set-field \
  --item-id PROJECT_ITEM_ID \
  --field Status \
  --value "In Progress"
```

If you change Project v2 field handling, rebuild the Docker image before rerunning this command:

```bash
docker compose build
```

Import CSV:

```bash
npm run cli -- import:csv ./tasks.csv --limit 5
```

Comment on issue or PR:

```bash
npm run cli -- issue:comment --number 12 --body-file ./review.md
```

PR review helper:

```bash
npm run cli -- pr:review-comment --pr-number 7 --body-file ./review.md
```

Use `--json` on any command for machine-readable output.

## MCP

Run the MCP server over stdio:

```bash
npm run mcp
```

Claude Desktop example:

```json
{
  "mcpServers": {
    "github-projects-bridge": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/github-projects-bridge"
    }
  }
}
```

Codex example:

```json
{
  "mcpServers": {
    "github-projects-bridge": {
      "command": "docker",
      "args": ["compose", "run", "--rm", "-i", "github-projects-bridge"],
      "cwd": "/path/to/github-projects-bridge"
    }
  }
}
```

OpenClaw example:

```json
{
  "mcpServers": {
    "github-projects-bridge": {
      "command": "docker",
      "args": ["compose", "run", "--rm", "-i", "github-projects-bridge"],
      "cwd": "/path/to/github-projects-bridge"
    }
  }
}
```

## Docker

Build the image:

```bash
docker build -t github-projects-bridge .
```

Run the MCP server with an env file:

```bash
docker run --rm -it --env-file .env github-projects-bridge
```

Run a CLI command:

```bash
docker run --rm -it --env-file .env github-projects-bridge node dist/cli.js whoami
```

Run the stdio MCP server with Docker Compose:

```bash
docker compose run --rm -i github-projects-bridge
```

Smoke test the MCP path:

1. Build the image with `docker compose build`.
2. Start your MCP client with `docker compose run --rm -i github-projects-bridge`.
3. From the client, call the `whoami` tool.
4. Confirm the response includes the authenticated login, repo, and Project #1 title.

Smoke test the CLI path:

```bash
docker compose run --rm -i github-projects-bridge node dist/cli.js whoami
```

This command should print the authenticated login, the accessible repo, and the resolved Project #1 info.

Build the image with Compose:

```bash
docker compose build
```

Run a CLI command with Compose:

```bash
docker compose run --rm -i github-projects-bridge node dist/cli.js whoami
```

This server uses `stdio`, so it should be started by the MCP client, not left running as a long-lived Compose daemon.

## Security

Never paste your PAT into chat. Keep it only in `.env` or your secret manager.

## Module Use

You can also import the shared service from another TypeScript project:

```ts
import { GitHubProjectsBridge } from "github-projects-bridge";

const bridge = GitHubProjectsBridge.fromEnv();
const result = await bridge.whoami();
```
