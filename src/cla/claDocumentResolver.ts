import type { ClaConfig, ClaDocument } from '../core/types';

export function resolveClaDocument(config: ClaConfig): ClaDocument {
  return config.document;
}
