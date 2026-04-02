import { describe, expect, it } from 'vitest';

import { parseClaConfig } from '../../src/core/config';
import { claConfigYaml } from '../support/fixtures';

describe('parseClaConfig', () => {
  it('fills defaults', () => {
    const config = parseClaConfig([
      'enabled: true',
      'document:',
      '  version: v1',
      '  url: https://example.com/cla/v1',
      'registry:',
      '  type: issue',
      '  repository: overtrue/cla-registry',
      '',
    ].join('\n'));

    expect(config.signing.commentPattern).toBe('I have read and agree to the CLA.');
    expect(config.contributors.checkCommitAuthors).toBe(true);
    expect(config.registry.pathPrefix).toBe('signatures');
    expect(config.registry.commitMessageTemplate).toBe('chore: record CLA signature for {{github_login}}');
    expect(config.status.checkName).toBe('CLA Check');
    expect(config.status.includeRegistryLinks).toBe(false);
  });

  it('parses optional registry and status fields', () => {
    const config = parseClaConfig([
      'document:',
      '  version: v1',
      '  url: https://example.com/cla/v1',
      'registry:',
      '  type: json-repo',
      '  repository: overtrue/cla-registry',
      '  commit_message_template: "chore: record {{github_login}} from {{source_repo}}#{{source_pr_number}}"',
      'status:',
      '  include_registry_links: true',
      '',
    ].join('\n'));

    expect(config.registry.commitMessageTemplate).toBe(
      'chore: record {{github_login}} from {{source_repo}}#{{source_pr_number}}',
    );
    expect(config.status.includeRegistryLinks).toBe(true);
  });

  it('fails on missing required fields', () => {
    expect(() =>
      parseClaConfig([
        'enabled: true',
        'registry:',
        '  type: issue',
        '  repository: overtrue/cla-registry',
        '',
      ].join('\n')),
    ).toThrow(/Invalid \.github\/cla\.yml/);
  });

  it('fails on invalid registry type', () => {
    expect(() => parseClaConfig(claConfigYaml({ registryType: 'issue' }).replace('type: issue', 'type: sqlite'))).toThrow(
      /Invalid \.github\/cla\.yml/,
    );
  });
});
