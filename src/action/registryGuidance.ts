import type { ClaConfig, RepoCoordinates } from '../core/types';
import { getGitHubErrorStatus } from '../github/client';
import { parseRepository } from '../utils/repository';

function isCrossRepoRegistry(config: ClaConfig, currentRepo: RepoCoordinates): boolean {
  const registryRepo = parseRepository(config.registry.repository);
  return registryRepo.owner !== currentRepo.owner || registryRepo.repo !== currentRepo.repo;
}

function requiredRegistryPermission(config: ClaConfig): string {
  return config.registry.type === 'issue' ? 'Issues: read and write' : 'Contents: read and write';
}

export function getRegistrySetupWarnings(input: {
  currentRepo: RepoCoordinates;
  config: ClaConfig;
  hasExplicitRegistryToken: boolean;
}): string[] {
  if (!isCrossRepoRegistry(input.config, input.currentRepo) || input.hasExplicitRegistryToken) {
    return [];
  }

  return [
    [
      `registry.repository is set to ${input.config.registry.repository}, which is different from the current repository `,
      `${input.currentRepo.owner}/${input.currentRepo.repo}.`,
      ' `registry-token` was not provided, so CLA Bot is falling back to `github-token` for registry access.',
      ' `github.token` usually cannot write to a different repository.',
      ` Configure \`registry-token\` (or \`REGISTRY_GITHUB_TOKEN\`) with ${requiredRegistryPermission(input.config)} on `,
      `${input.config.registry.repository}.`,
    ].join(''),
  ];
}

export function toRegistryAccessError(
  error: unknown,
  input: {
    currentRepo: RepoCoordinates;
    config: ClaConfig;
    hasExplicitRegistryToken: boolean;
    operation: 'read' | 'write';
  },
): Error {
  const status = getGitHubErrorStatus(error);

  if (status !== 403 && status !== 404) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const action = input.operation === 'read' ? 'read from' : 'write to';
  const tokenHint = input.hasExplicitRegistryToken
    ? [
        ' The provided `registry-token` does not appear to have the required access.',
        ` It needs ${requiredRegistryPermission(input.config)} on ${input.config.registry.repository}.`,
      ].join('')
    : isCrossRepoRegistry(input.config, input.currentRepo)
      ? [
          ' `registry-token` was not provided, so CLA Bot fell back to `github-token`.',
          ' `github.token` usually cannot access a different repository.',
          ` Set \`registry-token\` (or \`REGISTRY_GITHUB_TOKEN\`) to a PAT or GitHub App installation token with `,
          `${requiredRegistryPermission(input.config)} on ${input.config.registry.repository}.`,
        ].join('')
      : [
          ' Check the workflow token permissions for the current repository.',
          ` This backend needs ${requiredRegistryPermission(input.config)}.`,
        ].join('');

  const backendHint =
    input.config.registry.type === 'json-repo'
      ? ' `json-repo` records signatures in Git commits, and those commits are authored by the token identity, not by the signer who commented on the PR.'
      : ' `issue` records signatures as issues/comments created by the token identity.';

  return new Error(
    [
      `Unable to ${action} registry repository ${input.config.registry.repository} (GitHub API status ${status}).`,
      tokenHint,
      backendHint,
    ].join(''),
  );
}
