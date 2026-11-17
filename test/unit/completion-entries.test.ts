/**
 * What the popup offers and in what order (ADR-0001, ADR-0004): a visible managed
 * skill outranks a hidden one, which outranks a skill from outside the roots; the
 * markers say why a skill is the way it is without a second command.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import {
  buildCompletionEntries,
  entryMarkers,
  matchesQuery,
  rankByQuery,
} from "../../src/completion/entries.js";
import type { PreferenceMap } from "../../src/preferences/preferences.js";
import type { Inventory, SkillRecord } from "../../src/skills/inventory.js";

function record(name: string, shadowed?: string): SkillRecord {
  return {
    name,
    description: `${name} description`,
    directory: name,
    skillFile: `/roots/a/${name}/SKILL.md`,
    root: "/roots/a",
    ...(shadowed === undefined ? {} : { shadowedSkillFile: shadowed }),
  };
}

function inventory(skills: readonly SkillRecord[]): Inventory {
  return { roots: [{ root: "/roots/a", present: true, count: skills.length }], skills };
}

function preferences(
  entries: Record<string, { hidden?: boolean; weight?: number }>,
): PreferenceMap {
  return new Map(
    Object.entries(entries).map(([name, entry]) => [
      name,
      { ...entry, sources: {} } as PreferenceMap extends Map<string, infer T> ? T : never,
    ]),
  );
}

describe("buildCompletionEntries", () => {
  it("orders visible by weight, then hidden, then unmanaged", () => {
    const entries = buildCompletionEntries(
      inventory([record("alpha"), record("beta"), record("gamma", "/roots/b/gamma/SKILL.md")]),
      preferences({ alpha: { hidden: true }, beta: { weight: 2 } }),
      [{ name: "outside", file: "/other/outside/SKILL.md" }],
    );
    expect(entries.map((entry) => entry.name)).toEqual(["beta", "gamma", "alpha", "outside"]);
  });

  it("keeps a skill that appears both inside and outside the roots once", () => {
    const entries = buildCompletionEntries(inventory([record("alpha")]), preferences({}), [
      { name: "alpha", file: "/other/alpha/SKILL.md" },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.managed).toBe(true);
  });

  it("marks hidden, unmanaged, duplicate and weighted skills", () => {
    const entries = buildCompletionEntries(
      inventory([record("alpha", "/roots/b/alpha/SKILL.md")]),
      preferences({ alpha: { hidden: true, weight: 3 } }),
      [{ name: "outside", file: "/other/outside/SKILL.md" }],
    );
    expect(entryMarkers(entries[0] as never)).toEqual(["[hidden]", "[duplicate]", "[weight 3]"]);
    expect(entryMarkers(entries[1] as never)).toEqual(["[unmanaged]"]);
  });
});

describe("matchesQuery and rankByQuery", () => {
  it("finds a name by its initials", () => {
    expect(matchesQuery("grill-with-docs", "gw")).toBe(true);
    expect(matchesQuery("grill-with-docs", "gwd")).toBe(true);
    expect(matchesQuery("grill-with-docs", "grill")).toBe(true);
    expect(matchesQuery("grill-with-docs", "gdz")).toBe(false);
    expect(matchesQuery("grill-with-docs", "zz")).toBe(false);
  });

  it("puts prefix matches first and keeps the rest in order", () => {
    const entries = buildCompletionEntries(
      inventory([record("retro"), record("grill-retro")]),
      preferences({}),
      [],
    );
    expect(rankByQuery(entries, "retro").map((entry) => entry.name)).toEqual([
      "retro",
      "grill-retro",
    ]);
  });
});
