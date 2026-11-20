/**
 * Filesystem watch on the managed roots: a skill installed or removed while the
 * session runs must show up without a reload. Shallow by design — the roots hold
 * one directory per skill, so add/remove is a rename event at the root level;
 * editing an existing `SKILL.md` frontmatter is deliberately not watched.
 *
 * A watcher that cannot attach (missing root, exotic filesystem, Windows drive
 * edge cases) reports `accessible: false` and the extension falls back to
 * rescanning every turn.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { watch } from "node:fs";

export interface RootWatcher {
  /** True when every root has a live watcher; false means per-turn rescans. */
  readonly accessible: boolean;
  dispose(): void;
}

export interface RootWatcherOptions {
  readonly debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 200;

/**
 * Watch every root and call `onChange` (debounced) when any of them changes.
 * Never throws: each root failure is swallowed and reported through `accessible`.
 */
export function watchRoots(
  roots: readonly string[],
  onChange: () => void,
  options: RootWatcherOptions = {},
): RootWatcher {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const disposers: Array<() => void> = [];
  let watched = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      onChange();
    }, debounceMs);
  };

  for (const root of roots) {
    try {
      const watcher = watch(root, { persistent: false }, schedule);
      watcher.on("error", () => {
        // A dying watcher leaves the view stale; the per-turn fallback covers it.
      });
      disposers.push(() => watcher.close());
      watched += 1;
    } catch {
      // Not watchable now; if every root fails, `accessible` stays false.
    }
  }

  return {
    accessible: watched === roots.length,
    dispose(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      for (const dispose of disposers.splice(0)) dispose();
    },
  };
}
