/**
 * The scan over the two fixed roots: what counts as a skill, what a missing root
 * looks like, and what happens when both roots hold the same name.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */

import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanSkills } from "../../src/skills/inventory.js";
import { removeDir, tempDir, writeFileIn } from "../support/temp.js";

let shared = "";
let mine = "";
let dirs: string[] = [];

beforeAll(async () => {
  shared = await tempDir("skill-pro-shared-");
  mine = await tempDir("skill-pro-mine-");
  dirs = [shared, mine];
  await writeFileIn(
    shared,
    "skill-a/SKILL.md",
    ["---", "name: alpha", "description: >", "  First line", "  second line.", "---"].join("\n"),
  );
  await writeFileIn(shared, "skill-b/SKILL.md", "# no frontmatter here\n");
  await writeFileIn(shared, "notes/README.md", "not a skill\n");
  await writeFileIn(mine, "alpha/SKILL.md", "---\nname: alpha\n---\n");
  await writeFileIn(mine, "gamma/SKILL.md", "---\nname: gamma\n---\n");
});

afterAll(async () => {
  for (const dir of dirs) await removeDir(dir);
});

describe("scanSkills", () => {
  it("takes the frontmatter name and falls back to the directory name", async () => {
    const inventory = await scanSkills([shared]);
    expect(inventory.skills.map((skill) => skill.name)).toEqual(["alpha", "skill-b"]);
    expect(inventory.skills[0]?.description).toBe("First line second line.");
  });

  it("ignores a directory without a SKILL.md", async () => {
    const inventory = await scanSkills([shared]);
    expect(inventory.skills.some((skill) => skill.directory === "notes")).toBe(false);
    expect(inventory.roots[0]).toEqual({ root: shared, present: true, count: 2 });
  });

  it("reports a missing root instead of failing", async () => {
    const inventory = await scanSkills([shared, `${shared}-absent`]);
    expect(inventory.roots[1]).toEqual({ root: `${shared}-absent`, present: false, count: 0 });
  });

  it("keeps the first root's copy and points at the shadowed one", async () => {
    const inventory = await scanSkills([shared, mine]);
    const alpha = inventory.skills.find((skill) => skill.name === "alpha");
    expect(alpha?.root).toBe(shared);
    expect(alpha?.shadowedSkillFile?.endsWith(join("alpha", "SKILL.md"))).toBe(true);
    expect(inventory.skills.some((skill) => skill.name === "gamma")).toBe(true);
    expect(inventory.skills).toHaveLength(3);
  });
});
