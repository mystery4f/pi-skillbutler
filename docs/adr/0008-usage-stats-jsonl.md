# 0008 — Usage statistics are an append-only JSONL log

Date: 2026-11-17
Status: accepted

## Context

T7 (使用统计) counts how often each managed skill is used. The spec forbids mixing
the counts into the preference files (chain-state open question d), and the chain's
process phase owns the record-store discipline. pi-skillbutler spawns no child
processes, so the honest scope of the phase here is the record store itself.

## Decision

One append-only JSONL file, `~/.pi/agent/skillbutler-stats.jsonl` (`usageStatsFile`).
One event per line: `{"skill":"…","at":"<ISO>","via":"…"}`, with `via` optional.
Counts and last-use are computed at read time by `summarizeUsage`, never stored.
Writes are single-line `appendFile` calls; reads skip any line that does not parse
as an event. The counting hooks themselves fire in Phase 5, where the `$name`
matcher already runs.

## Alternatives

- One JSON counter map — read-modify-write: two concurrent sessions lose each
  other's counts, and one corrupt write loses every count. Rejected.
- Per-session `records.json` under `<cwd>/.pi/<plugin>/…` — the layout the process
  phase prescribes for task records. Wrong scope: usage is machine-wide, not per
  project. Rejected.
- SQLite or another store dependency — the data is a flat count list; a dependency
  buys nothing. Rejected.
- Inside `skill-pro.yml` — forbidden by the spec: preferences are hand-edited,
  events are machine-written. Rejected.

## Consequences

- Concurrent sessions append safely: one `O_APPEND` write per line.
- The file grows without bound; v1 accepts it (one short line per use), and a
  reset can be added to `/skill-pro` later.
- A crash may truncate the last line; the loader skips it, losing at most one event.
