import type { Octokit } from "@octokit/rest";
import type { CommentResult, GitHubRepoRef, IssueCreateResult } from "../types.js";

export async function createIssue(
  octokit: Octokit,
  repo: GitHubRepoRef,
  input: { title: string; body?: string; labels?: string[] },
): Promise<IssueCreateResult> {
  const response = await octokit.rest.issues.create({
    owner: repo.owner,
    repo: repo.repo,
    title: input.title,
    body: input.body,
    labels: input.labels ?? [],
  });
  return {
    number: response.data.number,
    url: response.data.html_url,
    nodeId: response.data.node_id,
  };
}

export async function commentIssue(
  octokit: Octokit,
  repo: GitHubRepoRef,
  input: { number: number; body: string },
): Promise<CommentResult> {
  const response = await octokit.rest.issues.createComment({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: input.number,
    body: input.body,
  });
  return {
    id: String(response.data.id),
    url: response.data.html_url,
  };
}

export async function findOpenIssueByExactTitle(
  octokit: Octokit,
  repo: GitHubRepoRef,
  title: string,
): Promise<{ number: number; url: string } | null> {
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: repo.owner,
    repo: repo.repo,
    state: "open",
    per_page: 100,
  });
  const match = issues.find((issue) => !issue.pull_request && issue.title === title);
  if (!match) {
    return null;
  }
  return { number: match.number, url: match.html_url };
}
