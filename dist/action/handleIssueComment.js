"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIssueComment = handleIssueComment;
const signatureMatcher_1 = require("../cla/signatureMatcher");
const config_1 = require("../core/config");
const engine_1 = require("../core/engine");
const logger_1 = require("../core/logger");
const statusReporter_1 = require("../github/statusReporter");
const createRegistry_1 = require("../registry/createRegistry");
const githubLogin_1 = require("../utils/githubLogin");
async function handleIssueComment(client, input) {
    const pullRequest = await client.getPullRequest(input);
    const config = await (0, config_1.loadClaConfig)(client, {
        owner: input.owner,
        repo: input.repo,
        ref: pullRequest.baseRef,
    });
    if (!config.enabled || !(0, signatureMatcher_1.matchesSignatureComment)(input.comment.body, config)) {
        return;
    }
    const reporter = new statusReporter_1.GitHubStatusReporter(client);
    const registry = (0, createRegistry_1.createRegistry)(client, config);
    const evaluation = await (0, engine_1.evaluatePullRequest)({
        client,
        pullRequest,
        config,
        registry,
    });
    const signer = input.comment.userLogin ? (0, githubLogin_1.normalizeGitHubLogin)(input.comment.userLogin) : null;
    if (!signer || !evaluation.missing.some(contributor => contributor.githubLogin === signer)) {
        (0, logger_1.logFields)({
            event: 'issue_comment',
            repo: `${input.owner}/${input.repo}`,
            pr: input.pullNumber,
            comment_id: input.comment.id,
            signer: signer ?? 'unknown',
            result: 'ignored',
        });
        return;
    }
    await registry.saveSignature({
        githubLogin: signer,
        signerType: 'individual',
        claVersion: evaluation.cla.version,
        documentUrl: evaluation.cla.url,
        ...(evaluation.cla.sha256 ? { documentSha256: evaluation.cla.sha256 } : {}),
        signedAt: input.comment.createdAt ?? new Date().toISOString(),
        sourceRepo: `${input.owner}/${input.repo}`,
        sourcePrNumber: input.pullNumber,
        sourceCommentId: input.comment.id,
        registryType: config.registry.type,
    });
    const nextEvaluation = await (0, engine_1.evaluatePullRequest)({
        client,
        pullRequest,
        config,
        registry,
    });
    (0, logger_1.logFields)({
        event: 'issue_comment',
        repo: `${input.owner}/${input.repo}`,
        pr: input.pullNumber,
        comment_id: input.comment.id,
        signer,
        cla_version: evaluation.cla.version,
        registry: config.registry.type,
        result: 'signature_saved',
    });
    await reporter.syncStatus({
        pullRequest,
        config,
        evaluation: nextEvaluation,
    });
}
