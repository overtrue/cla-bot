"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePullRequest = evaluatePullRequest;
const claDocumentResolver_1 = require("../cla/claDocumentResolver");
const contributorResolver_1 = require("../contributors/contributorResolver");
async function evaluatePullRequest(input) {
    const cla = (0, claDocumentResolver_1.resolveClaDocument)(input.config);
    const contributors = await (0, contributorResolver_1.resolveContributors)({
        client: input.client,
        pullRequest: input.pullRequest,
        config: input.config,
    });
    const results = await Promise.all(contributors.map(async (contributor) => {
        const signature = await input.registry.findSignature({
            githubLogin: contributor.githubLogin,
            claVersion: cla.version,
        });
        if (signature) {
            return {
                contributor,
                signed: true,
                signature,
            };
        }
        return {
            contributor,
            signed: false,
            reason: `Missing signature for ${cla.version}`,
        };
    }));
    return {
        cla,
        contributors,
        results,
        missing: results.filter(result => !result.signed).map(result => result.contributor),
    };
}
