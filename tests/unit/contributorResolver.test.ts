import { describe, expect, it } from 'vitest';

import { parseClaConfig } from '../../src/core/config';
import { resolveContributors, resolveContributorsFromSnapshot } from '../../src/contributors/contributorResolver';
import { claConfigYaml, commit, pullRequest } from '../support/fixtures';
import { MemoryGitHubClient } from '../support/memoryGitHubClient';

describe('resolveContributorsFromSnapshot', () => {
  it('includes the PR author', () => {
    const contributors = resolveContributorsFromSnapshot(pullRequest(), [], parseClaConfig(claConfigYaml()));
    expect(contributors.map(item => item.githubLogin)).toEqual(['alice']);
  });

  it('dedupes commit authors', () => {
    const contributors = resolveContributorsFromSnapshot(
      pullRequest(),
      [commit('alice'), commit('bob'), commit('bob')],
      parseClaConfig(claConfigYaml()),
    );

    expect(contributors.map(item => item.githubLogin)).toEqual(['alice', 'bob']);
  });

  it('filters bots', () => {
    const contributors = resolveContributorsFromSnapshot(
      pullRequest({ authorLogin: 'dependabot[bot]' }),
      [commit('github-actions[bot]')],
      parseClaConfig(claConfigYaml()),
    );

    expect(contributors).toEqual([]);
  });

  it('filters bot PR authors reported by GitHub without a [bot] suffix', () => {
    const contributors = resolveContributorsFromSnapshot(
      pullRequest({ authorLogin: 'copilot', authorIsBot: true }),
      [],
      parseClaConfig(claConfigYaml()),
    );

    expect(contributors).toEqual([]);
  });

  it('filters bot commit authors reported by GitHub without a [bot] suffix', () => {
    const contributors = resolveContributorsFromSnapshot(
      pullRequest(),
      [commit('copilot', 'feat: generated change', { authorIsBot: true })],
      parseClaConfig(claConfigYaml()),
    );

    expect(contributors.map(item => item.githubLogin)).toEqual(['alice']);
  });

  it('filters allowlist entries', () => {
    const contributors = resolveContributorsFromSnapshot(
      pullRequest(),
      [commit('release-bot')],
      parseClaConfig(claConfigYaml({ allowlist: ['release-bot'] })),
    );

    expect(contributors.map(item => item.githubLogin)).toEqual(['alice']);
  });

  it('ignores merge commits that only sync the base branch into the PR branch', async () => {
    const client = new MemoryGitHubClient();
    const snapshot = pullRequest({ baseSha: 'base-3' });

    client.seedPullRequest(snapshot, [
      commit('alice'),
      commit('loverustfs', "Merge branch 'main' into feature", {
        parentShas: ['feature-1', 'base-1'],
      }),
    ]);
    client.seedCommit({ owner: 'app', repo: 'demo', sha: 'base-3', parentShas: ['base-2'] });
    client.seedCommit({ owner: 'app', repo: 'demo', sha: 'base-2', parentShas: ['base-1'] });

    const contributors = await resolveContributors({
      client,
      pullRequest: snapshot,
      config: parseClaConfig(claConfigYaml()),
    });

    expect(contributors.map(item => item.githubLogin)).toEqual(['alice']);
  });

  it('keeps merge commit authors when the merged parent is not on the base branch history', async () => {
    const client = new MemoryGitHubClient();
    const snapshot = pullRequest({ baseSha: 'base-3' });

    client.seedPullRequest(snapshot, [
      commit('alice'),
      commit('bob', "Merge branch 'topic' into feature", {
        parentShas: ['feature-1', 'topic-1'],
      }),
    ]);
    client.seedCommit({ owner: 'app', repo: 'demo', sha: 'base-3', parentShas: ['base-2'] });
    client.seedCommit({ owner: 'app', repo: 'demo', sha: 'base-2', parentShas: ['base-1'] });

    const contributors = await resolveContributors({
      client,
      pullRequest: snapshot,
      config: parseClaConfig(claConfigYaml()),
    });

    expect(contributors.map(item => item.githubLogin)).toEqual(['alice', 'bob']);
  });
});
