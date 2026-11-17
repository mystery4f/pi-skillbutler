/**
 * Frontmatter is read for two fields only; everything else in the file is pi's
 * business. These tests pin the folded form pi's own skills use.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { readFrontmatter } from "../../src/skills/frontmatter.js";

describe("readFrontmatter", () => {
  it("reads a plain name and description", () => {
    const source = [
      "---",
      "name: retro",
      "description: Fix mistakes before they ship.",
      "---",
      "",
      "# Retro",
    ].join("\n");
    expect(readFrontmatter(source)).toEqual({
      name: "retro",
      description: "Fix mistakes before they ship.",
    });
  });

  it("folds a multi-line description", () => {
    const source = [
      "---",
      "name: grill",
      "description: >",
      "  A relentless interview",
      "  to sharpen a plan.",
      "---",
    ].join("\n");
    expect(readFrontmatter(source).description).toBe("A relentless interview to sharpen a plan.");
  });

  it("keeps a quoted description whole", () => {
    const source = ["---", 'description: "one: two"', "---"].join("\n");
    expect(readFrontmatter(source).description).toBe("one: two");
  });

  it("returns nothing for a file without frontmatter", () => {
    expect(readFrontmatter("# Just a heading\n")).toEqual({
      name: undefined,
      description: undefined,
    });
  });
});
