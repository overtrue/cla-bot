"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseYamlBlock = parseYamlBlock;
exports.renderYamlBlock = renderYamlBlock;
const yaml_1 = require("yaml");
const YAML_BLOCK = /```yaml\s*([\s\S]*?)```/i;
function parseYamlBlock(source) {
    const match = source.match(YAML_BLOCK);
    const body = (match?.[1] ?? source).trim();
    if (!body) {
        return null;
    }
    return (0, yaml_1.parse)(body) ?? null;
}
function renderYamlBlock(data) {
    return `\`\`\`yaml\n${(0, yaml_1.stringify)(data).trimEnd()}\n\`\`\``;
}
