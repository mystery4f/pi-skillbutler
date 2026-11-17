/**
 * Temp directories for the tests that read real files: one helper so every test
 * makes and removes its own tree the same way.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** A fresh directory under the system temp path. */
export async function tempDir(prefix = "skill-pro-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/** Write one file inside a directory, creating the parents, and return its path. */
export async function writeFileIn(dir: string, relative: string, content: string): Promise<string> {
  const target = join(dir, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}
