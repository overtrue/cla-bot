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

export function matchesSignatureComment(commentBody: string, config: ClaConfig): boolean {
  return normalize(commentBody, config) === normalize(config.signing.commentPattern, config);
}
