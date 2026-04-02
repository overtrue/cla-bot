"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePullRequestTarget = handlePullRequestTarget;
const engine_1 = require("../core/engine");
const config_1 = require("../core/config");
const logger_1 = require("../core/logger");
const statusReporter_1 = require("../github/statusReporter");
const createRegistry_1 = require("../registry/createRegistry");
async function handlePullRequestTarget(client, input) {
    const pullRequest = await client.getPullRequest(input);
    const config = await (0, config_1.loadClaConfig)(client, {
        owner: input.owner,
        repo: input.repo,
        ref: pullRequest.baseRef,
    });
    const reporter = new statusReporter_1.GitHubStatusReporter(client);
    if (!config.enabled) {
        (0, logger_1.logFields)({
            event: 'pull_request_target',
            repo: `${input.owner}/${input.repo}`,
            pr: input.pullNumber,
            result: 'disabled',
        });
        await reporter.reportDisabled({ pullRequest, config });
        return;
    }
    const evaluation = await (0, engine_1.evaluatePullRequest)({
        client,
        pullRequest,
        config,
        registry: (0, createRegistry_1.createRegistry)(client, config),
    });
    (0, logger_1.logFields)({
        event: 'pull_request_target',
        repo: `${input.owner}/${input.repo}`,
        pr: input.pullNumber,
        cla_version: evaluation.cla.version,
        contributors: evaluation.contributors.map(contributor => contributor.githubLogin),
        missing: evaluation.missing.map(contributor => contributor.githubLogin),
        registry: config.registry.type,
        result: evaluation.missing.length === 0 ? 'success' : 'failure',
    });
    await reporter.syncStatus({
        pullRequest,
        config,
        evaluation,
    });
}
