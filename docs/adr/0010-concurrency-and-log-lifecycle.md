# ADR-0010 — Concurrency, log lifecycle, and the limits that were too tight

Status: accepted (2026-11-17). Amends ADR-0003 (the preference file) and ADR-0008 (the usage log).

## Context

Five P2 items survived the first release, each one a place where a decision was made under
time pressure rather than on evidence:

- The preference file was read-modify-written with no lock. ADR-0003 makes the file
  human-owned, so a lost write has no trace: two sessions that `set` at the same moment keep
  only the later text, and nothing reports it.
- The usage log has no reset. ADR-0008 accepted unbounded growth "for v1"; the file is the
  only record, so a wrong count (a session that named the same skill fifty times) is permanent.
- `skillbutler_status` reported the usage log by reading it, and a permission error failed the
  whole tool. The inventory — the answer the tool exists for — was lost because one line of it
  could not be read.
- The `$` popup capped at 50 items while this machine already carries 90 skills, so the tail was
  reachable only by typing more characters.
- Single-statement `if` bodies carried braces, against the repository's own style.

## Decision

- **Preference writes take a lock.** `withPreferencesLock(file, work)` holds `<file>.lock`,
  created with `open(..., "wx")` (atomic on every platform), removed in a `finally`. A second
  writer retries for 2 s and then fails with a message naming the file. A lock older than 10 s
  is treated as abandoned and reclaimed, so a crashed holder cannot wedge the file. No new
  dependency: `proper-lockfile` would buy a dependency for behaviour we already need to own.
- **`/skill-pro reset` truncates the usage log** and reports how many namings it dropped. The
  command surface stays human-only, which is what ADR-0003 promised for writes.
- **An unreadable usage log degrades one line, not the tool.** The inventory answer and the
  per-skill answer still come back; the usage line reads
  `usage: unavailable (<reason>)` and `details.usageError` carries the reason. A silent zero
  would be worse than the error: it reads as "never named".
- **The popup shows up to 200 items**, chosen to exceed any realistic install (90 today) rather
  than to bound a list the query narrows anyway. The unknown-name hint and the
  `/skill-pro` name hint move from 40 to 60.
- **Single-statement control flow drops its braces**, matching the repository convention.

## Consequences

- Two sessions can no longer lose each other's preference write; the cost is one lock file
  beside the preference file, left behind only if the process is killed outright mid-write.
- The usage log is no longer append-only by contract: `reset` empties it. Append-only within a
  session still holds, and the reader still tolerates torn lines.
- A broken usage log now shows up as one `unavailable` line instead of a failed tool, so the
  inventory is never held hostage by the log.
- Everything above is covered by tests: `test/unit/preference-lock.test.ts` (concurrency, release
  on throw, stale reclaim), `test/unit/command-report.test.ts` (reset), and
  `test/unit/status-tool.test.ts` (degraded usage line).
