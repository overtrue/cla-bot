import { ConfigurationError } from '../core/errors';
import type { RepoCoordinates } from '../core/types';

export function parseRepository(fullName: string): RepoCoordinates {
  const [owner, repo, ...rest] = fullName.split('/');

  if (!owner || !repo || rest.length > 0) {
    throw new ConfigurationError(`Invalid repository reference: ${fullName}`);
  }

  return { owner, repo };
}
