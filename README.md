# pi-skill-pro

Skill preferences and visibility for pi: one curated skill list, a per-skill writing style, and
`$name` path injection — the features that survived when `pi-context-broker` was being retired.

## Install

```bash
pi install npm:pi-skill-pro
```

## What it does

- Reads four keys per skill from one preference file: `hidden`, `weight`, `language`, `style`.
- Rewrites the skill list the model sees each turn, plus one capped overview of what else exists.
- Injects only the `SKILL.md` path when you type `$name` — never the body.
- Completes `$` in the input box, translated where `pi-i18n` already translates `/skill:name`.
- Reports read-only status to the model and keeps the human's controls in `/skill-pro`.

## Configuration

User level: `~/.pi/agent/skill-pro.yml`. Project level: `.pi/skill-pro.yml`, which overrides the
user level per skill.

## Scripts

- `npm run verify` — typecheck, lint and test; the gate every change has to pass.
- `npm run test:unit` / `npm run test:integration` — the fast inner loop and the seam tests.

## License

MIT
