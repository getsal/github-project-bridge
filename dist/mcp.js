#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatGitHubError } from "./github/client.js";
import { GitHubProjectsBridge } from "./core/bridge.js";
const listItemsInput = z.object({
    owner: z.string().min(1),
    projectNumber: z.number().int().positive(),
});
const issueCreateInput = z.object({
    repo: z.string().min(1),
    title: z.string().min(1),
    body: z.string().optional().default(""),
    labels: z.array(z.string().min(1)).optional().default([]),
});
const addIssueInput = z.object({
    owner: z.string().min(1),
    projectNumber: z.number().int().positive(),
    issueNodeId: z.string().min(1),
});
const setFieldInput = z.object({
    projectId: z.string().min(1),
    itemId: z.string().min(1),
    fieldName: z.string().min(1),
    value: z.string().min(1),
});
const commentInput = z.object({
    repo: z.string().min(1),
    number: z.number().int().positive(),
    body: z.string().min(1),
});
function jsonText(value) {
    return JSON.stringify(value, null, 2);
}
async function main() {
    const bridge = GitHubProjectsBridge.fromEnv();
    const server = new McpServer({
        name: "github-projects-bridge",
        version: "0.1.0",
    });
    server.registerTool("github_project_list_items", {
        title: "List GitHub Project Items",
        description: "List items from a GitHub Projects v2 board.",
        inputSchema: listItemsInput,
    }, async ({ owner, projectNumber }) => {
        try {
            const result = await bridge.listProjectItems(owner, projectNumber);
            return { content: [{ type: "text", text: jsonText(result) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: formatGitHubError(error) }], isError: true };
        }
    });
    server.registerTool("github_issue_create", {
        title: "Create GitHub Issue",
        description: "Create an issue in a repository.",
        inputSchema: issueCreateInput,
    }, async ({ repo, title, body, labels }) => {
        try {
            const issue = await bridge.createIssue({ repo, title, body, labels });
            return { content: [{ type: "text", text: jsonText(issue) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: formatGitHubError(error) }], isError: true };
        }
    });
    server.registerTool("github_project_add_issue", {
        title: "Add Issue to GitHub Project",
        description: "Add an issue or PR to a Projects v2 board.",
        inputSchema: addIssueInput,
    }, async ({ owner, projectNumber, issueNodeId }) => {
        try {
            const result = await bridge.addIssueToProject(owner, projectNumber, issueNodeId);
            return { content: [{ type: "text", text: jsonText(result) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: formatGitHubError(error) }], isError: true };
        }
    });
    server.registerTool("github_project_set_field", {
        title: "Set GitHub Project Field",
        description: "Set a single-select or text field on a Projects v2 item.",
        inputSchema: setFieldInput,
    }, async ({ projectId, itemId, fieldName, value }) => {
        try {
            const result = await bridge.setProjectField({ projectId, itemId, fieldName, value });
            return { content: [{ type: "text", text: jsonText(result) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: formatGitHubError(error) }], isError: true };
        }
    });
    server.registerTool("github_issue_comment", {
        title: "Comment on GitHub Issue or PR",
        description: "Post a top-level conversation comment on an issue or pull request.",
        inputSchema: commentInput,
    }, async ({ repo, number, body }) => {
        try {
            const result = await bridge.commentIssue({ repo, number, body });
            return { content: [{ type: "text", text: jsonText(result) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: formatGitHubError(error) }], isError: true };
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error(formatGitHubError(error));
    process.exitCode = 1;
});
