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

function filterQuotedReply(commentBody: string): string {
  return commentBody
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('>'))
    .join('\n');
}

export function matchesSignatureComment(commentBody: string, config: ClaConfig): boolean {
  const expected = normalize(config.signing.commentPattern, config);

  return normalize(commentBody, config) === expected || normalize(filterQuotedReply(commentBody), config) === expected;
}
