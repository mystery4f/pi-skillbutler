/**
 * The root watcher on its own: the fallback flag and the debounce are seam
 * behaviour the integration tests cannot reach without a broken filesystem.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { watchRoots } from "../../src/skills/watcher.js";

const created: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "skillbutler-watch-"));
  created.push(root);
  return root;
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("the watcher never fired");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("watchRoots", () => {
  it("reports itself unusable when a root does not exist", () => {
    const watcher = watchRoots([join(tempRoot(), "gone")], () => {});
    expect(watcher.accessible).toBe(false);
    watcher.dispose();
  });

  it("reports itself usable when every root exists", () => {
    const watcher = watchRoots([tempRoot(), tempRoot()], () => {});
    expect(watcher.accessible).toBe(true);
    watcher.dispose();
  });

  it("fires once per burst and goes quiet after dispose", async () => {
    const root = tempRoot();
    let calls = 0;
    const watcher = watchRoots(
      [root],
      () => {
        calls += 1;
      },
      { debounceMs: 5 },
    );

    mkdirSync(join(root, "alpha"));
    mkdirSync(join(root, "beta"));
    await waitFor(() => calls > 0);
    const burst = calls;

    watcher.dispose();
    mkdirSync(join(root, "gamma"));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(calls).toBe(burst);
    expect(burst).toBe(1);
  });
});
