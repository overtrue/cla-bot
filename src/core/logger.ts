import * as core from '@actions/core';

export function logFields(fields: Record<string, boolean | number | string | string[] | undefined>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }

    const rendered = Array.isArray(value) ? value.join(', ') : String(value);
    core.info(`[${key}] ${rendered}`);
  }
}
