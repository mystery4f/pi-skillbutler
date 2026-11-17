/**
 * What the entry promises before any preference logic exists: it registers the
 * session seams, it writes the footer chip on session start, and `dispose` really
 * unregisters what it registered.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { SKILL_PRO_KEY } from "../../src/index.js";
import { createHarness } from "../support/extension-harness.js";

describe("extension entry", () => {
  it("registers session_start and session_shutdown", () => {
    const harness = createHarness();
    expect(harness.handlers.get("session_start")).toHaveLength(1);
    expect(harness.handlers.get("session_shutdown")).toHaveLength(1);
    harness.dispose();
  });

  it("writes the footer chip on session start", async () => {
    const harness = createHarness();
    await harness.fire("session_start");
    expect(harness.statuses).toEqual([{ key: SKILL_PRO_KEY, text: SKILL_PRO_KEY }]);
    harness.dispose();
  });

  it("unregisters every handler on dispose", () => {
    const harness = createHarness();
    harness.dispose();
    expect(harness.handlers.get("session_start")).toHaveLength(0);
    expect(harness.handlers.get("session_shutdown")).toHaveLength(0);
  });
});
