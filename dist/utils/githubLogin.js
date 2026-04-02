"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGitHubLogin = normalizeGitHubLogin;
function normalizeGitHubLogin(login) {
    return login.trim().toLocaleLowerCase('en-US');
}
