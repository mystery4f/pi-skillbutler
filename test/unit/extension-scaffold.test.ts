/**
 * What the entry promises before any preference logic exists: it registers the
 * session seams, it writes no footer chip on session start, and `dispose` really
 * unregisters what it registered.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { createHarness } from "../support/extension-harness.js";
import { makeProject } from "../support/temp.js";

describe("extension entry", () => {
  it("registers session_start and session_shutdown", () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    expect(harness.handlers.get("session_start")).toHaveLength(1);
    expect(harness.handlers.get("session_shutdown")).toHaveLength(1);
    harness.dispose();
    project.cleanup();
  });

  it("writes no footer chip on session start", async () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    expect(harness.statuses).toEqual([]);
    harness.dispose();
    project.cleanup();
  });

  it("installs one command under both names", () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    expect([...harness.commands.keys()].sort()).toEqual(["skill-pro", "skillbutler"]);
    harness.dispose();
    project.cleanup();
  });

  it("unregisters every handler on dispose", () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    harness.dispose();
    expect(harness.handlers.get("session_start")).toHaveLength(0);
    expect(harness.handlers.get("session_shutdown")).toHaveLength(0);
    project.cleanup();
  });
});
