import type {
  CheckConclusion,
  IssueCommentSnapshot,
  IssueRef,
  PullCommit,
  PullRequestRef,
  PullRequestSnapshot,
  RepoCoordinates,
  RepoFile,
} from '../../src/core/types';
import type { GitHubClient, IssueSnapshot } from '../../src/github/client';

type StoredIssue = IssueSnapshot & {
  labels: string[];
  comments: IssueCommentSnapshot[];
};

type StoredFileWrite = {
  path: string;
  content: string;
  message: string;
  sha?: string;
  branch?: string;
};

type StoredCheckRun = {
  name: string;
  headSha: string;
  conclusion: CheckConclusion;
  title: string;
  summary: string;
};

type RepoState = {
  refs: Map<string, Map<string, RepoFile>>;
  pulls: Map<number, PullRequestSnapshot>;
  commits: Map<number, PullCommit[]>;
  commitParents: Map<string, string[]>;
  issues: Map<number, StoredIssue>;
  fileWrites: StoredFileWrite[];
  checkRuns: StoredCheckRun[];
  nextIssueNumber: number;
  nextCommentId: number;
  nextSha: number;
  defaultRef: string;
};

function repoKey(input: RepoCoordinates): string {
  return `${input.owner}/${input.repo}`;
}

function fileHtmlUrl(input: RepoCoordinates & { path: string; ref?: string }): string {
  return `https://github.com/${input.owner}/${input.repo}/blob/${input.ref ?? 'main'}/${input.path}`;
}

function issueHtmlUrl(input: RepoCoordinates & { issueNumber: number }): string {
  return `https://github.com/${input.owner}/${input.repo}/issues/${input.issueNumber}`;
}

export class MemoryGitHubClient implements GitHubClient {
  private readonly repos = new Map<string, RepoState>();

  seedFile(input: RepoCoordinates & { path: string; content: string; sha?: string; ref?: string }): void {
    const state = this.ensureRepo(input);
    this.ensureRef(state, input.ref ?? state.defaultRef).set(input.path, {
      content: input.content,
      sha: input.sha ?? `sha-${state.nextSha++}`,
      htmlUrl: fileHtmlUrl(input),
    });
  }

  seedPullRequest(pullRequest: PullRequestSnapshot, commits: PullCommit[] = []): void {
    const state = this.ensureRepo(pullRequest);
    state.pulls.set(pullRequest.pullNumber, pullRequest);
    state.commits.set(pullRequest.pullNumber, commits);
    state.issues.set(pullRequest.pullNumber, {
      number: pullRequest.pullNumber,
      title: `PR #${pullRequest.pullNumber}`,
      body: '',
      htmlUrl: issueHtmlUrl({ ...pullRequest, issueNumber: pullRequest.pullNumber }),
      labels: [],
      comments: [],
    });
    state.nextIssueNumber = Math.max(state.nextIssueNumber, pullRequest.pullNumber + 1);
  }

  seedCommit(input: RepoCoordinates & { sha: string; parentShas?: string[] }): void {
    this.ensureRepo(input).commitParents.set(input.sha, [...(input.parentShas ?? [])]);
  }

  setPullRequestCommits(input: PullRequestRef, commits: PullCommit[]): void {
    this.ensureRepo(input).commits.set(input.pullNumber, commits);
  }

  getIssueByTitle(input: RepoCoordinates & { title: string }): StoredIssue | undefined {
    return [...this.ensureRepo(input).issues.values()].find(issue => issue.title === input.title);
  }

  getIssueComments(input: IssueRef): IssueCommentSnapshot[] {
    return [...this.ensureIssue(input).comments];
  }

  seedIssueComment(input: IssueRef & { body: string; userLogin: string; createdAt?: string; updatedAt?: string }): void {
    const issue = this.ensureIssue(input);
    const state = this.ensureRepo(input);

    issue.comments.push({
      id: state.nextCommentId++,
      body: input.body,
      userLogin: input.userLogin,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
    });
  }

  getCheckRuns(input: RepoCoordinates): StoredCheckRun[] {
    return [...this.ensureRepo(input).checkRuns];
  }

  getFileWrites(input: RepoCoordinates): StoredFileWrite[] {
    return [...this.ensureRepo(input).fileWrites];
  }

  getFile(input: RepoCoordinates & { path: string; ref?: string }): RepoFile | undefined {
    return this.refFiles(this.ensureRepo(input), input.ref)?.get(input.path);
  }

  async readFile(input: RepoCoordinates & { path: string; ref?: string }): Promise<RepoFile | null> {
    return this.refFiles(this.ensureRepo(input), input.ref)?.get(input.path) ?? null;
  }

  async writeFile(input: RepoCoordinates & {
    path: string;
    content: string;
    message: string;
    sha?: string;
    branch?: string;
  }): Promise<RepoFile> {
    const state = this.ensureRepo(input);
    const ref = input.branch ?? state.defaultRef;
    const file = {
      content: input.content,
      sha: `sha-${state.nextSha++}`,
      htmlUrl: fileHtmlUrl({ ...input, ref }),
    };

    this.ensureRef(state, ref).set(input.path, file);
    state.fileWrites.push({
      path: input.path,
      content: input.content,
      message: input.message,
      ...(input.sha ? { sha: input.sha } : {}),
      ...(input.branch ? { branch: input.branch } : {}),
    });

    return file;
  }

  async ensureBranch(input: RepoCoordinates & { branch: string }): Promise<void> {
    const state = this.ensureRepo(input);

    if (state.refs.has(input.branch)) {
      return;
    }

    const files = new Map<string, RepoFile>();
    for (const [path, file] of this.ensureRef(state, state.defaultRef).entries()) {
      files.set(path, { ...file });
    }

    state.refs.set(input.branch, files);
  }

  async getPullRequest(input: PullRequestRef): Promise<PullRequestSnapshot> {
    const pullRequest = this.ensureRepo(input).pulls.get(input.pullNumber);

    if (!pullRequest) {
      throw new Error(`Unknown pull request ${input.pullNumber}`);
    }

    return pullRequest;
  }

  async listPullRequestCommits(input: PullRequestRef): Promise<PullCommit[]> {
    return [...(this.ensureRepo(input).commits.get(input.pullNumber) ?? [])];
  }

  async isCommitAncestor(input: RepoCoordinates & { ancestorSha: string; descendantSha: string }): Promise<boolean> {
    if (input.ancestorSha === input.descendantSha) {
      return true;
    }

    const visited = new Set<string>();
    const stack = [input.descendantSha];
    const state = this.ensureRepo(input);

    while (stack.length > 0) {
      const sha = stack.pop();

      if (!sha || visited.has(sha)) {
        continue;
      }

      visited.add(sha);

      for (const parent of state.commitParents.get(sha) ?? []) {
        if (parent === input.ancestorSha) {
          return true;
        }

        stack.push(parent);
      }
    }

    return false;
  }

  async listIssueComments(input: IssueRef): Promise<IssueCommentSnapshot[]> {
    return [...this.ensureIssue(input).comments];
  }

  async findIssueByTitle(input: RepoCoordinates & { title: string }): Promise<IssueSnapshot | null> {
    return this.getIssueByTitle(input) ?? null;
  }

  async createIssue(input: RepoCoordinates & { title: string; body: string; labels: string[] }): Promise<IssueSnapshot> {
    const state = this.ensureRepo(input);
    const number = state.nextIssueNumber++;
    const issue: StoredIssue = {
      number,
      title: input.title,
      body: input.body,
      htmlUrl: issueHtmlUrl({ ...input, issueNumber: number }),
      labels: [...input.labels],
      comments: [],
    };

    state.issues.set(issue.number, issue);
    return issue;
  }

  async updateIssue(input: IssueRef & { body: string; labels?: string[] }): Promise<IssueSnapshot> {
    const issue = this.ensureIssue(input);
    issue.body = input.body;

    if (input.labels) {
      issue.labels = [...input.labels];
    }

    return issue;
  }

  async createIssueComment(input: IssueRef & { body: string }): Promise<IssueCommentSnapshot> {
    const issue = this.ensureIssue(input);
    const state = this.ensureRepo(input);
    const comment: IssueCommentSnapshot = {
      id: state.nextCommentId++,
      body: input.body,
      userLogin: 'cla-bot',
      createdAt: new Date('2026-04-02T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-04-02T00:00:00Z').toISOString(),
    };

    issue.comments.push(comment);
    return comment;
  }

  async updateIssueComment(input: RepoCoordinates & { commentId: number; body: string }): Promise<IssueCommentSnapshot> {
    for (const issue of this.ensureRepo(input).issues.values()) {
      const comment = issue.comments.find(entry => entry.id === input.commentId);

      if (comment) {
        comment.body = input.body;
        comment.updatedAt = new Date('2026-04-02T00:00:00Z').toISOString();
        return comment;
      }
    }

    throw new Error(`Unknown comment ${input.commentId}`);
  }

  async createCheckRun(input: RepoCoordinates & {
    name: string;
    headSha: string;
    conclusion: CheckConclusion;
    title: string;
    summary: string;
  }): Promise<void> {
    this.ensureRepo(input).checkRuns.push({
      name: input.name,
      headSha: input.headSha,
      conclusion: input.conclusion,
      title: input.title,
      summary: input.summary,
    });
  }

  private ensureRepo(input: RepoCoordinates): RepoState {
    const key = repoKey(input);
    const existing = this.repos.get(key);

    if (existing) {
      return existing;
    }

    const created: RepoState = {
      refs: new Map([['main', new Map()]]),
      pulls: new Map(),
      commits: new Map(),
      commitParents: new Map(),
      issues: new Map(),
      fileWrites: [],
      checkRuns: [],
      nextIssueNumber: 1,
      nextCommentId: 1,
      nextSha: 1,
      defaultRef: 'main',
    };

    this.repos.set(key, created);
    return created;
  }

  private ensureIssue(input: IssueRef): StoredIssue {
    const state = this.ensureRepo(input);
    const issue = state.issues.get(input.issueNumber);

    if (issue) {
      return issue;
    }

    const created: StoredIssue = {
      number: input.issueNumber,
      title: `Issue #${input.issueNumber}`,
      body: '',
      htmlUrl: issueHtmlUrl(input),
      labels: [],
      comments: [],
    };

    state.issues.set(input.issueNumber, created);
    state.nextIssueNumber = Math.max(state.nextIssueNumber, input.issueNumber + 1);
    return created;
  }

  private refFiles(state: RepoState, ref?: string): Map<string, RepoFile> | undefined {
    return state.refs.get(ref ?? state.defaultRef);
  }

  private ensureRef(state: RepoState, ref: string): Map<string, RepoFile> {
    const existing = state.refs.get(ref);

    if (existing) {
      return existing;
    }

    const created = new Map<string, RepoFile>();
    state.refs.set(ref, created);
    return created;
  }
}
