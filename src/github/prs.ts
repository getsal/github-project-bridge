import type { Octokit } from "@octokit/rest";
import type { CommentResult, GitHubRepoRef } from "../types.js";

export async function commentPullRequestConversation(
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
