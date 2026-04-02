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
    expect(config.status.checkName).toBe('CLA Check');
    expect(config.templates.registry.commitMessage).toBe('chore: record CLA signature for {{github_login}}');
    expect(config.templates.pr.successComment).toBe('CLA requirements are satisfied for this pull request.');
    expect(config.templates.check.disabledSummary).toBe('CLA enforcement is disabled for this repository.');
  });

  it('parses optional template fields', () => {
    const config = parseClaConfig([
      'document:',
      '  version: v1',
      '  url: https://example.com/cla/v1',
      'registry:',
      '  type: json-repo',
      '  repository: overtrue/cla-registry',
      'templates:',
      '  registry:',
      '    commit_message: "chore: record {{github_login}} from {{source_repo}}#{{source_pr_number}}"',
      '  pr:',
      '    success_comment: "Signed by everyone.\\n\\n{{registry_links_markdown}}"',
      '  check:',
      '    success_title: All signed',
      '',
    ].join('\n'));

    expect(config.templates.registry.commitMessage).toBe(
      'chore: record {{github_login}} from {{source_repo}}#{{source_pr_number}}',
    );
    expect(config.templates.pr.successComment).toBe('Signed by everyone.\n\n{{registry_links_markdown}}');
    expect(config.templates.check.successTitle).toBe('All signed');
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
