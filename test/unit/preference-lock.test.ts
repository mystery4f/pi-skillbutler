/**
 * The preference lock: the file is human-owned (ADR-0003), so two sessions writing
 * at once would silently keep only the later text. The lock serialises them, never
 * outlives the work, and expires when a crashed holder never released it.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { readFile, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withPreferencesLock } from "../../src/preferences/lock.js";
import { removeDir, tempDir } from "../support/temp.js";

let dir = "";

beforeAll(async () => {
  dir = await tempDir("skillbutler-lock-");
});

afterAll(async () => {
  await removeDir(dir);
});

describe("withPreferencesLock", () => {
  it("keeps both of two concurrent read-modify-writes", async () => {
    const file = join(dir, "concurrent.yml");
    await writeFile(file, "", "utf8");
    const append = (line: string): Promise<void> =>
      withPreferencesLock(file, async () => {
        const before = await readFile(file, "utf8");
        await writeFile(file, `${before}${line}\n`, "utf8");
      });

    await Promise.all([append("alpha"), append("beta")]);

    const text = await readFile(file, "utf8");
    expect(text).toContain("alpha");
    expect(text).toContain("beta");
  });

  it("removes the lock once the work is done", async () => {
    const file = join(dir, "clean.yml");
    await withPreferencesLock(file, async () => {
      await writeFile(file, "skills: {}\n", "utf8");
    });
    await expect(stat(`${file}.lock`)).rejects.toThrow(/ENOENT/u);
  });

  it("releases the lock when the work throws", async () => {
    const file = join(dir, "throwing.yml");
    await expect(
      withPreferencesLock(file, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(stat(`${file}.lock`)).rejects.toThrow(/ENOENT/u);
  });

  it("reclaims a lock a crashed writer left behind", async () => {
    const file = join(dir, "stale.yml");
    const lock = `${file}.lock`;
    await writeFile(lock, "", "utf8");
    const longAgo = Date.now() / 1000 - 60;
    await utimes(lock, longAgo, longAgo);

    await expect(withPreferencesLock(file, async () => "ran")).resolves.toBe("ran");
  });
});
