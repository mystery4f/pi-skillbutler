/**
 * The human surface through the real seam (ADR-0003, ADR-0009): `list` reports what
 * the next turn will look like, `set` writes the user file and reloads, and a bad
 * argument is refused with the reason instead of a stack trace.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createHarness } from "../support/extension-harness.js";
import { makeProject } from "../support/temp.js";

describe("/skillbutler through the registered command", () => {
  it("lists the managed skills and where the settings live", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.skill("beta");
    project.write("agent/skillbutler.yml", "skills:\n  alpha:\n    hidden: true\n    weight: 2\n");
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "list");
    const report = harness.messages[0]?.content ?? "";
    expect(report).toContain("2 managed skills, 1 visible, 1 hidden");
    expect(report).toMatch(/present\s+2 skills/);
    expect(report).toContain("alpha");
    expect(report).toContain("[hidden]");
    harness.dispose();
    project.cleanup();
  });

  it("sets a value in the user file and reloads the view", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "set alpha weight 4");
    expect(harness.notifications.at(-1)?.message).toContain("alpha.weight = 4");
    expect(await readFile(project.userPreferences, "utf8")).toContain("weight: 4");
    expect(harness.controller.view()?.preferences.preferences.get("alpha")?.weight).toBe(4);
    harness.dispose();
    project.cleanup();
  });

  it("unsets a value and drops the entry with it", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.write("agent/skillbutler.yml", "skills:\n  alpha:\n    weight: 4\n");
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "unset alpha weight");
    expect(await readFile(project.userPreferences, "utf8")).toContain("skills: {}");
    expect(harness.controller.view()?.preferences.preferences.has("alpha")).toBe(false);
    harness.dispose();
    project.cleanup();
  });

  it("explains why a skill is hidden, naming the file that hid it", async () => {
    const project = makeProject();
    project.skill("alpha");
    project.write(
      "project/.pi/skillbutler.yml",
      "skills:\n  alpha:\n    hidden: true\n    style: terse\n",
    );
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "why alpha");
    const report = harness.messages[0]?.content ?? "";
    expect(report).toContain("is hidden");
    expect(report).toContain("skillbutler.yml");
    harness.dispose();
    project.cleanup();
  });

  it("refuses a value that does not fit the key, naming the key", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "set alpha weight heavy");
    expect(harness.notifications.at(-1)).toMatchObject({ level: "error" });
    expect(harness.notifications.at(-1)?.message).toContain(
      '"weight" must be a number, got "heavy"',
    );
    harness.dispose();
    project.cleanup();
  });

  it("names the subcommands it knows when given another one", async () => {
    const project = makeProject();
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "delete alpha");
    expect(harness.notifications.at(-1)).toMatchObject({ level: "error" });
    expect(harness.notifications.at(-1)?.message).toContain("try list, show, set, unset, why");
    harness.dispose();
    project.cleanup();
  });

  it("completes subcommands, skill names and setting keys", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "list");
    const command = harness.commands.get("skillbutler");
    const complete = async (prefix: string): Promise<string[]> =>
      (await command?.getArgumentCompletions?.(prefix))?.map((item) => item.value) ?? [];
    expect(await complete("sh")).toEqual(["show"]);
    expect(await complete("set al")).toEqual(["alpha"]);
    expect(await complete("set alpha ")).toEqual(["hidden", "weight", "language", "style"]);
    harness.dispose();
    project.cleanup();
  });
});

describe("/skillbutler reset", () => {
  it("clears the usage log and says how many namings it dropped", async () => {
    const project = makeProject();
    project.skill("alpha");
    await writeFile(
      project.stats,
      [
        '{"skill":"alpha","at":"2026-11-17T01:00:00.000Z","via":"dollar"}',
        '{"skill":"alpha","at":"2026-11-17T02:00:00.000Z","via":"dollar"}',
        "",
      ].join("\n"),
      "utf8",
    );
    const harness = createHarness({ options: project.options });
    await harness.runCommand("skillbutler", "reset");
    expect(harness.notifications.at(-1)?.message).toContain("cleared 2 namings");
    expect(await readFile(project.stats, "utf8")).toBe("");
    harness.dispose();
    project.cleanup();
  });

  it("offers no argument completion after reset", async () => {
    const project = makeProject();
    project.skill("alpha");
    const harness = createHarness({ options: project.options });
    const command = harness.commands.get("skillbutler");
    expect(await command?.getArgumentCompletions?.("reset ")).toEqual([]);
    harness.dispose();
    project.cleanup();
  });
});
