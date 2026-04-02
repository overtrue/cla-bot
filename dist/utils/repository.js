"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRepository = parseRepository;
const errors_1 = require("../core/errors");
function parseRepository(fullName) {
    const [owner, repo, ...rest] = fullName.split('/');
    if (!owner || !repo || rest.length > 0) {
        throw new errors_1.ConfigurationError(`Invalid repository reference: ${fullName}`);
    }
    return { owner, repo };
}
