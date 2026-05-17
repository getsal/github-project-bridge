import { config as loadEnv } from "dotenv";
import { graphql as createGraphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";
import { envSchema } from "../types.js";
loadEnv();
export function loadGitHubEnv() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const message = parsed.error.issues.map((issue) => issue.message).join("; ");
        throw new Error(message);
    }
    return parsed.data;
}
export function parseRepoRef(repo) {
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
        throw new Error(`Invalid repo ref: ${repo}`);
    }
    return { owner, repo: name };
}
export function createGitHubClients(token) {
    const headers = {
        authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
    };
    const graphql = createGraphql.defaults({ headers });
    const octokit = new Octokit({ auth: token, userAgent: "github-projects-bridge/0.1.0", request: { headers } });
    return { graphql, octokit };
}
export function formatGitHubError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/bad credentials|requires authentication|401/i.test(message)) {
        return "GitHub authentication failed. Check GITHUB_TOKEN in .env.";
    }
    if (/resource not accessible by personal access token|read:project scope|project scope|insufficient permissions/i.test(message)) {
        return "GitHub Projects access denied. The PAT needs read:project and project scopes, or the fine-grained Projects permission.";
    }
    return message;
}
