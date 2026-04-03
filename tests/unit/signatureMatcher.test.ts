import { describe, expect, it } from 'vitest';

import { parseClaConfig } from '../../src/core/config';
import { matchesSignatureComment } from '../../src/cla/signatureMatcher';
import { claConfigYaml } from '../support/fixtures';

describe('matchesSignatureComment', () => {
  it('matches the exact phrase', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('I have read and agree to the CLA.', config)).toBe(true);
  });

  it('matches when terminal punctuation is missing', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('I have read and agree to the CLA', config)).toBe(true);
  });

  it('matches when terminal punctuation changes', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('I have read and agree to the CLA!', config)).toBe(true);
  });

  it('can require terminal punctuation when configured', () => {
    const config = parseClaConfig(
      claConfigYaml({
        ignoreTerminalPunctuation: false,
      }),
    );

    expect(matchesSignatureComment('I have read and agree to the CLA', config)).toBe(false);
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

  it('matches a standalone signature line in a longer comment', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(
      matchesSignatureComment('Thanks for the reminder.\n\nI have read and agree to the CLA.\n', config),
    ).toBe(true);
  });

  it('matches a standalone signature line after quoted instructions', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(
      matchesSignatureComment(
        '> This pull request requires CLA signatures before it can be merged.\n> `I have read and agree to the CLA.`\n\nI have read and agree to the CLA.',
        config,
      ),
    ).toBe(true);
  });

  it('rejects non-matching comments', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('LGTM', config)).toBe(false);
  });

  it('rejects extra text after the signing phrase', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('I have read and agree to the CLA please merge', config)).toBe(false);
  });

  it('rejects the phrase when it only appears in a quote block', () => {
    const config = parseClaConfig(claConfigYaml());
    expect(matchesSignatureComment('> I have read and agree to the CLA.', config)).toBe(false);
  });
});
