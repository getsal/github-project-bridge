#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { formatGitHubError } from "./github/client.js";
import { GitHubProjectsBridge } from "./core/bridge.js";
function toJson(value) {
    return JSON.stringify(value, null, 2);
}
function print(value) {
    process.stdout.write(`${value}\n`);
}
function printJson(value) {
    print(toJson(value));
}
function buildImportMarkdown(report) {
    const lines = [
        "# Import Report",
        `- source: ${report.sourceFile}`,
        `- dryRun: ${report.dryRun}`,
        `- limit: ${report.limit}`,
        `- processed: ${report.processed}`,
        `- created: ${report.created}`,
        `- skipped: ${report.skipped}`,
        `- failed: ${report.failed}`,
        "",
        "## Rows",
    ];
    for (const row of report.rows) {
        lines.push(`- row ${row.row}: ${row.title} [${row.status}]`);
        if (row.issue)
            lines.push(`  - issue: #${row.issue.number} ${row.issue.url}`);
        if (row.projectItemId)
            lines.push(`  - projectItemId: ${row.projectItemId}`);
        if (row.warnings.length)
            lines.push(`  - warnings: ${row.warnings.join(" | ")}`);
        if (row.error)
            lines.push(`  - error: ${row.error}`);
    }
    return lines.join("\n");
}
async function main() {
    const program = new Command();
    program.name("github-projects-bridge").option("--json", "Output machine-readable JSON");
    program
        .command("whoami")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const result = await bridge.whoami();
            if (options.json || program.opts().json) {
                printJson(result);
                return;
            }
            print(`Authenticated login: ${result.login}`);
            print(`Accessible repo: ${result.repo.nameWithOwner} (${result.repo.id})`);
            print(`Project: #${result.project.number} ${result.project.title}`);
            print(`Project ID: ${result.project.id}`);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("project:list-items")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const result = await bridge.listProjectItems();
            if (options.json || program.opts().json) {
                printJson(result.items);
                return;
            }
            print(`Project #${result.project.number}: ${result.project.title}`);
            for (const item of result.items) {
                print(`- ${item.title}`);
                print(`  - id: ${item.id}`);
                print(`  - type: ${item.contentType}`);
                print(`  - number: ${item.number ?? "-"}`);
                print(`  - status: ${item.status ?? "-"}`);
                print(`  - priority: ${item.priority ?? "-"}`);
                print(`  - labels: ${item.labels.length ? item.labels.join(", ") : "-"}`);
                print(`  - url: ${item.url ?? "-"}`);
            }
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("issue:create")
        .requiredOption("--title <title>")
        .option("--body-file <path>")
        .option("--labels <labels>")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const body = options.bodyFile ? readFileSync(options.bodyFile, "utf8") : undefined;
            const labels = String(options.labels ?? "")
                .split(/[;,|]/)
                .map((part) => part.trim())
                .filter(Boolean);
            const result = await bridge.createIssue({ title: options.title, body, labels });
            if (options.json || program.opts().json) {
                printJson(result);
                return;
            }
            print(`Issue created: #${result.number}`);
            print(`URL: ${result.url}`);
            print(`Node ID: ${result.nodeId}`);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("project:add-issue")
        .requiredOption("--issue-number <number>")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const issueNumber = Number(options.issueNumber);
            const issue = await bridge.octokit.rest.issues.get({
                owner: bridge.env.GITHUB_OWNER,
                repo: bridge.env.GITHUB_REPO,
                issue_number: issueNumber,
            });
            const result = await bridge.addIssueToProject(bridge.env.GITHUB_OWNER, bridge.env.GITHUB_PROJECT_NUMBER, issue.data.node_id);
            if (options.json || program.opts().json) {
                printJson({ itemId: result.itemId });
                return;
            }
            print(`Project item id: ${result.itemId}`);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("project:set-field")
        .requiredOption("--item-id <id>")
        .requiredOption("--field <name>")
        .requiredOption("--value <value>")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const project = await bridge.getConfiguredProject();
            const result = await bridge.setProjectField({
                projectId: project.id,
                itemId: options.itemId,
                fieldName: options.field,
                value: options.value,
            });
            if (options.json || program.opts().json) {
                printJson(result);
                return;
            }
            print(`Project item id: ${result.projectItemId}`);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("issue:comment")
        .requiredOption("--number <number>")
        .option("--body-file <path>")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const body = options.bodyFile ? readFileSync(options.bodyFile, "utf8") : "";
            const result = await bridge.commentIssue({ number: Number(options.number), body });
            if (options.json || program.opts().json) {
                printJson(result);
                return;
            }
            print(`Comment created: ${result.id}`);
            if (result.url)
                print(`URL: ${result.url}`);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("pr:review-comment")
        .requiredOption("--pr-number <number>")
        .option("--body-file <path>")
        .option("--json", "Output machine-readable JSON")
        .action(async (options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const body = options.bodyFile ? readFileSync(options.bodyFile, "utf8") : "";
            const result = await bridge.commentPullRequest({ number: Number(options.prNumber), body });
            if (options.json || program.opts().json) {
                printJson(result);
                return;
            }
            print(`PR conversation comment created: ${result.id}`);
            if (result.url)
                print(`URL: ${result.url}`);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    program
        .command("import:csv")
        .argument("<file>")
        .option("--dry-run")
        .option("--limit <n>", "Limit rows processed", "20")
        .option("--skip-existing")
        .option("--json", "Output machine-readable JSON")
        .action(async (file, options) => {
        try {
            const bridge = GitHubProjectsBridge.fromEnv();
            const report = await bridge.importCsv({
                file,
                dryRun: Boolean(options.dryRun),
                limit: Number(options.limit ?? 20),
                skipExisting: Boolean(options.skipExisting),
            });
            if (options.json || program.opts().json) {
                printJson(report);
                return;
            }
            print(buildImportMarkdown(report));
            print("");
            printJson(report);
        }
        catch (error) {
            console.error(formatGitHubError(error));
            process.exitCode = 1;
        }
    });
    await program.parseAsync(process.argv);
}
main().catch((error) => {
    console.error(formatGitHubError(error));
    process.exitCode = 1;
});
