export type RegistryType = 'issue' | 'json-repo';
export type ContributorSource = 'pr_author' | 'commit_author' | 'coauthor';
export type SignerType = 'individual' | 'corporate';
export type CheckConclusion = 'success' | 'failure' | 'neutral';

export type ClaDocument = {
  version: string;
  url: string;
  sha256?: string;
};

export type Contributor = {
  githubLogin: string;
  source: ContributorSource;
  isBot: boolean;
};

export type SignatureRecord = {
  githubLogin: string;
  signerType: SignerType;
  claVersion: string;
  documentUrl: string;
  documentSha256?: string;
  signedAt: string;
  sourceRepo: string;
  sourcePrNumber: number;
  sourceCommentId?: number;
  registryType: RegistryType;
  registryUrl?: string;
};

export type SignatureCheckResult = {
  contributor: Contributor;
  signed: boolean;
  signature?: SignatureRecord;
  reason?: string;
};

export type ClaConfig = {
  enabled: boolean;
  document: ClaDocument;
  signing: {
    mode: 'comment';
    commentPattern: string;
    caseInsensitive: boolean;
    trimWhitespace: boolean;
  };
  contributors: {
    checkPrAuthor: boolean;
    checkCommitAuthors: boolean;
    checkCoauthors: boolean;
    excludeBots: boolean;
    allowlist: string[];
  };
  registry: {
    type: RegistryType;
    repository: string;
    pathPrefix: string;
    branch?: string;
  };
  status: {
    checkName: string;
    commentTag: string;
  };
  templates: {
    registry: {
      commitMessage: string;
    };
    pr: {
      missingComment: string;
      successComment: string;
    };
    check: {
      successTitle: string;
      successSummary: string;
      failureTitle: string;
      failureSummary: string;
      disabledTitle: string;
      disabledSummary: string;
    };
  };
};

export type RepoCoordinates = {
  owner: string;
  repo: string;
};

export type IssueRef = RepoCoordinates & {
  issueNumber: number;
};

export type PullRequestRef = RepoCoordinates & {
  pullNumber: number;
};

export type PullRequestSnapshot = PullRequestRef & {
  authorLogin: string | null;
  headSha: string;
  baseRef: string;
  htmlUrl: string;
};

export type PullCommit = {
  authorLogin: string | null;
  message: string;
};

export type IssueCommentSnapshot = {
  id: number;
  body: string;
  userLogin: string | null;
  createdAt?: string;
};

export type RepoFile = {
  content: string;
  sha: string;
  htmlUrl?: string;
};

export type ClaEvaluation = {
  cla: ClaDocument;
  contributors: Contributor[];
  results: SignatureCheckResult[];
  missing: Contributor[];
};
