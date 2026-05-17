export async function commentPullRequestConversation(octokit, repo, input) {
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
