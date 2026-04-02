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
      '  repository: org/cla-registry',
      '',
    ].join('\n'));

    expect(config.signing.commentPattern).toBe('I have read and agree to the CLA.');
    expect(config.contributors.checkCommitAuthors).toBe(true);
    expect(config.registry.pathPrefix).toBe('signatures');
    expect(config.status.checkName).toBe('CLA Check');
  });

  it('fails on missing required fields', () => {
    expect(() =>
      parseClaConfig([
        'enabled: true',
        'registry:',
        '  type: issue',
        '  repository: org/cla-registry',
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
