import type { PullCommit, PullRequestSnapshot, RegistryType } from '../../src/core/types';

export function claConfigYaml(input?: {
  version?: string;
  repository?: string;
  registryType?: RegistryType;
  pathPrefix?: string;
  allowlist?: string[];
  caseInsensitive?: boolean;
  trimWhitespace?: boolean;
  checkCommitAuthors?: boolean;
}): string {
  const allowlist = input?.allowlist ?? [];

  return [
    'enabled: true',
    '',
    'document:',
    `  version: ${input?.version ?? 'v1'}`,
    `  url: https://example.com/cla/${input?.version ?? 'v1'}`,
    '',
    'signing:',
    '  mode: comment',
    '  comment_pattern: I have read and agree to the CLA.',
    `  case_insensitive: ${String(input?.caseInsensitive ?? true)}`,
    `  trim_whitespace: ${String(input?.trimWhitespace ?? true)}`,
    '',
    'contributors:',
    '  check_pr_author: true',
    `  check_commit_authors: ${String(input?.checkCommitAuthors ?? true)}`,
    '  check_coauthors: false',
    '  exclude_bots: true',
    ...(allowlist.length === 0
      ? ['  allowlist: []']
      : ['  allowlist:', ...allowlist.map(login => `    - ${login}`)]),
    '',
    'registry:',
    `  type: ${input?.registryType ?? 'issue'}`,
    `  repository: ${input?.repository ?? 'org/cla-registry'}`,
    ...(input?.registryType === 'json-repo' || input?.pathPrefix
      ? [`  path_prefix: ${input?.pathPrefix ?? 'signatures'}`]
      : []),
    '',
    'status:',
    '  check_name: CLA Check',
    '  comment_tag: <!-- cla-bot -->',
    '',
  ].join('\n');
}

export function pullRequest(input?: Partial<PullRequestSnapshot>): PullRequestSnapshot {
  return {
    owner: 'app',
    repo: 'demo',
    pullNumber: 1,
    authorLogin: 'alice',
    headSha: 'head-sha',
    baseRef: 'main',
    htmlUrl: 'https://github.com/app/demo/pull/1',
    ...input,
  };
}

export function commit(authorLogin: string | null, message = 'feat: change'): PullCommit {
  return { authorLogin, message };
}
