import type { ClaConfig, ClaEvaluation, Contributor, PullRequestSnapshot } from '../core/types';
import type { GitHubClient } from './client';

function formatContributors(contributors: Contributor[]): string {
  return contributors.map(contributor => `- @${contributor.githubLogin}`).join('\n');
}

function buildFailureComment(config: ClaConfig, evaluation: ClaEvaluation): string {
  return [
    config.status.commentTag,
    '',
    'This pull request requires CLA signatures before it can be merged.',
    '',
    'Missing signatures:',
    '',
    formatContributors(evaluation.missing),
    '',
    'To sign the CLA, each missing contributor must comment exactly:',
    '',
    `\`${config.signing.commentPattern}\``,
    '',
    'CLA document:',
    `<${evaluation.cla.url}>`,
  ].join('\n');
}

function buildRegistryLinks(config: ClaConfig, evaluation: ClaEvaluation): string[] {
  if (!config.status.includeRegistryLinks) {
    return [];
  }

  const seen = new Set<string>();

  return evaluation.results.flatMap(result => {
    const url = result.signature?.registryUrl;

    if (!result.signed || !url || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [`- @${result.contributor.githubLogin}: <${url}>`];
  });
}

function buildSuccessComment(config: ClaConfig, evaluation: ClaEvaluation): string {
  const registryLinks = buildRegistryLinks(config, evaluation);

  return [
    config.status.commentTag,
    '',
    'CLA requirements are satisfied for this pull request.',
    ...(registryLinks.length === 0 ? [] : ['', 'Registry records:', '', ...registryLinks]),
  ].join('\n');
}

function buildSummary(config: ClaConfig, evaluation: ClaEvaluation): { title: string; summary: string } {
  if (evaluation.missing.length === 0) {
    const registryLinks = buildRegistryLinks(config, evaluation);

    return {
      title: 'CLA satisfied',
      summary: [
        `All required contributors have signed ${evaluation.cla.version}.`,
        '',
        'Contributors checked:',
        '',
        evaluation.contributors.length === 0 ? '- none' : formatContributors(evaluation.contributors),
        ...(registryLinks.length === 0 ? [] : ['', 'Registry records:', '', ...registryLinks]),
      ].join('\n'),
    };
  }

  return {
    title: 'CLA signatures required',
    summary: [
      `The following contributors still need to sign ${evaluation.cla.version}:`,
      '',
      formatContributors(evaluation.missing),
      '',
      `Required comment: \`${config.signing.commentPattern}\``,
      `Document: <${evaluation.cla.url}>`,
    ].join('\n'),
  };
}

export class GitHubStatusReporter {
  constructor(private readonly client: GitHubClient) {}

  async syncStatus(input: {
    pullRequest: PullRequestSnapshot;
    config: ClaConfig;
    evaluation: ClaEvaluation;
  }): Promise<void> {
    await this.upsertInstructionComment(input);

    const summary = buildSummary(input.config, input.evaluation);

    await this.client.createCheckRun({
      owner: input.pullRequest.owner,
      repo: input.pullRequest.repo,
      name: input.config.status.checkName,
      headSha: input.pullRequest.headSha,
      conclusion: input.evaluation.missing.length === 0 ? 'success' : 'failure',
      title: summary.title,
      summary: summary.summary,
    });
  }

  async reportDisabled(input: { pullRequest: PullRequestSnapshot; config: ClaConfig }): Promise<void> {
    await this.client.createCheckRun({
      owner: input.pullRequest.owner,
      repo: input.pullRequest.repo,
      name: input.config.status.checkName,
      headSha: input.pullRequest.headSha,
      conclusion: 'success',
      title: 'CLA disabled',
      summary: 'CLA enforcement is disabled for this repository.',
    });
  }

  private async upsertInstructionComment(input: {
    pullRequest: PullRequestSnapshot;
    config: ClaConfig;
    evaluation: ClaEvaluation;
  }): Promise<void> {
    const comments = await this.client.listIssueComments({
      owner: input.pullRequest.owner,
      repo: input.pullRequest.repo,
      issueNumber: input.pullRequest.pullNumber,
    });

    const existing = comments.find(comment => comment.body.includes(input.config.status.commentTag));
    const body =
      input.evaluation.missing.length === 0
        ? buildSuccessComment(input.config, input.evaluation)
        : buildFailureComment(input.config, input.evaluation);

    if (existing) {
      await this.client.updateIssueComment({
        owner: input.pullRequest.owner,
        repo: input.pullRequest.repo,
        commentId: existing.id,
        body,
      });
      return;
    }

    await this.client.createIssueComment({
      owner: input.pullRequest.owner,
      repo: input.pullRequest.repo,
      issueNumber: input.pullRequest.pullNumber,
      body,
    });
  }
}
