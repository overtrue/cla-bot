import type { ClaConfig, ClaEvaluation, Contributor, PullRequestSnapshot } from '../core/types';
import type { GitHubClient } from './client';
import { renderTemplate } from '../utils/template';

function formatContributors(contributors: Contributor[]): string {
  return contributors.map(contributor => `- @${contributor.githubLogin}`).join('\n');
}

function buildRegistryLinks(evaluation: ClaEvaluation): string[] {
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

function buildTemplateValues(config: ClaConfig, evaluation: ClaEvaluation): Record<string, string> {
  const registryLinks = buildRegistryLinks(evaluation);

  return {
    cla_version: evaluation.cla.version,
    cla_document_url: evaluation.cla.url,
    cla_document_sha256: evaluation.cla.sha256 ?? '',
    signing_comment_pattern: config.signing.commentPattern,
    contributors_markdown: evaluation.contributors.length === 0 ? '- none' : formatContributors(evaluation.contributors),
    missing_contributors_markdown: evaluation.missing.length === 0 ? '- none' : formatContributors(evaluation.missing),
    registry_links_markdown: registryLinks.join('\n'),
    contributors_count: String(evaluation.contributors.length),
    missing_count: String(evaluation.missing.length),
    registry_link_count: String(registryLinks.length),
  };
}

function buildPrComment(config: ClaConfig, template: string, evaluation: ClaEvaluation): string {
  return [config.status.commentTag, '', renderTemplate(template, buildTemplateValues(config, evaluation))].join('\n');
}

function buildFailureComment(config: ClaConfig, evaluation: ClaEvaluation): string {
  return buildPrComment(config, config.templates.pr.missingComment, evaluation);
}

function buildSuccessComment(config: ClaConfig, evaluation: ClaEvaluation): string {
  return buildPrComment(config, config.templates.pr.successComment, evaluation);
}

function buildSummary(config: ClaConfig, evaluation: ClaEvaluation): { title: string; summary: string } {
  const values = buildTemplateValues(config, evaluation);

  if (evaluation.missing.length === 0) {
    return {
      title: renderTemplate(config.templates.check.successTitle, values),
      summary: renderTemplate(config.templates.check.successSummary, values),
    };
  }

  return {
    title: renderTemplate(config.templates.check.failureTitle, values),
    summary: renderTemplate(config.templates.check.failureSummary, values),
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
      title: input.config.templates.check.disabledTitle,
      summary: input.config.templates.check.disabledSummary,
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
