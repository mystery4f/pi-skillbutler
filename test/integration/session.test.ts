/**
 * The acceptance lines that need a whole session: real files in a temp tree, the
 * real seams fired in order, and a second extension instance standing in for the
 * restart that must not lose the usage log.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { afterEach, describe, expect, it } from "vitest";
import { readUsageEvents } from "../../src/stats/store.js";
import { STATUS_TOOL } from "../../src/tools/status.js";
import { createHarness, type Harness } from "../support/extension-harness.js";
import { fakeSkill, promptOptions, skillsOf } from "../support/prompt.js";
import { makeProject, type TestProject } from "../support/temp.js";

let project: TestProject | undefined;
const harnesses: Harness[] = [];

afterEach(() => {
  for (const harness of harnesses.splice(0)) harness.dispose();
  project?.cleanup();
  project = undefined;
});

function setup(): { project: TestProject; harness: Harness } {
  const built = makeProject();
  project = built;
  const harness = createHarness({ options: built.options });
  harnesses.push(harness);
  return { project: built, harness };
}

function turn(harness: Harness, prompt: string, names: readonly string[]): Promise<unknown[]> {
  return harness.fire("before_agent_start", {
    messageType: "user",
    prompt,
    systemPrompt: "",
    systemPromptOptions: promptOptions(names.map((name) => fakeSkill(name))),
  });
}

interface TurnResult {
  readonly message?: { readonly content?: string };
}

describe("a session over real files", () => {
  it("leaves the prompt untouched when nothing is configured", async () => {
    const { harness } = setup();
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta")]);
    const before = JSON.stringify(options);

    const results = await harness.fire("before_agent_start", {
      messageType: "user",
      prompt: "plain question, no names",
      systemPrompt: "",
      systemPromptOptions: options,
    });

    expect(results[0]).toBeUndefined();
    expect(JSON.stringify(options)).toBe(before);
  });

  it("hides a skill from the next turn while the popup still offers it", async () => {
    const { project: built, harness } = setup();
    built.skill("alpha", { description: "first" });
    built.skill("beta", { description: "second" });
    built.write("agent/skill-pro.yml", "skills:\n  alpha:\n    hidden: true\n");

    await harness.fire("session_start", {});
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta")]);
    await harness.fire("before_agent_start", {
      messageType: "user",
      prompt: "which one?",
      systemPrompt: "",
      systemPromptOptions: options,
    });

    expect(skillsOf(options).map((skill) => skill.name)).toEqual(["beta"]);
    const alpha = harness.controller.entries().find((entry) => entry.name === "alpha");
    expect(alpha?.hidden).toBe(true);
  });

  it("answers a second naming with already-named instead of the path", async () => {
    const { project: built, harness } = setup();
    const file = built.skill("alpha", { description: "first" });

    const first = (await turn(harness, "please run $alpha", ["alpha"]))[0] as
      | TurnResult
      | undefined;
    expect(first?.message?.content).toContain(file);
    expect(first?.message?.content).not.toContain("Already named");

    const second = (await turn(harness, "and $alpha again", ["alpha"]))[0] as
      | TurnResult
      | undefined;
    expect(second?.message?.content).toContain("Already named earlier this session");
    expect(second?.message?.content).not.toContain(file);
  });

  it("keeps the usage log across a restart and reports it from the tool", async () => {
    const { project: built, harness } = setup();
    built.skill("alpha", { description: "first" });
    await turn(harness, "run $alpha", ["alpha"]);
    await turn(harness, "run $alpha once more", ["alpha"]);

    const events = await readUsageEvents(built.stats);
    expect(events.map((event) => event.skill)).toEqual(["alpha", "alpha"]);
    expect(events[0]?.via).toBe("dollar");

    harness.dispose();
    harnesses.length = 0;
    const restarted = createHarness({ options: built.options });
    harnesses.push(restarted);

    const inventory = await restarted.callTool(STATUS_TOOL, {}, built.cwd);
    const inventoryText = textOf(inventory);
    expect(inventoryText).toContain("usage: 2 namings across 1 skill (alpha 2)");
    expect(inventoryText).toMatch(/last \d{4}-\d{2}-\d{2}T/);

    const one = await restarted.callTool(STATUS_TOOL, { name: "alpha" }, built.cwd);
    expect(textOf(one)).toContain("usage: 2 namings, last ");
  });

  it("survives a broken preference file and names it", async () => {
    const { project: built, harness } = setup();
    built.skill("alpha");
    const file = built.write("agent/skill-pro.yml", "skills:\n\talpha:\n    hidden: true\n");

    const view = await harness.controller.reload();

    expect(view.error).toContain(file);
    expect(view.inventory.skills.map((skill) => skill.name)).toEqual(["alpha"]);
  });
});

function textOf(result: { content: readonly { type: string; text?: string }[] }): string {
  return result.content.find((block) => block.type === "text")?.text ?? "";
}
