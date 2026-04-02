import { describe, expect, it } from 'vitest';

import { IssueRegistry } from '../../src/registry/issueRegistry';
import { MemoryGitHubClient } from '../support/memoryGitHubClient';

const repo = { owner: 'org', repo: 'cla-registry' };

const signature = {
  githubLogin: 'alice',
  signerType: 'individual' as const,
  claVersion: 'v1',
  documentUrl: 'https://example.com/cla/v1',
  signedAt: '2026-04-02T10:00:00Z',
  sourceRepo: 'app/demo',
  sourcePrNumber: 1,
  sourceCommentId: 11,
  registryType: 'issue' as const,
};

describe('IssueRegistry', () => {
  it('creates a new issue for the first signature', async () => {
    const client = new MemoryGitHubClient();
    const registry = new IssueRegistry(client, repo);

    await registry.saveSignature(signature);

    const issue = client.getIssueByTitle({ ...repo, title: 'CLA - alice' });
    expect(issue?.body).toContain('latest_cla_version: v1');
    expect(issue?.comments).toHaveLength(1);
  });

  it('is idempotent for the same version', async () => {
    const client = new MemoryGitHubClient();
    const registry = new IssueRegistry(client, repo);

    await registry.saveSignature(signature);
    await registry.saveSignature({
      ...signature,
      signedAt: '2026-04-02T12:00:00Z',
      sourceCommentId: 22,
    });

    const issue = client.getIssueByTitle({ ...repo, title: 'CLA - alice' });
    expect(issue?.comments).toHaveLength(1);
  });

  it('appends a comment for a new version', async () => {
    const client = new MemoryGitHubClient();
    const registry = new IssueRegistry(client, repo);

    await registry.saveSignature(signature);
    await registry.saveSignature({
      ...signature,
      claVersion: 'v2',
      documentUrl: 'https://example.com/cla/v2',
      signedAt: '2026-04-03T10:00:00Z',
      sourceCommentId: 22,
    });

    const issue = client.getIssueByTitle({ ...repo, title: 'CLA - alice' });
    expect(issue?.comments).toHaveLength(2);
    expect(issue?.body).toContain('latest_cla_version: v2');
  });

  it('finds signatures from stored body and comments', async () => {
    const client = new MemoryGitHubClient();
    const registry = new IssueRegistry(client, repo);

    await registry.saveSignature(signature);
    const found = await registry.findSignature({ githubLogin: 'alice', claVersion: 'v1' });

    expect(found?.githubLogin).toBe('alice');
    expect(found?.sourceCommentId).toBe(11);
  });
});
