"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationError = void 0;
class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
