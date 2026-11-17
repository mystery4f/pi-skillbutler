/**
 * Vitest config. Two projects so the cost of a change is visible: `test/unit/`
 * holds tests of pure logic over temp files and fakes, `test/integration/` holds
 * the tests that drive the real seams. `npm test` runs both; `npm run test:unit`
 * is the inner loop for a change that cannot reach a process.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

/** Settings both projects share, so neither can drift from the other. */
const shared = {
  exclude: ["node_modules/**", "dist/**", ".tmp/**", ".pi/**"],
  passWithNoTests: true,
  // A test here reads real skill directories and, in integration, spawns a real
  // pi; the default 5s leaves no room for a cold filesystem.
  testTimeout: 30000,
  hookTimeout: 30000,
  // Most of this suite waits on the filesystem, so a worker per core thrashes
  // instead of overlapping. Eight is the cap; `--maxWorkers` still wins.
  maxWorkers: Math.min(8, availableParallelism()),
} as const;

export default defineConfig({
  test: {
    projects: [
      { test: { ...shared, name: "unit", include: ["test/unit/**/*.test.ts"] } },
      { test: { ...shared, name: "integration", include: ["test/integration/**/*.test.ts"] } },
    ],
  },
});
