/**
 * `skillbutler_status` through the harness: the inventory answer, the per-skill
 * answer with its provenance, and the miss that lists the names that do exist.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USAGE_STATS_FILE } from "../../src/paths.js";
import { STATUS_TOOL } from "../../src/tools/status.js";
import { createHarness, type Harness } from "../support/extension-harness.js";
import { removeDir, tempDir, writeFileIn } from "../support/temp.js";

let root = "";
let agent = "";
let project = "";
let dirs: string[] = [];
let harness: Harness;

beforeAll(async () => {
  root = await tempDir("skillbutler-root-");
  agent = await tempDir("skillbutler-agent-");
  project = await tempDir("skillbutler-project-");
  dirs = [root, agent, project];
  await writeFileIn(root, "alpha/SKILL.md", "---\nname: alpha\ndescription: First skill.\n---\n");
  await writeFileIn(root, "beta/SKILL.md", "---\nname: beta\n---\n");
  await writeFileIn(
    agent,
    "skillbutler.yml",
    "skills:\n  alpha:\n    hidden: true\n    style: terse\n",
  );
  await writeFileIn(project, ".pi/skillbutler.yml", "skills:\n  beta:\n    weight: 5\n");
  harness = createHarness({
    options: { roots: [root], env: { PI_CODING_AGENT_DIR: agent } },
  });
});

afterAll(async () => {
  harness.dispose();
  for (const dir of dirs) await removeDir(dir);
});

describe("skillbutler_status", () => {
  it("registers the tool with its paths in the description", () => {
    const tool = harness.tools.get(STATUS_TOOL);
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("read when the extension loads");
    expect(tool?.description).toContain("skillbutler.yml");
  });

  it("lists the inventory with the two settings files and the hidden flag", async () => {
    const result = await harness.callTool(STATUS_TOOL, {}, project);
    const text = firstText(result);
    expect(text).toContain("inventory: 2 skills, 1 visible, 1 hidden");
    expect(text).toMatch(/alpha {2}\[hidden\] {2}weight 0/);
    expect(text).toMatch(/beta {2}weight 5/);
    expect(text).toContain("present");
  });

  it("explains one skill and which file each setting came from", async () => {
    const result = await harness.callTool(STATUS_TOOL, { name: "alpha" }, project);
    const text = firstText(result);
    expect(text).toContain("hidden: true");
    expect(text).toContain("style: terse");
    expect(text).toContain("skillbutler.yml");
  });

  it("lists the known names when the name is unknown", async () => {
    const result = await harness.callTool(STATUS_TOOL, { name: "nope" }, project);
    const text = firstText(result);
    expect(text).toContain('No managed skill is named "nope"');
    expect(text).toContain("alpha, beta");
  });
});

function firstText(result: { content: readonly { type: string; text?: string }[] }): string {
  const block = result.content.find((candidate) => candidate.type === "text");
  return block?.text ?? "";
}

describe("skillbutler_status when the usage log cannot be read", () => {
  it("still answers the inventory and reports the log as unavailable", async () => {
    const brokenRoot = await tempDir("skillbutler-root-broken-");
    const brokenAgent = await tempDir("skillbutler-agent-broken-");
    await writeFileIn(brokenRoot, "gamma/SKILL.md", "---\nname: gamma\n---\n");
    await mkdir(join(brokenAgent, USAGE_STATS_FILE), { recursive: true });
    const broken = createHarness({
      options: { roots: [brokenRoot], env: { PI_CODING_AGENT_DIR: brokenAgent } },
    });

    const result = await broken.callTool(STATUS_TOOL, {}, brokenRoot);
    const text = firstText(result);

    expect(text).toContain("1 skills");
    expect(text).toMatch(/usage: unavailable \(/u);
    expect((result.details as { usageError?: string }).usageError?.length).toBeGreaterThan(0);
    broken.dispose();
    await removeDir(brokenRoot);
    await removeDir(brokenAgent);
  });
});
