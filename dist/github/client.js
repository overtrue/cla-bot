"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OctokitGitHubClient = void 0;
exports.createGitHubClient = createGitHubClient;
const github_1 = require("@actions/github");
function isNotFound(error) {
    return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}
function decodeContent(content) {
    return Buffer.from(content, 'base64').toString('utf8');
}
function mapIssueComment(comment) {
    return {
        id: comment.id,
        body: comment.body ?? '',
        userLogin: comment.user?.login ?? null,
        ...(comment.created_at ? { createdAt: comment.created_at } : {}),
    };
}
class OctokitGitHubClient {
    octokit;
    constructor(octokit) {
        this.octokit = octokit;
    }
    async readFile(input) {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: input.owner,
                repo: input.repo,
                path: input.path,
                ...(input.ref ? { ref: input.ref } : {}),
            });
            if (Array.isArray(response.data) || response.data.type !== 'file') {
                throw new Error(`Expected a file at ${input.path}`);
            }
            return {
                content: decodeContent(response.data.content),
                sha: response.data.sha,
            };
        }
        catch (error) {
            if (isNotFound(error)) {
                return null;
            }
            throw error;
        }
    }
    async writeFile(input) {
        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: input.owner,
            repo: input.repo,
            path: input.path,
            message: input.message,
            content: Buffer.from(input.content, 'utf8').toString('base64'),
            ...(input.sha ? { sha: input.sha } : {}),
        });
    }
    async getPullRequest(input) {
        const response = await this.octokit.rest.pulls.get({
            owner: input.owner,
            repo: input.repo,
            pull_number: input.pullNumber,
        });
        return {
            owner: input.owner,
            repo: input.repo,
            pullNumber: input.pullNumber,
            authorLogin: response.data.user?.login ?? null,
            headSha: response.data.head.sha,
            baseRef: response.data.base.ref,
            htmlUrl: response.data.html_url,
        };
    }
    async listPullRequestCommits(input) {
        const commits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
            owner: input.owner,
            repo: input.repo,
            pull_number: input.pullNumber,
            per_page: 100,
        });
        return commits.map(commit => ({
            authorLogin: commit.author?.login ?? null,
            message: commit.commit.message,
        }));
    }
    async listIssueComments(input) {
        const comments = await this.octokit.paginate(this.octokit.rest.issues.listComments, {
            owner: input.owner,
            repo: input.repo,
            issue_number: input.issueNumber,
            per_page: 100,
        });
        return comments.map(mapIssueComment);
    }
    async findIssueByTitle(input) {
        const phrase = input.title.replaceAll('"', '\\"');
        const results = await this.octokit.rest.search.issuesAndPullRequests({
            q: [`repo:${input.owner}/${input.repo}`, 'is:issue', 'in:title', `"${phrase}"`].join(' '),
            per_page: 10,
        });
        const match = results.data.items.find(item => !item.pull_request && item.title === input.title);
        if (!match) {
            return null;
        }
        const issue = await this.octokit.rest.issues.get({
            owner: input.owner,
            repo: input.repo,
            issue_number: match.number,
        });
        return {
            number: issue.data.number,
            title: issue.data.title,
            body: issue.data.body ?? '',
        };
    }
    async createIssue(input) {
        const issue = await this.octokit.rest.issues.create({
            owner: input.owner,
            repo: input.repo,
            title: input.title,
            body: input.body,
            labels: input.labels,
        });
        return {
            number: issue.data.number,
            title: issue.data.title,
            body: issue.data.body ?? '',
        };
    }
    async updateIssue(input) {
        const issue = await this.octokit.rest.issues.update({
            owner: input.owner,
            repo: input.repo,
            issue_number: input.issueNumber,
            body: input.body,
            ...(input.labels ? { labels: input.labels } : {}),
        });
        return {
            number: issue.data.number,
            title: issue.data.title,
            body: issue.data.body ?? '',
        };
    }
    async createIssueComment(input) {
        const comment = await this.octokit.rest.issues.createComment({
            owner: input.owner,
            repo: input.repo,
            issue_number: input.issueNumber,
            body: input.body,
        });
        return mapIssueComment(comment.data);
    }
    async updateIssueComment(input) {
        const comment = await this.octokit.rest.issues.updateComment({
            owner: input.owner,
            repo: input.repo,
            comment_id: input.commentId,
            body: input.body,
        });
        return mapIssueComment(comment.data);
    }
    async createCheckRun(input) {
        await this.octokit.rest.checks.create({
            owner: input.owner,
            repo: input.repo,
            name: input.name,
            head_sha: input.headSha,
            status: 'completed',
            conclusion: input.conclusion,
            output: {
                title: input.title,
                summary: input.summary,
            },
        });
    }
}
exports.OctokitGitHubClient = OctokitGitHubClient;
function createGitHubClient(token) {
    return new OctokitGitHubClient((0, github_1.getOctokit)(token));
}
