/**
 * The turn seam end to end (ADR-0002, ADR-0005, ADR-0007, ADR-0008): what one user
 * message does to the prompt, the transcript and the usage log, driven through the
 * registered handlers instead of the units.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATUS_KEY } from "../../src/index.js";
import { INVOCATION_CUSTOM_TYPE } from "../../src/invocation/inject.js";
import { OVERVIEW_SECTION } from "../../src/preferences/overlay.js";
import { createHarness } from "../support/extension-harness.js";
import { fakeSkill, promptOptions, skillsOf } from "../support/prompt.js";
import { makeProject } from "../support/temp.js";

interface TurnResult {
  readonly message?: {
    readonly customType: string;
    readonly content: string;
    readonly display?: boolean;
  };
}

function turn(harness: ReturnType<typeof createHarness>, prompt: string, options: unknown) {
  return harness.fire("before_agent_start", {
    messageType: "user",
    prompt,
    systemPrompt: "",
    systemPromptOptions: options,
  });
}

describe("before_agent_start", () => {
  it("drops a hidden skill, orders the rest, and answers the name in the prompt", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.skill("beta");
    project.write("agent/skill-pro.yml", "skills:\n  alpha:\n    hidden: true\n    weight: 7\n");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta")]);
    const results = await turn(harness, "use $beta now", options);

    expect(skillsOf(options).map((skill) => skill.name)).toEqual(["beta"]);
    expect(options.sections[OVERVIEW_SECTION]).toContain("named this turn: beta");

    const message = (results[0] as TurnResult).message;
    expect(message?.customType).toBe(INVOCATION_CUSTOM_TYPE);
    expect(message?.content).toContain(`- $beta → ${join(project.userRoot, "beta", "SKILL.md")}`);
    expect(message?.display).toBe(false);

    const stats = await readFile(project.stats, "utf8");
    expect(stats).toContain('"skill":"beta"');
    expect(stats).toContain('"via":"dollar"');
    harness.dispose();
    project.cleanup();
  });

  it("adds no message and no usage event when the prompt names nothing", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    const results = await turn(harness, "hello there", promptOptions([fakeSkill("alpha")]));
    expect((results[0] as TurnResult | undefined)?.message).toBeUndefined();
    await expect(readFile(project.stats, "utf8")).rejects.toThrow();
    harness.dispose();
    project.cleanup();
  });

  it("leaves the turn untouched when no preference file exists", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    const options = promptOptions([fakeSkill("alpha")]);
    const before = options.skills;
    await turn(harness, "hello", options);
    expect(options.skills).toBe(before);
    expect(options.sections[OVERVIEW_SECTION]).toBeUndefined();
    expect(harness.statuses.at(-1)).toEqual({ key: STATUS_KEY, text: STATUS_KEY });
    harness.dispose();
    project.cleanup();
  });

  it("tells the model when a named skill answers to nothing", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    const results = await turn(harness, "$missing", promptOptions([fakeSkill("alpha")]));
    expect((results[0] as TurnResult).message?.content).toContain(
      "Nothing is installed under $missing.",
    );
    harness.dispose();
    project.cleanup();
  });

  it("reaches a skill pi loaded from outside the managed roots", async () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    const options = promptOptions([fakeSkill("outside")]);
    const results = await turn(harness, "run $outside", options);
    expect((results[0] as TurnResult).message?.content).toContain(
      "- $outside → /skills/outside/SKILL.md",
    );
    harness.dispose();
    project.cleanup();
  });

  it("keeps the session when a preference file does not parse", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.write("agent/skill-pro.yml", "skills:\n\talpha: broken\n");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    expect(harness.statuses.at(-1)).toEqual({ key: STATUS_KEY, text: `${STATUS_KEY} !` });
    expect(harness.controller.view()?.error).toContain("skill-pro.yml");
    expect(harness.controller.view()?.inventory.skills).toHaveLength(1);
    harness.dispose();
    project.cleanup();
  });
});

describe("session seams", () => {
  it("clears the footer chip when the session ends", async () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    await harness.fire("session_shutdown");
    expect(harness.statuses.at(-1)).toEqual({ key: STATUS_KEY, text: undefined });
    expect(harness.controller.view()).toBeUndefined();
    harness.dispose();
    project.cleanup();
  });

  it("counts the visible skills in the chip once something is configured", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.skill("beta");
    project.write("agent/skill-pro.yml", "skills:\n  alpha:\n    hidden: true\n");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    expect(harness.statuses.at(-1)).toEqual({ key: STATUS_KEY, text: `${STATUS_KEY} 1/2` });
    harness.dispose();
    project.cleanup();
  });

  it("installs one completion provider that answers for $", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.fire("session_start");
    expect(harness.providers).toHaveLength(1);
    expect(harness.providers[0]?.triggerCharacters).toEqual(["$"]);
    const suggestions = await harness.providers[0]?.getSuggestions(["$al"], 0, 3, {
      signal: new AbortController().signal,
    });
    expect(suggestions?.items[0]?.value).toBe("$alpha");
    harness.dispose();
    project.cleanup();
  });
});
