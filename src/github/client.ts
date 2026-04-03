import { getOctokit } from '@actions/github';

import type {
  CheckConclusion,
  IssueCommentSnapshot,
  IssueRef,
  PullCommit,
  PullRequestRef,
  PullRequestSnapshot,
  RepoCoordinates,
  RepoFile,
} from '../core/types';

export type IssueSnapshot = {
  number: number;
  title: string;
  body: string;
  htmlUrl?: string;
};

export interface GitHubClient {
  readFile(input: RepoCoordinates & { path: string; ref?: string }): Promise<RepoFile | null>;
  writeFile(input: RepoCoordinates & { path: string; content: string; message: string; sha?: string; branch?: string }): Promise<RepoFile>;
  ensureBranch(input: RepoCoordinates & { branch: string }): Promise<void>;
  getPullRequest(input: PullRequestRef): Promise<PullRequestSnapshot>;
  listPullRequestCommits(input: PullRequestRef): Promise<PullCommit[]>;
  isCommitAncestor(input: RepoCoordinates & { ancestorSha: string; descendantSha: string }): Promise<boolean>;
  listIssueComments(input: IssueRef): Promise<IssueCommentSnapshot[]>;
  findIssueByTitle(input: RepoCoordinates & { title: string }): Promise<IssueSnapshot | null>;
  createIssue(input: RepoCoordinates & { title: string; body: string; labels: string[] }): Promise<IssueSnapshot>;
  updateIssue(input: IssueRef & { body: string; labels?: string[] }): Promise<IssueSnapshot>;
  createIssueComment(input: IssueRef & { body: string }): Promise<IssueCommentSnapshot>;
  updateIssueComment(input: RepoCoordinates & { commentId: number; body: string }): Promise<IssueCommentSnapshot>;
  createCheckRun(input: RepoCoordinates & {
    name: string;
    headSha: string;
    conclusion: CheckConclusion;
    title: string;
    summary: string;
  }): Promise<void>;
}

type Octokit = ReturnType<typeof getOctokit>;

function isNotFound(error: unknown): boolean {
  return getGitHubErrorStatus(error) === 404;
}

export function getGitHubErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null;
  }

  return typeof error.status === 'number' ? error.status : null;
}

function decodeContent(content: string): string {
  return Buffer.from(content, 'base64').toString('utf8');
}

type ApiIssueComment = {
  id: number;
  body?: string | null;
  user?: { login?: string | null } | null;
  created_at?: string;
};

function mapIssueComment(comment: ApiIssueComment): IssueCommentSnapshot {
  return {
    id: comment.id,
    body: comment.body ?? '',
    userLogin: comment.user?.login ?? null,
    ...(comment.created_at ? { createdAt: comment.created_at } : {}),
  };
}

export class OctokitGitHubClient implements GitHubClient {
  constructor(private readonly octokit: Octokit) {}

  async readFile(input: RepoCoordinates & { path: string; ref?: string }): Promise<RepoFile | null> {
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
        ...(response.data.html_url ? { htmlUrl: response.data.html_url } : {}),
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async writeFile(input: RepoCoordinates & {
    path: string;
    content: string;
    message: string;
    sha?: string;
    branch?: string;
  }): Promise<RepoFile> {
    const response = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      message: input.message,
      content: Buffer.from(input.content, 'utf8').toString('base64'),
      ...(input.sha ? { sha: input.sha } : {}),
      ...(input.branch ? { branch: input.branch } : {}),
    });

    return {
      content: input.content,
      sha: response.data.content?.sha ?? input.sha ?? 'written-file',
      ...(response.data.content?.html_url ? { htmlUrl: response.data.content.html_url } : {}),
    };
  }

  async ensureBranch(input: RepoCoordinates & { branch: string }): Promise<void> {
    try {
      await this.octokit.rest.repos.getBranch({
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
      });
      return;
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }

    const repo = await this.octokit.rest.repos.get({
      owner: input.owner,
      repo: input.repo,
    });
    const baseBranch = await this.octokit.rest.repos.getBranch({
      owner: input.owner,
      repo: input.repo,
      branch: repo.data.default_branch,
    });

    try {
      await this.octokit.rest.git.createRef({
        owner: input.owner,
        repo: input.repo,
        ref: `refs/heads/${input.branch}`,
        sha: baseBranch.data.commit.sha,
      });
    } catch (error) {
      if (getGitHubErrorStatus(error) === 422) {
        return;
      }

      throw error;
    }
  }

  async getPullRequest(input: PullRequestRef): Promise<PullRequestSnapshot> {
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
      baseSha: response.data.base.sha,
      htmlUrl: response.data.html_url,
    };
  }

  async listPullRequestCommits(input: PullRequestRef): Promise<PullCommit[]> {
    const commits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber,
      per_page: 100,
    });

    return commits.map(commit => ({
      authorLogin: commit.author?.login ?? null,
      message: commit.commit.message,
      parentShas: commit.parents.map(parent => parent.sha),
    }));
  }

  async isCommitAncestor(input: RepoCoordinates & { ancestorSha: string; descendantSha: string }): Promise<boolean> {
    const response = await this.octokit.rest.repos.compareCommits({
      owner: input.owner,
      repo: input.repo,
      base: input.ancestorSha,
      head: input.descendantSha,
    });

    return response.data.status === 'ahead' || response.data.status === 'identical';
  }

  async listIssueComments(input: IssueRef): Promise<IssueCommentSnapshot[]> {
    const comments = await this.octokit.paginate(this.octokit.rest.issues.listComments, {
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueNumber,
      per_page: 100,
    });

    return comments.map(mapIssueComment);
  }

  async findIssueByTitle(input: RepoCoordinates & { title: string }): Promise<IssueSnapshot | null> {
    const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
      owner: input.owner,
      repo: input.repo,
      state: 'all',
      per_page: 100,
    });

    const match = issues.find(issue => !('pull_request' in issue) && issue.title === input.title);

    if (!match || 'pull_request' in match) {
      return null;
    }

    return {
      number: match.number,
      title: match.title,
      body: match.body ?? '',
      ...(match.html_url ? { htmlUrl: match.html_url } : {}),
    };
  }

  async createIssue(input: RepoCoordinates & { title: string; body: string; labels: string[] }): Promise<IssueSnapshot> {
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
      ...(issue.data.html_url ? { htmlUrl: issue.data.html_url } : {}),
    };
  }

  async updateIssue(input: IssueRef & { body: string; labels?: string[] }): Promise<IssueSnapshot> {
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
      ...(issue.data.html_url ? { htmlUrl: issue.data.html_url } : {}),
    };
  }

  async createIssueComment(input: IssueRef & { body: string }): Promise<IssueCommentSnapshot> {
    const comment = await this.octokit.rest.issues.createComment({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueNumber,
      body: input.body,
    });

    return mapIssueComment(comment.data);
  }

  async updateIssueComment(input: RepoCoordinates & { commentId: number; body: string }): Promise<IssueCommentSnapshot> {
    const comment = await this.octokit.rest.issues.updateComment({
      owner: input.owner,
      repo: input.repo,
      comment_id: input.commentId,
      body: input.body,
    });

    return mapIssueComment(comment.data);
  }

  async createCheckRun(input: RepoCoordinates & {
    name: string;
    headSha: string;
    conclusion: CheckConclusion;
    title: string;
    summary: string;
  }): Promise<void> {
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

export function createGitHubClient(token: string): GitHubClient {
  return new OctokitGitHubClient(getOctokit(token));
}
