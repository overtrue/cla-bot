import type { ClaConfig } from '../core/types';

const trailingSentencePunctuation = /[.!?,;:。！？，；：]+$/u;

function normalize(input: string, config: ClaConfig): string {
  let value = input;

  if (config.signing.trimWhitespace) {
    value = value.trim();
  }

  if (config.signing.caseInsensitive) {
    value = value.toLocaleLowerCase('en-US');
  }

  if (config.signing.ignoreTerminalPunctuation) {
    value = value.replace(trailingSentencePunctuation, '');
  }

  return value;
}

function matchesStandaloneLine(commentBody: string, expected: string, config: ClaConfig): boolean {
  let inFence = false;

  for (const rawLine of commentBody.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }

    if (inFence || line === '' || line.startsWith('>')) {
      continue;
    }

    if (normalize(line, config) === expected) {
      return true;
    }
  }

  return false;
}

export function matchesSignatureComment(commentBody: string, config: ClaConfig): boolean {
  const expected = normalize(config.signing.commentPattern, config);

  return normalize(commentBody, config) === expected || matchesStandaloneLine(commentBody, expected, config);
}
