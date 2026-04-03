import { describe, expect, it } from 'vitest';

import { handleIssueComment } from '../../src/action/handleIssueComment';
import { handlePullRequestTarget } from '../../src/action/handlePullRequestTarget';
import { claConfigYaml, commit, pullRequest } from '../support/fixtures';
import { MemoryGitHubClient } from '../support/memoryGitHubClient';

const registryAccess = { hasExplicitRegistryToken: true } as const;

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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });

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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
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

  it('turns green when the signer omits terminal punctuation', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const registryIssue = client.getIssueByTitle({ owner: 'overtrue', repo: 'cla-registry', title: 'CLA - alice' });

    expect(check?.conclusion).toBe('success');
    expect(registryIssue).toBeDefined();
  });

  it('turns green when the signer quotes instructions and adds the phrase on its own line', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml(),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
      comment: {
        id: 100,
        body: [
          '> This pull request requires CLA signatures before it can be merged.',
          '> ',
          '> `I have read and agree to the CLA.`',
          '',
          'I have read and agree to the CLA.',
        ].join('\n'),
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const registryIssue = client.getIssueByTitle({ owner: 'overtrue', repo: 'cla-registry', title: 'CLA - alice' });

    expect(check?.conclusion).toBe('success');
    expect(registryIssue).toBeDefined();
  });

  it('stays red when terminal punctuation is required by config', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({
        ignoreTerminalPunctuation: false,
      }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const registryIssue = client.getIssueByTitle({ owner: 'overtrue', repo: 'cla-registry', title: 'CLA - alice' });

    expect(check?.conclusion).toBe('failure');
    expect(registryIssue).toBeUndefined();
  });

  it('can render custom success templates with registry links', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({
        registryType: 'json-repo',
        templates: {
          prSuccessComment: 'Signed by everyone.\n\n{{registry_links_markdown}}',
          checkSuccessTitle: 'All signed',
          checkSuccessSummary: 'Stored records:\n\n{{registry_links_markdown}}',
        },
      }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const prComment = client.getIssueComments({ owner: 'app', repo: 'demo', issueNumber: 1 }).at(-1);

    expect(check?.title).toBe('All signed');
    expect(check?.summary).toContain('Stored records:');
    expect(prComment?.body).toContain('Signed by everyone.');
    expect(prComment?.body).toContain(
      'https://github.com/overtrue/cla-registry/blob/main/signatures/individual/alice.json',
    );
  });

  it('can render custom failure templates before anyone signs', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({
        templates: {
          prMissingComment: 'Still waiting on:\n\n{{missing_contributors_markdown}}',
          checkFailureTitle: 'Needs signatures',
          checkFailureSummary: 'Missing now:\n\n{{missing_contributors_markdown}}',
        },
      }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const prComment = client.getIssueComments({ owner: 'app', repo: 'demo', issueNumber: 1 }).at(-1);

    expect(check?.title).toBe('Needs signatures');
    expect(check?.summary).toContain('Missing now:');
    expect(prComment?.body).toContain('Still waiting on:');
    expect(prComment?.body).toContain('@alice');
  });

  it('can render custom success templates for the issue backend', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({
        templates: {
          prSuccessComment: 'Everyone signed.\n\n{{registry_links_markdown}}',
        },
      }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        userLogin: 'alice',
        createdAt: '2026-04-02T10:00:00Z',
      },
    });

    const prComment = client.getIssueComments({ owner: 'app', repo: 'demo', issueNumber: 1 }).at(-1);

    expect(prComment?.body).toContain('Everyone signed.');
    expect(prComment?.body).toContain('https://github.com/overtrue/cla-registry/issues/1');
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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
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
      ...registryAccess,
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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    expect(check?.conclusion).toBe('failure');
    expect(check?.summary).toContain('@charlie');
  });

  it('backfills matching signature comments during pull request reruns', async () => {
    const client = new MemoryGitHubClient();
    client.seedFile({
      owner: 'app',
      repo: 'demo',
      path: '.github/cla.yml',
      content: claConfigYaml({ registryType: 'json-repo' }),
    });
    client.seedPullRequest(pullRequest(), []);

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    client.seedIssueComment({
      owner: 'app',
      repo: 'demo',
      issueNumber: 1,
      body: 'I have read and agree to the CLA.',
      userLogin: 'alice',
      createdAt: '2026-04-02T10:00:00Z',
      updatedAt: '2026-04-02T10:05:00Z',
    });

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    const file = client.getFile({
      owner: 'overtrue',
      repo: 'cla-registry',
      path: 'signatures/individual/alice.json',
    });
    const prComment = client
      .getIssueComments({ owner: 'app', repo: 'demo', issueNumber: 1 })
      .find(comment => comment.body.includes('<!-- cla-bot -->'));

    expect(check?.conclusion).toBe('success');
    expect(file?.content).toContain('"signed_at": "2026-04-02T10:05:00Z"');
    expect(prComment?.body).toContain('CLA requirements are satisfied');
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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });
    await handleIssueComment(client, client, {
      owner: 'app',
      repo: 'demo',
      pullNumber: 1,
      ...registryAccess,
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

    await handlePullRequestTarget(client, client, { owner: 'app', repo: 'demo', pullNumber: 1, ...registryAccess });

    const check = client.getCheckRuns({ owner: 'app', repo: 'demo' }).at(-1);
    expect(check?.conclusion).toBe('failure');
    expect(check?.summary).toContain('v2');
  });
});
