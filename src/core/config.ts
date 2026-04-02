import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { ConfigurationError } from './errors';
import type { ClaConfig, RepoCoordinates } from './types';
import type { GitHubClient } from '../github/client';
import { normalizeGitHubLogin } from '../utils/githubLogin';

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
    })
    .default({
      mode: 'comment',
      comment_pattern: 'I have read and agree to the CLA.',
      case_insensitive: true,
      trim_whitespace: true,
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
      },
      status: {
        checkName: parsed.status.check_name,
        commentTag: parsed.status.comment_tag,
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
