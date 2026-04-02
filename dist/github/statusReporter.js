"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubStatusReporter = void 0;
function formatContributors(contributors) {
    return contributors.map(contributor => `- @${contributor.githubLogin}`).join('\n');
}
function buildFailureComment(config, evaluation) {
    return [
        config.status.commentTag,
        '',
        'This pull request requires CLA signatures before it can be merged.',
        '',
        'Missing signatures:',
        '',
        formatContributors(evaluation.missing),
        '',
        'To sign the CLA, each missing contributor must comment exactly:',
        '',
        `\`${config.signing.commentPattern}\``,
        '',
        'CLA document:',
        `<${evaluation.cla.url}>`,
    ].join('\n');
}
function buildSuccessComment(config) {
    return [config.status.commentTag, '', 'CLA requirements are satisfied for this pull request.'].join('\n');
}
function buildSummary(config, evaluation) {
    if (evaluation.missing.length === 0) {
        return {
            title: 'CLA satisfied',
            summary: [
                `All required contributors have signed ${evaluation.cla.version}.`,
                '',
                'Contributors checked:',
                '',
                evaluation.contributors.length === 0 ? '- none' : formatContributors(evaluation.contributors),
            ].join('\n'),
        };
    }
    return {
        title: 'CLA signatures required',
        summary: [
            `The following contributors still need to sign ${evaluation.cla.version}:`,
            '',
            formatContributors(evaluation.missing),
            '',
            `Required comment: \`${config.signing.commentPattern}\``,
            `Document: <${evaluation.cla.url}>`,
        ].join('\n'),
    };
}
class GitHubStatusReporter {
    client;
    constructor(client) {
        this.client = client;
    }
    async syncStatus(input) {
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
    async reportDisabled(input) {
        await this.client.createCheckRun({
            owner: input.pullRequest.owner,
            repo: input.pullRequest.repo,
            name: input.config.status.checkName,
            headSha: input.pullRequest.headSha,
            conclusion: 'success',
            title: 'CLA disabled',
            summary: 'CLA enforcement is disabled for this repository.',
        });
    }
    async upsertInstructionComment(input) {
        const comments = await this.client.listIssueComments({
            owner: input.pullRequest.owner,
            repo: input.pullRequest.repo,
            issueNumber: input.pullRequest.pullNumber,
        });
        const existing = comments.find(comment => comment.body.includes(input.config.status.commentTag));
        const body = input.evaluation.missing.length === 0
            ? buildSuccessComment(input.config)
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
exports.GitHubStatusReporter = GitHubStatusReporter;
