"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueRegistry = void 0;
const yamlBlock_1 = require("../utils/yamlBlock");
function toIssueBody(record) {
    return [
        '# CLA Signature',
        '',
        (0, yamlBlock_1.renderYamlBlock)({
            github_login: record.githubLogin,
            signer_type: record.signerType,
            latest_cla_version: record.claVersion,
            latest_signed_at: record.signedAt,
            latest_document_url: record.documentUrl,
            ...(record.documentSha256 ? { latest_document_sha256: record.documentSha256 } : {}),
            latest_source_repo: record.sourceRepo,
            latest_source_pr_number: record.sourcePrNumber,
            ...(record.sourceCommentId ? { latest_source_comment_id: record.sourceCommentId } : {}),
        }),
    ].join('\n');
}
function toIssueComment(record) {
    return (0, yamlBlock_1.renderYamlBlock)({
        event: 'cla_signed',
        github_login: record.githubLogin,
        signer_type: record.signerType,
        cla_version: record.claVersion,
        signed_at: record.signedAt,
        document_url: record.documentUrl,
        ...(record.documentSha256 ? { document_sha256: record.documentSha256 } : {}),
        source_repo: record.sourceRepo,
        source_pr_number: record.sourcePrNumber,
        ...(record.sourceCommentId ? { source_comment_id: record.sourceCommentId } : {}),
    });
}
function fromIssueBody(body) {
    const parsed = (0, yamlBlock_1.parseYamlBlock)(body);
    if (!parsed?.github_login || !parsed.latest_cla_version) {
        return null;
    }
    return {
        githubLogin: parsed.github_login,
        signerType: parsed.signer_type,
        claVersion: parsed.latest_cla_version,
        documentUrl: parsed.latest_document_url,
        ...(parsed.latest_document_sha256 ? { documentSha256: parsed.latest_document_sha256 } : {}),
        signedAt: parsed.latest_signed_at,
        sourceRepo: parsed.latest_source_repo,
        sourcePrNumber: Number(parsed.latest_source_pr_number),
        ...(parsed.latest_source_comment_id ? { sourceCommentId: Number(parsed.latest_source_comment_id) } : {}),
        registryType: 'issue',
    };
}
function fromIssueComment(body) {
    const parsed = (0, yamlBlock_1.parseYamlBlock)(body);
    if (!parsed || parsed.event !== 'cla_signed') {
        return null;
    }
    return {
        githubLogin: parsed.github_login,
        signerType: parsed.signer_type,
        claVersion: parsed.cla_version,
        documentUrl: parsed.document_url,
        ...(parsed.document_sha256 ? { documentSha256: parsed.document_sha256 } : {}),
        signedAt: parsed.signed_at,
        sourceRepo: parsed.source_repo,
        sourcePrNumber: Number(parsed.source_pr_number),
        ...(parsed.source_comment_id ? { sourceCommentId: Number(parsed.source_comment_id) } : {}),
        registryType: 'issue',
    };
}
function pickSignature(records, claVersion) {
    return (records
        .filter(record => record.claVersion === claVersion)
        .sort((left, right) => right.signedAt.localeCompare(left.signedAt))[0] ?? null);
}
class IssueRegistry {
    client;
    registryRepo;
    constructor(client, registryRepo) {
        this.client = client;
        this.registryRepo = registryRepo;
    }
    async findSignature(input) {
        const issue = await this.client.findIssueByTitle({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            title: this.titleFor(input.githubLogin),
        });
        if (!issue) {
            return null;
        }
        const records = await this.loadRecords(issue.number, issue.body);
        return pickSignature(records, input.claVersion);
    }
    async saveSignature(record) {
        const title = this.titleFor(record.githubLogin);
        const existingIssue = await this.client.findIssueByTitle({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            title,
        });
        if (!existingIssue) {
            const issue = await this.client.createIssue({
                owner: this.registryRepo.owner,
                repo: this.registryRepo.repo,
                title,
                body: toIssueBody(record),
                labels: this.labels(record),
            });
            await this.client.createIssueComment({
                owner: this.registryRepo.owner,
                repo: this.registryRepo.repo,
                issueNumber: issue.number,
                body: toIssueComment(record),
            });
            return record;
        }
        const records = await this.loadRecords(existingIssue.number, existingIssue.body);
        const existing = pickSignature(records, record.claVersion);
        if (existing) {
            return existing;
        }
        await this.client.updateIssue({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            issueNumber: existingIssue.number,
            body: toIssueBody(record),
            labels: this.labels(record),
        });
        await this.client.createIssueComment({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            issueNumber: existingIssue.number,
            body: toIssueComment(record),
        });
        return record;
    }
    async loadRecords(issueNumber, issueBody) {
        const comments = await this.client.listIssueComments({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            issueNumber,
        });
        return [fromIssueBody(issueBody), ...comments.map(comment => fromIssueComment(comment.body))].filter((record) => Boolean(record));
    }
    labels(record) {
        return ['cla:signed', `cla:${record.claVersion}`, `signer:${record.signerType}`];
    }
    titleFor(login) {
        return `CLA - ${login}`;
    }
}
exports.IssueRegistry = IssueRegistry;
