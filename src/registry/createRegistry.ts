import type { ClaConfig } from '../core/types';
import type { GitHubClient } from '../github/client';
import { parseRepository } from '../utils/repository';
import { IssueRegistry } from './issueRegistry';
import { JsonRepoRegistry } from './jsonRepoRegistry';
import type { SignatureRegistry } from './signatureRegistry';

export function createRegistry(client: GitHubClient, config: ClaConfig): SignatureRegistry {
  const registryRepo = parseRepository(config.registry.repository);

  if (config.registry.type === 'issue') {
    return new IssueRegistry(client, registryRepo);
  }

  return new JsonRepoRegistry(client, registryRepo, config.registry.pathPrefix, config.registry.commitMessageTemplate);
}
