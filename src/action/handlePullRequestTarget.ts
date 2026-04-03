import * as core from '@actions/core';

import { evaluatePullRequest } from '../core/engine';
import { loadClaConfig } from '../core/config';
import { logFields } from '../core/logger';
import type { ClaConfig, ClaEvaluation, PullRequestRef, SignatureRecord } from '../core/types';
import type { GitHubClient } from '../github/client';
import { GitHubStatusReporter } from '../github/statusReporter';
import { createRegistry } from '../registry/createRegistry';
import type { SignatureRegistry } from '../registry/signatureRegistry';
import { findMatchingSignatureComments, signatureTimestamp } from './commentSignatures';
import { getRegistrySetupWarnings, toRegistryAccessError } from './registryGuidance';

function applySavedSignatures(evaluation: ClaEvaluation, signatures: SignatureRecord[]): ClaEvaluation {
  const bySigner = new Map(signatures.map(signature => [signature.githubLogin, signature]));
  const results = evaluation.results.map(result => {
    const signature = bySigner.get(result.contributor.githubLogin);

    if (!signature) {
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

async function saveCommentSignatures(input: {
  client: GitHubClient;
  registry: SignatureRegistry;
  pullRequest: PullRequestRef;
  config: ClaConfig;
  evaluation: ClaEvaluation;
}): Promise<SignatureRecord[]> {
  const comments = await input.client.listIssueComments({
    owner: input.pullRequest.owner,
    repo: input.pullRequest.repo,
    issueNumber: input.pullRequest.pullNumber,
  });
  const matches = findMatchingSignatureComments({
    comments,
    missing: input.evaluation.missing,
    config: input.config,
  });

  const signatures: SignatureRecord[] = [];

  for (const match of matches) {
    signatures.push(
      await input.registry.saveSignature({
        githubLogin: match.signer,
        signerType: 'individual',
        claVersion: input.evaluation.cla.version,
        documentUrl: input.evaluation.cla.url,
        ...(input.evaluation.cla.sha256 ? { documentSha256: input.evaluation.cla.sha256 } : {}),
        signedAt: signatureTimestamp(match.comment),
        sourceRepo: `${input.pullRequest.owner}/${input.pullRequest.repo}`,
        sourcePrNumber: input.pullRequest.pullNumber,
        sourceCommentId: match.comment.id,
        registryType: input.config.registry.type,
      }),
    );
  }

  return signatures;
}

export async function handlePullRequestTarget(
  client: GitHubClient,
  registryClient: GitHubClient,
  input: PullRequestRef & { hasExplicitRegistryToken: boolean },
): Promise<void> {
  const pullRequest = await client.getPullRequest(input);
  const config = await loadClaConfig(client, {
    owner: input.owner,
    repo: input.repo,
    ref: pullRequest.baseRef,
  });
  const reporter = new GitHubStatusReporter(client);
  const registry = createRegistry(registryClient, config);

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

  for (const warning of getRegistrySetupWarnings({
    currentRepo: { owner: input.owner, repo: input.repo },
    config,
    hasExplicitRegistryToken: input.hasExplicitRegistryToken,
  })) {
    core.warning(warning);
  }

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

  let savedSignatures: SignatureRecord[] = [];

  try {
    savedSignatures = await saveCommentSignatures({
      client,
      registry,
      pullRequest,
      config,
      evaluation,
    });

    if (savedSignatures.length > 0) {
      evaluation = applySavedSignatures(evaluation, savedSignatures);
    }
  } catch (error) {
    throw toRegistryAccessError(error, {
      currentRepo: { owner: input.owner, repo: input.repo },
      config,
      hasExplicitRegistryToken: input.hasExplicitRegistryToken,
      operation: 'write',
    });
  }

  logFields({
    event: 'pull_request_target',
    repo: `${input.owner}/${input.repo}`,
    pr: input.pullNumber,
    cla_version: evaluation.cla.version,
    contributors: evaluation.contributors.map(contributor => contributor.githubLogin),
    missing: evaluation.missing.map(contributor => contributor.githubLogin),
    ...(savedSignatures.length > 0
      ? { recovered_signatures: savedSignatures.map(signature => signature.githubLogin) }
      : {}),
    registry: config.registry.type,
    result: evaluation.missing.length === 0 ? 'success' : 'failure',
  });

  await reporter.syncStatus({
    pullRequest,
    config,
    evaluation,
  });
}
