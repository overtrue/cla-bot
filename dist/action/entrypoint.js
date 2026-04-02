"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const handleIssueComment_1 = require("./handleIssueComment");
const handlePullRequestTarget_1 = require("./handlePullRequestTarget");
const client_1 = require("../github/client");
function getRepositoryOwner() {
    const repository = github.context.payload.repository;
    if (repository?.owner?.login) {
        return repository.owner.login;
    }
    const [owner] = github.context.repo.owner ? [github.context.repo.owner] : (repository?.full_name ?? '').split('/');
    if (!owner) {
        throw new Error('Unable to resolve repository owner from GitHub context');
    }
    return owner;
}
async function run() {
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('github-token input is required');
    }
    const client = (0, client_1.createGitHubClient)(token);
    const owner = getRepositoryOwner();
    const repo = github.context.payload.repository?.name ?? github.context.repo.repo;
    switch (github.context.eventName) {
        case 'pull_request_target': {
            const action = github.context.payload.action;
            const pullRequest = github.context.payload.pull_request;
            if (!pullRequest || !['opened', 'reopened', 'synchronize'].includes(action ?? '')) {
                return;
            }
            await (0, handlePullRequestTarget_1.handlePullRequestTarget)(client, {
                owner,
                repo,
                pullNumber: pullRequest.number,
            });
            return;
        }
        case 'issue_comment': {
            if (github.context.payload.action !== 'created') {
                return;
            }
            const issue = github.context.payload.issue;
            const comment = github.context.payload.comment;
            if (!issue?.pull_request || !comment) {
                return;
            }
            await (0, handleIssueComment_1.handleIssueComment)(client, {
                owner,
                repo,
                pullNumber: issue.number,
                comment: {
                    id: comment.id,
                    body: comment.body ?? '',
                    userLogin: comment.user?.login ?? null,
                    ...(comment.created_at ? { createdAt: comment.created_at } : {}),
                },
            });
            return;
        }
        default:
            core.info(`Ignoring unsupported event: ${github.context.eventName}`);
    }
}
