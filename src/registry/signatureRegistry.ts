import type { SignatureRecord } from '../core/types';

export interface SignatureRegistry {
  findSignature(input: { githubLogin: string; claVersion: string }): Promise<SignatureRecord | null>;
  saveSignature(record: SignatureRecord): Promise<SignatureRecord>;
}
