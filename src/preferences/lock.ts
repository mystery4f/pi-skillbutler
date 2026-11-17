/**
 * A lock around one preference file. The file is human-owned (ADR-0003), so a
 * lost write is silent: two sessions that read-modify-write at once keep only
 * the later text. `open(..., "wx")` is atomic on every platform, and a lock a
 * crashed process left behind is reclaimed by age instead of blocking forever.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { type FileHandle, mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

/** Age at which a lock is treated as abandoned by its holder. */
const STALE_LOCK_MS = 10_000;
/** How long a competing writer keeps trying before giving up. */
const LOCK_TIMEOUT_MS = 2_000;
/** Gap between attempts. */
const RETRY_MS = 25;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function reclaimIfStale(lock: string): Promise<void> {
  try {
    const info = await stat(lock);
    if (Date.now() - info.mtimeMs > STALE_LOCK_MS) await rm(lock, { force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function acquire(lock: string): Promise<FileHandle> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      return await open(lock, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await reclaimIfStale(lock);
      if (Date.now() > deadline) {
        throw new Error(
          `another session is writing ${lock.replace(/\.lock$/u, "")}; try again in a moment`,
        );
      }
      await sleep(RETRY_MS);
    }
  }
}

/** Run `work` while holding `<file>.lock`, so a concurrent writer waits its turn. */
export async function withPreferencesLock<T>(file: string, work: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  await mkdir(dirname(lock), { recursive: true });
  const handle = await acquire(lock);
  try {
    return await work();
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}
