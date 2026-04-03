import type { PullCommit, PullRequestSnapshot, RegistryType } from '../../src/core/types';

export function claConfigYaml(input?: {
  version?: string;
  repository?: string;
  registryType?: RegistryType;
  pathPrefix?: string;
  branch?: string;
  allowlist?: string[];
  caseInsensitive?: boolean;
  trimWhitespace?: boolean;
  ignoreTerminalPunctuation?: boolean;
  checkCommitAuthors?: boolean;
  templates?: {
    registryCommitMessage?: string;
    prMissingComment?: string;
    prSuccessComment?: string;
    checkSuccessTitle?: string;
    checkSuccessSummary?: string;
    checkFailureTitle?: string;
    checkFailureSummary?: string;
    checkDisabledTitle?: string;
    checkDisabledSummary?: string;
  };
}): string {
  const allowlist = input?.allowlist ?? [];
  const templateLines: string[] = [];

  if (input?.templates) {
    const registryLines = input.templates.registryCommitMessage
      ? [`    commit_message: ${JSON.stringify(input.templates.registryCommitMessage)}`]
      : [];
    const prLines = [
      ...(input.templates.prMissingComment
        ? [`    missing_comment: ${JSON.stringify(input.templates.prMissingComment)}`]
        : []),
      ...(input.templates.prSuccessComment
        ? [`    success_comment: ${JSON.stringify(input.templates.prSuccessComment)}`]
        : []),
    ];
    const checkLines = [
      ...(input.templates.checkSuccessTitle
        ? [`    success_title: ${JSON.stringify(input.templates.checkSuccessTitle)}`]
        : []),
      ...(input.templates.checkSuccessSummary
        ? [`    success_summary: ${JSON.stringify(input.templates.checkSuccessSummary)}`]
        : []),
      ...(input.templates.checkFailureTitle
        ? [`    failure_title: ${JSON.stringify(input.templates.checkFailureTitle)}`]
        : []),
      ...(input.templates.checkFailureSummary
        ? [`    failure_summary: ${JSON.stringify(input.templates.checkFailureSummary)}`]
        : []),
      ...(input.templates.checkDisabledTitle
        ? [`    disabled_title: ${JSON.stringify(input.templates.checkDisabledTitle)}`]
        : []),
      ...(input.templates.checkDisabledSummary
        ? [`    disabled_summary: ${JSON.stringify(input.templates.checkDisabledSummary)}`]
        : []),
    ];

    if (registryLines.length > 0 || prLines.length > 0 || checkLines.length > 0) {
      templateLines.push('templates:');
    }

    if (registryLines.length > 0) {
      templateLines.push('  registry:', ...registryLines);
    }

    if (prLines.length > 0) {
      templateLines.push('  pr:', ...prLines);
    }

    if (checkLines.length > 0) {
      templateLines.push('  check:', ...checkLines);
    }
  }

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
    `  ignore_terminal_punctuation: ${String(input?.ignoreTerminalPunctuation ?? true)}`,
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
    `  repository: ${input?.repository ?? 'overtrue/cla-registry'}`,
    ...(input?.registryType === 'json-repo' || input?.pathPrefix
      ? [`  path_prefix: ${input?.pathPrefix ?? 'signatures'}`]
      : []),
    ...(input?.branch ? [`  branch: ${input.branch}`] : []),
    '',
    'status:',
    '  check_name: CLA Check',
    '  comment_tag: <!-- cla-bot -->',
    ...(templateLines.length > 0 ? ['', ...templateLines] : []),
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
    baseSha: 'base-sha',
    htmlUrl: 'https://github.com/app/demo/pull/1',
    ...input,
  };
}

export function commit(
  authorLogin: string | null,
  message = 'feat: change',
  input?: { parentShas?: string[] },
): PullCommit {
  return {
    authorLogin,
    message,
    parentShas: input?.parentShas ?? ['parent-sha'],
  };
}
