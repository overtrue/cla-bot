"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseClaConfig = parseClaConfig;
exports.loadClaConfig = loadClaConfig;
const yaml_1 = require("yaml");
const zod_1 = require("zod");
const errors_1 = require("./errors");
const githubLogin_1 = require("../utils/githubLogin");
const rawConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    document: zod_1.z.object({
        version: zod_1.z.string().min(1),
        url: zod_1.z.string().url(),
        sha256: zod_1.z.string().min(1).optional(),
    }),
    signing: zod_1.z
        .object({
        mode: zod_1.z.literal('comment').default('comment'),
        comment_pattern: zod_1.z.string().min(1).default('I have read and agree to the CLA.'),
        case_insensitive: zod_1.z.boolean().default(true),
        trim_whitespace: zod_1.z.boolean().default(true),
    })
        .default({
        mode: 'comment',
        comment_pattern: 'I have read and agree to the CLA.',
        case_insensitive: true,
        trim_whitespace: true,
    }),
    contributors: zod_1.z
        .object({
        check_pr_author: zod_1.z.boolean().default(true),
        check_commit_authors: zod_1.z.boolean().default(true),
        check_coauthors: zod_1.z.boolean().default(false),
        exclude_bots: zod_1.z.boolean().default(true),
        allowlist: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    })
        .default({
        check_pr_author: true,
        check_commit_authors: true,
        check_coauthors: false,
        exclude_bots: true,
        allowlist: [],
    }),
    registry: zod_1.z.object({
        type: zod_1.z.enum(['issue', 'json-repo']),
        repository: zod_1.z.string().regex(/^[^/]+\/[^/]+$/, 'registry.repository must be owner/repo'),
        path_prefix: zod_1.z.string().min(1).default('signatures'),
    }),
    status: zod_1.z
        .object({
        check_name: zod_1.z.string().min(1).default('CLA Check'),
        comment_tag: zod_1.z.string().min(1).default('<!-- cla-bot -->'),
    })
        .default({
        check_name: 'CLA Check',
        comment_tag: '<!-- cla-bot -->',
    }),
});
function parseClaConfig(raw) {
    try {
        const parsed = rawConfigSchema.parse((0, yaml_1.parse)(raw) ?? {});
        return {
            enabled: parsed.enabled,
            document: {
                version: parsed.document.version,
                url: parsed.document.url,
                ...(parsed.document.sha256 ? { sha256: parsed.document.sha256 } : {}),
            },
            signing: {
                mode: parsed.signing.mode,
                commentPattern: parsed.signing.comment_pattern,
                caseInsensitive: parsed.signing.case_insensitive,
                trimWhitespace: parsed.signing.trim_whitespace,
            },
            contributors: {
                checkPrAuthor: parsed.contributors.check_pr_author,
                checkCommitAuthors: parsed.contributors.check_commit_authors,
                checkCoauthors: parsed.contributors.check_coauthors,
                excludeBots: parsed.contributors.exclude_bots,
                allowlist: parsed.contributors.allowlist.map(githubLogin_1.normalizeGitHubLogin),
            },
            registry: {
                type: parsed.registry.type,
                repository: parsed.registry.repository,
                pathPrefix: parsed.registry.path_prefix,
            },
            status: {
                checkName: parsed.status.check_name,
                commentTag: parsed.status.comment_tag,
            },
        };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new errors_1.ConfigurationError(`Invalid .github/cla.yml: ${error.message}`);
        }
        throw error;
    }
}
async function loadClaConfig(client, repo) {
    const file = await client.readFile({
        owner: repo.owner,
        repo: repo.repo,
        path: '.github/cla.yml',
        ref: repo.ref,
    });
    if (!file) {
        throw new errors_1.ConfigurationError('Missing .github/cla.yml on the PR base branch');
    }
    return parseClaConfig(file.content);
}
