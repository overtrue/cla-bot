import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const YAML_BLOCK = /```yaml\s*([\s\S]*?)```/i;

export function parseYamlBlock<T>(source: string): T | null {
  const match = source.match(YAML_BLOCK);
  const body = (match?.[1] ?? source).trim();

  if (!body) {
    return null;
  }

  return (parseYaml(body) as T | null) ?? null;
}

export function renderYamlBlock(data: unknown): string {
  return `\`\`\`yaml\n${stringifyYaml(data).trimEnd()}\n\`\`\``;
}
