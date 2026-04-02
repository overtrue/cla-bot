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
    const registry = new JsonRepoRegistry(
      client,
      repo,
      'signatures',
      'chore: record CLA signature for {{github_login}} from {{source_repo}}#{{source_pr_number}}',
    );

    const saved = await registry.saveSignature(signature);

    const file = client.getFile({ ...repo, path: 'signatures/individual/alice.json' });
    const write = client.getFileWrites(repo).at(-1);
    expect(file?.content).toContain('"cla_version": "v1"');
    expect(saved.registryUrl).toBe('https://github.com/overtrue/cla-registry/blob/main/signatures/individual/alice.json');
    expect(write?.message).toBe('chore: record CLA signature for alice from app/demo#1');
  });

  it('is idempotent for the same version', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(
      client,
      repo,
      'signatures',
      'chore: record CLA signature for {{github_login}}',
    );

    await registry.saveSignature(signature);
    await registry.saveSignature({ ...signature, signedAt: '2026-04-02T12:00:00Z', sourceCommentId: 22 });

    const file = client.getFile({ ...repo, path: 'signatures/individual/alice.json' });
    expect(JSON.parse(file?.content ?? '{}').signatures).toHaveLength(1);
  });

  it('appends a new version', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(
      client,
      repo,
      'signatures',
      'chore: record CLA signature for {{github_login}}',
    );

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
    const registry = new JsonRepoRegistry(
      client,
      repo,
      'signatures',
      'chore: record CLA signature for {{github_login}}',
    );

    client.seedFile({
      ...repo,
      path: 'signatures/individual/alice.json',
      content: '{not-json}',
    });

    await expect(registry.findSignature({ githubLogin: 'alice', claVersion: 'v1' })).rejects.toThrow();
  });

  it('writes to a dedicated branch without touching the default branch', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(
      client,
      repo,
      'signatures',
      'chore: record CLA signature for {{github_login}}',
      'cla-signatures',
    );

    const saved = await registry.saveSignature(signature);

    expect(client.getFile({ ...repo, path: 'signatures/individual/alice.json' })).toBeUndefined();
    expect(client.getFile({ ...repo, path: 'signatures/individual/alice.json', ref: 'cla-signatures' })).toBeDefined();
    expect(saved.registryUrl).toBe('https://github.com/overtrue/cla-registry/blob/cla-signatures/signatures/individual/alice.json');
  });

  it('reads existing signatures from the configured branch', async () => {
    const client = new MemoryGitHubClient();
    const registry = new JsonRepoRegistry(
      client,
      repo,
      'signatures',
      'chore: record CLA signature for {{github_login}}',
      'cla-signatures',
    );

    await client.ensureBranch({ ...repo, branch: 'cla-signatures' });
    client.seedFile({
      ...repo,
      ref: 'cla-signatures',
      path: 'signatures/individual/alice.json',
      content: JSON.stringify(
        {
          github_login: 'alice',
          signer_type: 'individual',
          signatures: [
            {
              cla_version: 'v1',
              signed_at: '2026-04-02T10:00:00Z',
              document_url: 'https://example.com/cla/v1',
              source_repo: 'app/demo',
              source_pr_number: 1,
              source_comment_id: 11,
            },
          ],
        },
        null,
        2,
      ),
    });

    const found = await registry.findSignature({ githubLogin: 'alice', claVersion: 'v1' });
    expect(found?.githubLogin).toBe('alice');
    expect(found?.claVersion).toBe('v1');
  });
});
