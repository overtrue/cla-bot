import { describe, expect, it } from 'vitest';

import { handleIssueComment } from '../../src/action/handleIssueComment';
import { handlePullRequestTarget } from '../../src/action/handlePullRequestTarget';
import { claConfigYaml, commit, pullRequest } from '../support/fixtures';
import { MemoryGitHubClient } from '../support/memoryGitHubClient';

describe('CLA action flow', () => {
  it('fails a PR when the author has not signed', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const comment = client.getIssueComments({ owner: 'app', repo: 'demo', issueNumber: 1 }).at(-1);

    expect(check?.conclusion).toBe('failure');
    expect(check?.summary).toContain('@alice');
    expect(comment?.body).toContain('<!-- cla-bot -->');
  });

  it('turns green after a matching signature comment', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const registryIssue = client.getIssueByTitle({ owner: 'overtrue', repo: 'cla-registry', title: 'CLA - alice' });
    const prComment = client.getIssueComments({ owner: 'app', repo: 'demo', issueNumber: 1 }).at(-1);

    expect(check?.conclusion).toBe('success');
    expect(registryIssue).toBeDefined();
    expect(prComment?.body).toContain('CLA requirements are satisfied');
  });

  it('stays red when only part of the contributor set has signed', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.seedPullRequest(pullRequest(), [commit('bob')]);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    expect(check?.conclusion).toBe('failure');
    expect(check?.summary).toContain('@bob');
  });

  it('returns to success after the last missing contributor signs', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.seedPullRequest(pullRequest(), [commit('bob')]);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      comment: {
        id: 101,
        body: 'I have read and agree to the CLA.',
        userLogin: 'bob',
        createdAt: '2026-04-02T10:05:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    expect(check?.conclusion).toBe('success');
  });

  it('fails again after a force-push adds a new contributor', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({ checkCommitAuthors: false }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.setPullRequestCommits({ owner: 'app', repo: 'demo', pullNumber: 1 }, [commit('charlie')]);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    expect(check?.conclusion).toBe('failure');
    expect(check?.summary).toContain('@charlie');
  });

  it('invalidates old signatures when the CLA version changes', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({ version: 'v1' }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({ version: 'v2' }),
    });

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1 });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    expect(check?.conclusion).toBe('failure');
    expect(check?.summary).toContain('v2');
  });
});
