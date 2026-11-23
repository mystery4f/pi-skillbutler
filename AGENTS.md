# AGENTS.md

`pi-skillbutler` is a pi extension written in TypeScript (ESM). `src/index.ts` is the entry point
pi loads from the git source; `dist/` only exists for the published package.

## Gates

- `npm run verify` — typecheck, lint and test in one pass. Every change goes through it; the
  pre-commit hook runs the same command.
- `npm run lint:fix` — the only reliable biome entry here. `npx biome …` fails with
  `npx canceled due to missing packages` (it tries to install `eslint@10.15.0`) and leaves the files
  unchanged, so a formatting error
  looks fixed while it is not. `node_modules/.bin/biome check --fix .` works when the script cannot be
  used.
- `npm run build` — typecheck with the publishing tsconfig and write `dist/`.

## Install

- pi clones this repo as a git plugin and installs it with `npm install --omit=dev`, which still
  runs `prepare` while every devDependency is absent. `prepare` therefore runs
  `scripts/prepare.mjs`, which installs the husky hooks when husky is present and exits quietly when
  it is not; a bare `husky` or `husky || true` there fails the whole plugin install on Windows.

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
