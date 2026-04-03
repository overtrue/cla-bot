import * as core from '@actions/core';

import { matchesSignatureComment } from '../cla/signatureMatcher';
import { loadClaConfig } from '../core/config';
import { evaluatePullRequest } from '../core/engine';
import { logFields } from '../core/logger';
import type { ClaEvaluation, IssueCommentSnapshot, PullRequestRef } from '../core/types';
import type { GitHubClient } from '../github/client';
import { GitHubStatusReporter } from '../github/statusReporter';
import { createRegistry } from '../registry/createRegistry';
import { normalizeGitHubLogin } from '../utils/githubLogin';
import { getRegistrySetupWarnings, toRegistryAccessError } from './registryGuidance';
import { signatureTimestamp } from './commentSignatures';

function applySavedSignature(
  evaluation: ClaEvaluation,
  signer: string,
  signature: NonNullable<ClaEvaluation['results'][number]['signature']>,
): ClaEvaluation {
  const results = evaluation.results.map(result => {
    if (result.contributor.githubLogin !== signer) {
      return result;
    }

    return {
      contributor: result.contributor,
      signed: true,
      signature,
    };
  });

  return {
    ...evaluation,
    results,
    missing: results.filter(result => !result.signed).map(result => result.contributor),
  };
}

export async function handleIssueComment(
  client: GitHubClient,
  registryClient: GitHubClient,
  input: PullRequestRef & { hasExplicitRegistryToken: boolean; comment: IssueCommentSnapshot },
): Promise<void> {
  const pullRequest = await client.getPullRequest(input);
  const config = await loadClaConfig(client, {
    owner: input.owner,
    repo: input.repo,
    ref: pullRequest.baseRef,
  });

  if (!config.enabled || !matchesSignatureComment(input.comment.body, config)) {
    return;
  }

  for (const warning of getRegistrySetupWarnings({
    currentRepo: { owner: input.owner, repo: input.repo },
    config,
    hasExplicitRegistryToken: input.hasExplicitRegistryToken,
  })) {
    core.warning(warning);
  }

  const reporter = new GitHubStatusReporter(client);
  const registry = createRegistry(registryClient, config);
  let evaluation;

  try {
    evaluation = await evaluatePullRequest({
      client,
      pullRequest,
      config,
      registry,
    });
  } catch (error) {
    throw toRegistryAccessError(error, {
      currentRepo: { owner: input.owner, repo: input.repo },
      config,
      hasExplicitRegistryToken: input.hasExplicitRegistryToken,
      operation: 'read',
    });
  }
  const signer = input.comment.userLogin ? normalizeGitHubLogin(input.comment.userLogin) : null;

  if (!signer || !evaluation.missing.some(contributor => contributor.githubLogin === signer)) {
    logFields({
      event: 'issue_comment',
      repo: `${input.owner}/${input.repo}`,
      pr: input.pullNumber,
      comment_id: input.comment.id,
      signer: signer ?? 'unknown',
      result: 'ignored',
    });
    return;
  }

  let savedSignature;

  try {
    savedSignature = await registry.saveSignature({
      githubLogin: signer,
      signerType: 'individual',
      claVersion: evaluation.cla.version,
      documentUrl: evaluation.cla.url,
      ...(evaluation.cla.sha256 ? { documentSha256: evaluation.cla.sha256 } : {}),
      signedAt: signatureTimestamp(input.comment),
      sourceRepo: `${input.owner}/${input.repo}`,
      sourcePrNumber: input.pullNumber,
      sourceCommentId: input.comment.id,
      registryType: config.registry.type,
    });
  } catch (error) {
    throw toRegistryAccessError(error, {
      currentRepo: { owner: input.owner, repo: input.repo },
      config,
      hasExplicitRegistryToken: input.hasExplicitRegistryToken,
      operation: 'write',
    });
  }

  const nextEvaluation = applySavedSignature(evaluation, signer, savedSignature);

  logFields({
    event: 'issue_comment',
    repo: `${input.owner}/${input.repo}`,
    pr: input.pullNumber,
    comment_id: input.comment.id,
    signer,
    cla_version: evaluation.cla.version,
    registry: config.registry.type,
    result: 'signature_saved',
  });

  await reporter.syncStatus({
    pullRequest,
    config,
    evaluation: nextEvaluation,
  });
}
