import { evaluatePullRequest } from '../core/engine';
import { loadClaConfig } from '../core/config';
import { logFields } from '../core/logger';
import type { PullRequestRef } from '../core/types';
import type { GitHubClient } from '../github/client';
import { GitHubStatusReporter } from '../github/statusReporter';
import { createRegistry } from '../registry/createRegistry';

export async function handlePullRequestTarget(
  client: GitHubClient,
  registryClient: GitHubClient,
  input: PullRequestRef,
): Promise<void> {
  const pullRequest = await client.getPullRequest(input);
  const config = await loadClaConfig(client, {
    owner: input.owner,
    repo: input.repo,
    ref: pullRequest.baseRef,
  });
  const reporter = new GitHubStatusReporter(client);

  if (!config.enabled) {
    logFields({
      event: 'pull_request_target',
      repo: `${input.owner}/${input.repo}`,
      pr: input.pullNumber,
      result: 'disabled',
    });
    await reporter.reportDisabled({ pullRequest, config });
    return;
  }

  const evaluation = await evaluatePullRequest({
    client,
    pullRequest,
    config,
    registry: createRegistry(registryClient, config),
  });

  logFields({
    event: 'pull_request_target',
    repo: `${input.owner}/${input.repo}`,
    pr: input.pullNumber,
    cla_version: evaluation.cla.version,
    contributors: evaluation.contributors.map(contributor => contributor.githubLogin),
    missing: evaluation.missing.map(contributor => contributor.githubLogin),
    registry: config.registry.type,
    result: evaluation.missing.length === 0 ? 'success' : 'failure',
  });

  await reporter.syncStatus({
    pullRequest,
    config,
    evaluation,
  });
}
