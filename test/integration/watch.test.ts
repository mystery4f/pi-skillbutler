/**
 * A skill that appears or disappears while the session runs: the managed roots are
 * watched, so `$name` and the `$` popup see it without a reload.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INVOCATION_CUSTOM_TYPE } from "../../src/invocation/inject.js";
import { createHarness } from "../support/extension-harness.js";
import { fakeSkill, promptOptions } from "../support/prompt.js";
import { makeProject } from "../support/temp.js";

interface TurnResult {
  readonly message?: { readonly customType: string; readonly content: string };
}

/** Short debounce so a test sees the refresh in a few milliseconds. */
function watcher(project: ReturnType<typeof makeProject>) {
  return createHarness({ options: { ...project.options, watchDebounceMs: 5 } });
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("the roots were not rescanned in time");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function turn(harness: ReturnType<typeof createHarness>, prompt: string, options: unknown) {
  return harness.fire("before_agent_start", {
    messageType: "user",
    prompt,
    systemPrompt: "",
    systemPromptOptions: options,
  });
}

describe("the managed roots are watched", () => {
  it("offers a skill installed mid-session, in the view and in the popup", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = watcher(project);
    await harness.fire("session_start");
    expect(harness.controller.entries().map((entry) => entry.name)).toEqual(["alpha"]);

    project.skill("gamma");

    await waitFor(() => harness.controller.entries().some((entry) => entry.name === "gamma"));
    expect(harness.controller.view()?.inventory.skills.map((skill) => skill.name)).toEqual([
      "alpha",
      "gamma",
    ]);
    harness.dispose();
    project.cleanup();
  });

  it("points $name at a skill installed mid-session, with no reload", async () => {
    const project = makeProject();
    const harness = watcher(project);
    await harness.fire("session_start");

    project.skill("gamma");
    await waitFor(() => harness.controller.view()?.inventory.skills.length === 1);

    const results = await turn(harness, "run $gamma", promptOptions([fakeSkill("gamma")]));
    const message = (results[0] as TurnResult).message;
    expect(message?.customType).toBe(INVOCATION_CUSTOM_TYPE);
    expect(message?.content).toContain(`- $gamma → ${join(project.userRoot, "gamma", "SKILL.md")}`);
    harness.dispose();
    project.cleanup();
  });

  it("drops a skill removed mid-session from the view and the popup", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.skill("gamma");
    const harness = watcher(project);
    await harness.fire("session_start");
    expect(harness.controller.entries().map((entry) => entry.name)).toEqual(["alpha", "gamma"]);

    await rm(join(project.userRoot, "gamma"), { recursive: true, force: true });

    await waitFor(() => !harness.controller.entries().some((entry) => entry.name === "gamma"));
    expect(harness.controller.view()?.inventory.skills.map((skill) => skill.name)).toEqual([
      "alpha",
    ]);
    harness.dispose();
    project.cleanup();
  });

  it("stops watching after dispose", async () => {
    const project = makeProject();
    const harness = watcher(project);
    await harness.fire("session_start");
    harness.dispose();

    project.skill("gamma");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(harness.controller.view()?.inventory.skills).toEqual([]);
    project.cleanup();
  });
});
