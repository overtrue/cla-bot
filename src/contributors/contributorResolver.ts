import type { ClaConfig, Contributor, PullCommit, PullRequestSnapshot } from '../core/types';
import type { GitHubClient } from '../github/client';
import { createContributor } from './normalizeContributor';
import { normalizeGitHubLogin } from '../utils/githubLogin';

const COAUTHOR_PATTERN =
  /Co-authored-by:\s*(?:.+?\s)?(?:\(@)?@([A-Za-z0-9-]+(?:\[bot\])?)/gi;

export function extractCoauthorLogins(message: string): string[] {
  return [...message.matchAll(COAUTHOR_PATTERN)].map((match) => normalizeGitHubLogin(match[1] ?? ''));
}

export function resolveContributorsFromSnapshot(
  pullRequest: PullRequestSnapshot,
  commits: PullCommit[],
  config: ClaConfig,
): Contributor[] {
  const allowlist = new Set(config.contributors.allowlist.map(normalizeGitHubLogin));
  const contributors = new Map<string, Contributor>();

  const add = (login: string | null, source: Contributor['source']): void => {
    if (!login) {
      return;
    }

    const contributor = createContributor(login, source);

    if (config.contributors.excludeBots && contributor.isBot) {
      return;
    }

    if (allowlist.has(contributor.githubLogin)) {
      return;
    }

    contributors.set(contributor.githubLogin, contributors.get(contributor.githubLogin) ?? contributor);
  };

  if (config.contributors.checkPrAuthor) {
    add(pullRequest.authorLogin, 'pr_author');
  }

  if (config.contributors.checkCommitAuthors) {
    for (const commit of commits) {
      add(commit.authorLogin, 'commit_author');
    }
  }

  if (config.contributors.checkCoauthors) {
    for (const commit of commits) {
      for (const login of extractCoauthorLogins(commit.message)) {
        add(login, 'coauthor');
      }
    }
  }

  return [...contributors.values()];
}

export async function resolveContributors(input: {
  client: GitHubClient;
  pullRequest: PullRequestSnapshot;
  config: ClaConfig;
}): Promise<Contributor[]> {
  const commits = await input.client.listPullRequestCommits(input.pullRequest);
  return resolveContributorsFromSnapshot(input.pullRequest, commits, input.config);
}
