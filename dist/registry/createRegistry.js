"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegistry = createRegistry;
const repository_1 = require("../utils/repository");
const issueRegistry_1 = require("./issueRegistry");
const jsonRepoRegistry_1 = require("./jsonRepoRegistry");
function createRegistry(client, config) {
    const registryRepo = (0, repository_1.parseRepository)(config.registry.repository);
    if (config.registry.type === 'issue') {
        return new issueRegistry_1.IssueRegistry(client, registryRepo);
    }
    return new jsonRepoRegistry_1.JsonRepoRegistry(client, registryRepo, config.registry.pathPrefix);
}
