"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRepoRegistry = void 0;
function fromJsonSignature(login, signerType, signature) {
    return {
        githubLogin: login,
        signerType,
        claVersion: signature.cla_version,
        documentUrl: signature.document_url,
        ...(signature.document_sha256 ? { documentSha256: signature.document_sha256 } : {}),
        signedAt: signature.signed_at,
        sourceRepo: signature.source_repo,
        sourcePrNumber: signature.source_pr_number,
        ...(signature.source_comment_id ? { sourceCommentId: signature.source_comment_id } : {}),
        registryType: 'json-repo',
    };
}
function toJsonSignature(record) {
    return {
        cla_version: record.claVersion,
        signed_at: record.signedAt,
        document_url: record.documentUrl,
        ...(record.documentSha256 ? { document_sha256: record.documentSha256 } : {}),
        source_repo: record.sourceRepo,
        source_pr_number: record.sourcePrNumber,
        ...(record.sourceCommentId ? { source_comment_id: record.sourceCommentId } : {}),
    };
}
function stringify(file) {
    return `${JSON.stringify(file, null, 2)}\n`;
}
class JsonRepoRegistry {
    client;
    registryRepo;
    pathPrefix;
    constructor(client, registryRepo, pathPrefix) {
        this.client = client;
        this.registryRepo = registryRepo;
        this.pathPrefix = pathPrefix;
    }
    async findSignature(input) {
        const file = await this.loadFile(input.githubLogin, 'individual');
        if (!file) {
            return null;
        }
        const match = file.signatures.find(signature => signature.cla_version === input.claVersion);
        return match ? fromJsonSignature(file.github_login, file.signer_type, match) : null;
    }
    async saveSignature(record) {
        const path = this.pathFor(record.githubLogin, record.signerType);
        const existing = await this.client.readFile({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            path,
        });
        if (!existing) {
            await this.client.writeFile({
                owner: this.registryRepo.owner,
                repo: this.registryRepo.repo,
                path,
                message: `chore: record CLA signature for ${record.githubLogin}`,
                content: stringify({
                    github_login: record.githubLogin,
                    signer_type: record.signerType,
                    signatures: [toJsonSignature(record)],
                }),
            });
            return record;
        }
        const parsed = JSON.parse(existing.content);
        const match = parsed.signatures.find(signature => signature.cla_version === record.claVersion);
        if (match) {
            return fromJsonSignature(parsed.github_login, parsed.signer_type, match);
        }
        parsed.signatures.push(toJsonSignature(record));
        await this.client.writeFile({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            path,
            sha: existing.sha,
            message: `chore: record CLA signature for ${record.githubLogin}`,
            content: stringify(parsed),
        });
        return record;
    }
    async loadFile(login, signerType) {
        const file = await this.client.readFile({
            owner: this.registryRepo.owner,
            repo: this.registryRepo.repo,
            path: this.pathFor(login, signerType),
        });
        return file ? JSON.parse(file.content) : null;
    }
    pathFor(login, signerType) {
        return `${this.pathPrefix}/${signerType}/${login}.json`;
    }
}
exports.JsonRepoRegistry = JsonRepoRegistry;
