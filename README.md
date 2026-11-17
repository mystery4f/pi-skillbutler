# pi-skillbutler

Skill preferences and visibility for pi: one curated skill list, a per-skill writing style, and
`$name` path injection — the features that survived when `pi-context-broker` was being retired.

## Install

```bash
pi install npm:pi-skillbutler
```

## Usage

Type `$name` anywhere in a prompt and the turn gets one line pointing at that skill's `SKILL.md`;
the body is never pasted, so the file stays the only copy. A name that answers to nothing is
reported once, with the names that do exist. Fenced code blocks are left alone.

The `$` popup lists every skill: managed ones first by weight, then hidden ones (marked
`[hidden]`), then skills pi loads from elsewhere (`[unmanaged]`). The description is the Chinese
translation when `i18n.json` has one.

`/skill-pro list`, `show <name>`, `why <name>`, `set <name> <key> <value>`, `unset <name> <key>`, `reset`
— `/skillbutler` is an alias. Writes only ever touch the user file. The model gets one read-only
tool, `skillbutler_status`, so it can answer "why is this skill missing?" without guessing.
## Configuration

User level: `~/.pi/agent/skill-pro.yml`. Project level: `.pi/skill-pro.yml`, which overrides the
user level per skill.

## Scripts

- `npm run verify` — typecheck, lint and test; the gate every change has to pass.
- `npm run test:unit` / `npm run test:integration` — the fast inner loop and the seam tests.

## License

MIT
