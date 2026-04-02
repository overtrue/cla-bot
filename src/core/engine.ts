import { resolveClaDocument } from '../cla/claDocumentResolver';
import { resolveContributors } from '../contributors/contributorResolver';
import type { GitHubClient } from '../github/client';
import type { ClaConfig, ClaEvaluation, PullRequestSnapshot } from './types';
import type { SignatureRegistry } from '../registry/signatureRegistry';

export async function evaluatePullRequest(input: {
  client: GitHubClient;
  pullRequest: PullRequestSnapshot;
  config: ClaConfig;
  registry: SignatureRegistry;
}): Promise<ClaEvaluation> {
  const cla = resolveClaDocument(input.config);
  const contributors = await resolveContributors({
    client: input.client,
    pullRequest: input.pullRequest,
    config: input.config,
  });

  const results = await Promise.all(
    contributors.map(async contributor => {
      const signature = await input.registry.findSignature({
        githubLogin: contributor.githubLogin,
        claVersion: cla.version,
      });

      if (signature) {
        return {
          contributor,
          signed: true,
          signature,
        };
      }

      return {
        contributor,
        signed: false,
        reason: `Missing signature for ${cla.version}`,
      };
    }),
  );

  return {
    cla,
    contributors,
    results,
    missing: results.filter(result => !result.signed).map(result => result.contributor),
  };
}
