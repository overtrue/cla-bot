import { describe, expect, it } from 'vitest';

import { getRegistrySetupWarnings, toRegistryAccessError } from '../../src/action/registryGuidance';
import { parseClaConfig } from '../../src/core/config';
import { claConfigYaml } from '../support/fixtures';

describe('registryGuidance', () => {
  it('warns when a cross-repo registry falls back to github-token', () => {
    const config = parseClaConfig(claConfigYaml({ repository: 'overtrue/cla-registry' }));

    const warnings = getRegistrySetupWarnings({
      currentRepo: { owner: 'app', repo: 'demo' },
      config,
      hasExplicitRegistryToken: false,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('registry-token');
    expect(warnings[0]).toContain('github-token');
    expect(warnings[0]).toContain('Issues: read and write');
  });

  it('does not warn when an explicit registry token is provided', () => {
    const config = parseClaConfig(claConfigYaml({ repository: 'overtrue/cla-registry' }));

    const warnings = getRegistrySetupWarnings({
      currentRepo: { owner: 'app', repo: 'demo' },
      config,
      hasExplicitRegistryToken: true,
    });

    expect(warnings).toEqual([]);
  });

  it('explains cross-repo permission failures with a token hint', () => {
    const config = parseClaConfig(claConfigYaml({ repository: 'overtrue/cla-registry', registryType: 'json-repo' }));

    const error = toRegistryAccessError(
      { status: 403, message: 'Forbidden' },
      {
        currentRepo: { owner: 'app', repo: 'demo' },
        config,
        hasExplicitRegistryToken: false,
        operation: 'write',
      },
    );

    expect(error.message).toContain('Unable to write to registry repository overtrue/cla-registry');
    expect(error.message).toContain('`github.token` usually cannot access a different repository');
    expect(error.message).toContain('Contents: read and write');
    expect(error.message).toContain('authored by the token identity');
  });

  it('explains same-repo failures in terms of workflow permissions', () => {
    const config = parseClaConfig(claConfigYaml({ repository: 'app/demo', registryType: 'issue' }));

    const error = toRegistryAccessError(
      { status: 403, message: 'Forbidden' },
      {
        currentRepo: { owner: 'app', repo: 'demo' },
        config,
        hasExplicitRegistryToken: false,
        operation: 'read',
      },
    );

    expect(error.message).toContain('Check the workflow token permissions for the current repository');
    expect(error.message).toContain('Issues: read and write');
    expect(error.message).toContain('issue');
  });
});
