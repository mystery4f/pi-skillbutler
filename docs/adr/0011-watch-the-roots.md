# ADR-0011 — Watch the managed roots, at their own level

Status: accepted (2026-11-20).

## Context

The inventory was read once, at `session_start`. A skill installed later in the same session was
invisible to `$name` and to the `$` popup until the human typed `/reload`; pi's own skill list has
the same lag and no runtime API to register one. Two constraints shaped the fix:

- The two managed roots hold one directory per skill, so an install or a removal is one rename
  event at the root level. Recursing into every `SKILL.md` buys nothing and costs an event or two
  per file save on a large inventory (this machine carries 90 skills).
- The human asked for exactly that: watch the level, react to add and remove; renaming a skill
  mid-session is not a case worth supporting.

## Decision

Watch each managed root with `fs.watch(root, { persistent: false })`, non-recursive. Every event
only re-arms a debounce (200 ms default), and the debounce fires one `reload()` — the same full
rescan `session_start` runs. `$name` and the popup both read the resulting view, so they change
together; there is no second source of truth to keep in sync.

A root that cannot be watched (missing directory, exotic filesystem) marks the watcher
`accessible: false` rather than throwing, and `before_agent_start` then rescans on every turn. The
degraded path costs two `readdir` calls per turn and never a stale answer.

`dispose()` closes the watchers and clears a pending debounce; a disposed extension must not fire.

## Consequences

- An install or removal is visible after the debounce, without a reload.
- Editing a `SKILL.md` name or body is not watched. The popup description and the frontmatter name
  stay as they were for the session — accepted, since a rename mid-session has no user path.
- Preference files are outside the watch. A preference `set` still applies to the next turn through
  the existing in-memory write, and an external edit still needs `/reload`.
- `watchDebounceMs` is an `ExtensionOptions` seam purely so tests can shrink the wait.
