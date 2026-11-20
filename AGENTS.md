# AGENTS.md

`pi-skillbutler` is a pi extension written in TypeScript (ESM). `src/index.ts` is the entry point
pi loads from the git source; `dist/` only exists for the published package.

## Gates

- `npm run verify` — typecheck, lint and test in one pass. Every change goes through it; the
  pre-commit hook runs the same command.
- `npm run lint:fix` — the only reliable biome entry here. `npx biome …` fails with
  `could not determine executable to run` and leaves the files unchanged, so a formatting error
  looks fixed while it is not.
- `npm run build` — typecheck with the publishing tsconfig and write `dist/`.

## Layout

- `src/skills/inventory.ts` — scan the two managed roots into records.
- `src/skills/watcher.ts` — watch those roots so an install or removal lands without a reload
  (ADR-0011).
- `src/commands/skillbutler.ts` — the `/skillbutler` command; the only writer of the preference
  file.
- `src/preferences/` — read-merge-write with a lock (ADR-0003, ADR-0010).
- `src/invocation/` — `$name` scanning, path injection and the once-per-turn report.
- `docs/adr/` — the decisions; read the one that touches your change before editing.

## Conventions

- Comments and commit messages are English; Conventional Commits prefixes.
- Single-statement control-flow bodies carry no braces.
- Every new source file carries `@author mystery4f <40482524+mystery4f@users.noreply.github.com>`.
