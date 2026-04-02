import { describe, expect, it } from 'vitest';

import { parseClaConfig } from '../../src/core/config';
import { resolveContributorsFromSnapshot } from '../../src/contributors/contributorResolver';
import { claConfigYaml, commit, pullRequest } from '../support/fixtures';

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

  it('filters allowlist entries', () => {
    const contributors = resolveContributorsFromSnapshot(
      pullRequest(),
      [commit('release-bot')],
      parseClaConfig(claConfigYaml({ allowlist: ['release-bot'] })),
    );

    expect(contributors.map(item => item.githubLogin)).toEqual(['alice']);
  });
});
