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
GITHUB_TOKEN=
GITHUB_OWNER=YOUR_GITHUB_OWNER
GITHUB_REPO=YOUR_GITHUB_REPO
GITHUB_PROJECT_NUMBER=1
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

Run with Docker Compose:

```bash
docker compose up --build
```

Run a CLI command with Compose:

```bash
docker compose run --rm github-projects-bridge node dist/cli.js whoami
```

## Security

Never paste your PAT into chat. Keep it only in `.env` or your secret manager.

## Module Use

You can also import the shared service from another TypeScript project:

```ts
import { GitHubProjectsBridge } from "github-projects-bridge";

const bridge = GitHubProjectsBridge.fromEnv();
const result = await bridge.whoami();
```
