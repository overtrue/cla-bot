"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCoauthorLogins = extractCoauthorLogins;
exports.resolveContributorsFromSnapshot = resolveContributorsFromSnapshot;
exports.resolveContributors = resolveContributors;
const normalizeContributor_1 = require("./normalizeContributor");
const githubLogin_1 = require("../utils/githubLogin");
const COAUTHOR_PATTERN = /Co-authored-by:\s*(?:.+?\s)?(?:\(@)?@([A-Za-z0-9-]+(?:\[bot\])?)/gi;
function extractCoauthorLogins(message) {
    return [...message.matchAll(COAUTHOR_PATTERN)].map((match) => (0, githubLogin_1.normalizeGitHubLogin)(match[1] ?? ''));
}
function resolveContributorsFromSnapshot(pullRequest, commits, config) {
    const allowlist = new Set(config.contributors.allowlist.map(githubLogin_1.normalizeGitHubLogin));
    const contributors = new Map();
    const add = (login, source) => {
        if (!login) {
            return;
        }
        const contributor = (0, normalizeContributor_1.createContributor)(login, source);
        if (config.contributors.excludeBots && contributor.isBot) {
            return;
        }
        if (allowlist.has(contributor.githubLogin)) {
            return;
        }
        contributors.set(contributor.githubLogin, contributors.get(contributor.githubLogin) ?? contributor);
    };
    if (config.contributors.checkPrAuthor) {
        add(pullRequest.authorLogin, 'pr_author');
    }
    if (config.contributors.checkCommitAuthors) {
        for (const commit of commits) {
            add(commit.authorLogin, 'commit_author');
        }
    }
    if (config.contributors.checkCoauthors) {
        for (const commit of commits) {
            for (const login of extractCoauthorLogins(commit.message)) {
                add(login, 'coauthor');
            }
        }
    }
    return [...contributors.values()];
}
async function resolveContributors(input) {
    const commits = await input.client.listPullRequestCommits(input.pullRequest);
    return resolveContributorsFromSnapshot(input.pullRequest, commits, input.config);
}
