"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContributor = createContributor;
const githubLogin_1 = require("../utils/githubLogin");
function createContributor(login, source) {
    const githubLogin = (0, githubLogin_1.normalizeGitHubLogin)(login);
    return {
        githubLogin,
        source,
        isBot: githubLogin.endsWith('[bot]'),
    };
}
