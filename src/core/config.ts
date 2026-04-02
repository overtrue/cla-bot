import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { ConfigurationError } from './errors';
import type { ClaConfig, RepoCoordinates } from './types';
import type { GitHubClient } from '../github/client';
import { normalizeGitHubLogin } from '../utils/githubLogin';

const defaultRawTemplates = {
  registry: {
    commit_message: 'chore: record CLA signature for {{github_login}}',
  },
  pr: {
    missing_comment: [
      'This pull request requires CLA signatures before it can be merged.',
      '',
      'Missing signatures:',
      '',
      '{{missing_contributors_markdown}}',
      '',
      'To sign the CLA, each missing contributor must comment this phrase:',
      '',
      '`{{signing_comment_pattern}}`',
      '',
      'CLA document:',
      '<{{cla_document_url}}>',
    ].join('\n'),
    success_comment: 'CLA requirements are satisfied for this pull request.',
  },
  check: {
    success_title: 'CLA satisfied',
    success_summary: [
      'All required contributors have signed {{cla_version}}.',
      '',
      'Contributors checked:',
      '',
      '{{contributors_markdown}}',
    ].join('\n'),
    failure_title: 'CLA signatures required',
    failure_summary: [
      'The following contributors still need to sign {{cla_version}}:',
      '',
      '{{missing_contributors_markdown}}',
      '',
      'Required phrase: `{{signing_comment_pattern}}`',
      'Document: <{{cla_document_url}}>',
    ].join('\n'),
    disabled_title: 'CLA disabled',
    disabled_summary: 'CLA enforcement is disabled for this repository.',
  },
} as const;

const rawConfigSchema = z.object({
  enabled: z.boolean().default(true),
  document: z.object({
    version: z.string().min(1),
    url: z.string().url(),
    sha256: z.string().min(1).optional(),
  }),
  signing: z
    .object({
      mode: z.literal('comment').default('comment'),
      comment_pattern: z.string().min(1).default('I have read and agree to the CLA.'),
      case_insensitive: z.boolean().default(true),
      trim_whitespace: z.boolean().default(true),
      ignore_terminal_punctuation: z.boolean().default(true),
    })
    .default({
      mode: 'comment',
      comment_pattern: 'I have read and agree to the CLA.',
      case_insensitive: true,
      trim_whitespace: true,
      ignore_terminal_punctuation: true,
    }),
  contributors: z
    .object({
      check_pr_author: z.boolean().default(true),
      check_commit_authors: z.boolean().default(true),
      check_coauthors: z.boolean().default(false),
      exclude_bots: z.boolean().default(true),
      allowlist: z.array(z.string().min(1)).default([]),
    })
    .default({
      check_pr_author: true,
      check_commit_authors: true,
      check_coauthors: false,
      exclude_bots: true,
      allowlist: [],
    }),
  registry: z.object({
    type: z.enum(['issue', 'json-repo']),
    repository: z.string().regex(/^[^/]+\/[^/]+$/, 'registry.repository must be owner/repo'),
    path_prefix: z.string().min(1).default('signatures'),
    branch: z.string().min(1).optional(),
  }).superRefine((value, ctx) => {
    if (value.type === 'issue' && value.branch) {
      ctx.addIssue({
        code: 'custom',
        path: ['branch'],
        message: 'registry.branch is only supported for json-repo',
      });
    }
  }),
  status: z
    .object({
      check_name: z.string().min(1).default('CLA Check'),
      comment_tag: z.string().min(1).default('<!-- cla-bot -->'),
    })
    .default({
      check_name: 'CLA Check',
      comment_tag: '<!-- cla-bot -->',
    }),
  templates: z
    .object({
      registry: z
        .object({
          commit_message: z.string().min(1).default(defaultRawTemplates.registry.commit_message),
        })
        .default(defaultRawTemplates.registry),
      pr: z
        .object({
          missing_comment: z.string().min(1).default(defaultRawTemplates.pr.missing_comment),
          success_comment: z.string().min(1).default(defaultRawTemplates.pr.success_comment),
        })
        .default(defaultRawTemplates.pr),
      check: z
        .object({
          success_title: z.string().min(1).default(defaultRawTemplates.check.success_title),
          success_summary: z.string().min(1).default(defaultRawTemplates.check.success_summary),
          failure_title: z.string().min(1).default(defaultRawTemplates.check.failure_title),
          failure_summary: z.string().min(1).default(defaultRawTemplates.check.failure_summary),
          disabled_title: z.string().min(1).default(defaultRawTemplates.check.disabled_title),
          disabled_summary: z.string().min(1).default(defaultRawTemplates.check.disabled_summary),
        })
        .default(defaultRawTemplates.check),
    })
    .default({
      registry: defaultRawTemplates.registry,
      pr: defaultRawTemplates.pr,
      check: defaultRawTemplates.check,
    }),
});

export function parseClaConfig(raw: string): ClaConfig {
  try {
    const parsed = rawConfigSchema.parse(parseYaml(raw) ?? {});
    return {
      enabled: parsed.enabled,
      document: {
        version: parsed.document.version,
        url: parsed.document.url,
        ...(parsed.document.sha256 ? { sha256: parsed.document.sha256 } : {}),
      },
      signing: {
        mode: parsed.signing.mode,
        commentPattern: parsed.signing.comment_pattern,
        caseInsensitive: parsed.signing.case_insensitive,
        trimWhitespace: parsed.signing.trim_whitespace,
        ignoreTerminalPunctuation: parsed.signing.ignore_terminal_punctuation,
      },
      contributors: {
        checkPrAuthor: parsed.contributors.check_pr_author,
        checkCommitAuthors: parsed.contributors.check_commit_authors,
        checkCoauthors: parsed.contributors.check_coauthors,
        excludeBots: parsed.contributors.exclude_bots,
        allowlist: parsed.contributors.allowlist.map(normalizeGitHubLogin),
      },
      registry: {
        type: parsed.registry.type,
        repository: parsed.registry.repository,
        pathPrefix: parsed.registry.path_prefix,
        ...(parsed.registry.branch ? { branch: parsed.registry.branch } : {}),
      },
      status: {
        checkName: parsed.status.check_name,
        commentTag: parsed.status.comment_tag,
      },
      templates: {
        registry: {
          commitMessage: parsed.templates.registry.commit_message,
        },
        pr: {
          missingComment: parsed.templates.pr.missing_comment,
          successComment: parsed.templates.pr.success_comment,
        },
        check: {
          successTitle: parsed.templates.check.success_title,
          successSummary: parsed.templates.check.success_summary,
          failureTitle: parsed.templates.check.failure_title,
          failureSummary: parsed.templates.check.failure_summary,
          disabledTitle: parsed.templates.check.disabled_title,
          disabledSummary: parsed.templates.check.disabled_summary,
        },
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigurationError(`Invalid .github/cla.yml: ${error.message}`);
    }
    throw error;
  }
}

export async function loadClaConfig(
  client: GitHubClient,
  repo: RepoCoordinates & { ref: string },
): Promise<ClaConfig> {
  const file = await client.readFile({
    owner: repo.owner,
    repo: repo.repo,
    path: '.github/cla.yml',
    ref: repo.ref,
  });

  if (!file) {
    throw new ConfigurationError('Missing .github/cla.yml on the PR base branch');
  }

  return parseClaConfig(file.content);
}
