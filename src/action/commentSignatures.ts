import { matchesSignatureComment } from '../cla/signatureMatcher';
import type { ClaConfig, Contributor, IssueCommentSnapshot } from '../core/types';
import { normalizeGitHubLogin } from '../utils/githubLogin';

export type MatchingSignatureComment = {
  signer: string;
  comment: IssueCommentSnapshot;
};

export function findMatchingSignatureComments(input: {
  comments: IssueCommentSnapshot[];
  missing: Contributor[];
  config: ClaConfig;
}): MatchingSignatureComment[] {
  const pending = new Set(input.missing.map(contributor => contributor.githubLogin));
  const matches = new Map<string, MatchingSignatureComment>();

  for (const comment of input.comments) {
    if (!comment.userLogin || !matchesSignatureComment(comment.body, input.config)) {
      continue;
    }

    const signer = normalizeGitHubLogin(comment.userLogin);

    if (!pending.has(signer) || matches.has(signer)) {
      continue;
    }

    matches.set(signer, { signer, comment });
  }

  return [...matches.values()];
}

export function signatureTimestamp(comment: IssueCommentSnapshot): string {
  return comment.updatedAt ?? comment.createdAt ?? new Date().toISOString();
}
