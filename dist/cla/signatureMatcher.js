"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesSignatureComment = matchesSignatureComment;
function normalize(input, config) {
    let value = input;
    if (config.signing.trimWhitespace) {
        value = value.trim();
    }
    if (config.signing.caseInsensitive) {
        value = value.toLocaleLowerCase('en-US');
    }
    return value;
}
function matchesSignatureComment(commentBody, config) {
    return normalize(commentBody, config) === normalize(config.signing.commentPattern, config);
}
