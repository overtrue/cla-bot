import { describe, expect, it } from 'vitest';

import { parseClaConfig } from '../../src/core/config';
import { matchesSignatureComment } from '../../src/cla/signatureMatcher';
import { claConfigYaml } from '../support/fixtures';

describe('matchesSignatureComment', () => {
  it('matches the exact phrase', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('I have read and agree to the CLA.', config)).toBe(true);
  });

  it('matches case-insensitively', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('i HAVE read and agree to the cla.', config)).toBe(true);
  });

  it('trims whitespace', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('  I have read and agree to the CLA.  ', config)).toBe(true);
  });

  it('rejects non-matching comments', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('LGTM', config)).toBe(false);
  });
});
