import { describe, expect, it } from 'vitest';

import { JsonRepoRegistry } from '../../src/registry/jsonRepoRegistry';
import { MemoryGitHubClient } from '../support/memoryGitHubClient';

const repo = { owner: 'overtrue', repo: 'cla-registry' };

const signature = {
  githubLogin: 'alice',
  signerType: 'individual' as const,
  claVersion: 'v1',
  documentUrl: 'https://example.com/cla/v1',
  signedAt: '2026-04-02T10:00:00Z',
  sourceRepo: 'app/demo',
  sourcePrNumber: 1,
  sourceCommentId: 11,
  registryType: 'json-repo' as const,
};

describe('JsonRepoRegistry', () => {
  it('creates a new JSON file for the first signature', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(client, repo, 'signatures');

    await registry.saveSignature(signature);

    const file = client.getFile({ ...repo, path: 'signatures/individual/alice.json' });
    expect(file?.content).toContain('"cla_version": "v1"');
  });

  it('is idempotent for the same version', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(client, repo, 'signatures');

    await registry.saveSignature(signature);
    await registry.saveSignature({ ...signature, signedAt: '2026-04-02T12:00:00Z', sourceCommentId: 22 });

    const file = client.getFile({ ...repo, path: 'signatures/individual/alice.json' });
    expect(JSON.parse(file?.content ?? '{}').signatures).toHaveLength(1);
  });

  it('appends a new version', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(client, repo, 'signatures');

    await registry.saveSignature(signature);
    await registry.saveSignature({
      ...signature,
      claVersion: 'v2',
      documentUrl: 'https://example.com/cla/v2',
      sourceCommentId: 22,
    });

    const file = client.getFile({ ...repo, path: 'signatures/individual/alice.json' });
    expect(JSON.parse(file?.content ?? '{}').signatures).toHaveLength(2);
  });

  it('throws on invalid stored JSON', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(client, repo, 'signatures');

    client.seedFile({
      ...repo,
      path: 'signatures/individual/alice.json',
      content: '{not-json}',
    });

    await expect(registry.findSignature({ githubLogin: 'alice', claVersion: 'v1' })).rejects.toThrow();
  });
});
