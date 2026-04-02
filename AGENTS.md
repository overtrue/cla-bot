# Repository Guide

## Source of truth

- Product requirements may exist locally in `prd.md` during active design work.
- The local execution checklist lives in `implements_todo.md`.
- If both are present and disagree, follow `prd.md` and update the checklist.

## Engineering rules

- Prefer small pure functions over framework-heavy abstractions.
- Keep names short, precise, and boring.
- Do not change behavior just to satisfy a test.
- Every GitHub write must be idempotent.
- Keep event handling side effects at the edge; keep decision logic testable.

## Project shape

- `src/core`: shared types, config, engine, logger.
- `src/action`: event entrypoints and handlers.
- `src/contributors`: contributor discovery and normalization.
- `src/cla`: CLA document and signature matching.
- `src/registry`: pluggable signature backends.
- `src/github`: GitHub API adapter and status reporting.
- `tests`: unit and integration coverage.

## Working agreement

- Update `README.md` when behavior or setup changes.
- Add or update tests in the same change as the behavior.
- Keep docs concise and optimized for both humans and coding agents.
- Avoid hidden magic; prefer explicit data flow over clever indirection.
- Treat `prd.md` and `implements_todo.md` as local planning files, not repository artifacts.
