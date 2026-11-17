/**
 * The match surface (ADR-0007): which `$name` tokens in a prompt count. A fence is
 * prose the user is showing, not asking for, so it is masked; inline code is still
 * the user's sentence, so it counts; and one name means one turn addition.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { maskFencedCode, scanInvocations } from "../../src/invocation/matcher.js";

const knows = (name: string): boolean => name === "grill-with-docs" || name === "retro";

describe("scanInvocations", () => {
  it("finds the names the session can answer for, in prompt order", () => {
    expect(scanInvocations("先 $retro，后 $grill-with-docs", knows)).toEqual({
      known: ["retro", "grill-with-docs"],
      unknown: [],
    });
  });

  it("counts an inline code mention and leaves a fenced block alone", () => {
    const prompt = "run `$retro` now\n```sh\necho $retro\n$grill-with-docs\n```\n";
    expect(scanInvocations(prompt, knows)).toEqual({ known: ["retro"], unknown: [] });
  });

  it("leaves an escaped $ to the user", () => {
    expect(scanInvocations("costs \\$retro and $retro", knows)).toEqual({
      known: ["retro"],
      unknown: [],
    });
  });

  it("reports a repeated name once", () => {
    expect(scanInvocations("$retro then $retro", knows).known).toEqual(["retro"]);
  });

  it("collects the names nothing answers to", () => {
    expect(scanInvocations("$nope and $retro", knows)).toEqual({
      known: ["retro"],
      unknown: ["nope"],
    });
  });
});

describe("maskFencedCode", () => {
  it("keeps every line and column where it was", () => {
    const text = "a $retro\n```\n$retro\n```\n$retro";
    const masked = maskFencedCode(text);
    expect(masked).toHaveLength(text.length);
    expect(masked.split("\n")).toHaveLength(text.split("\n").length);
    expect(masked.split("\n")[2]?.trim()).toBe("");
    expect(masked.endsWith("$retro")).toBe(true);
  });

  it("closes a fence only with its own marker", () => {
    const text = "```\n~~~\n$retro\n```\n$retro";
    expect(maskFencedCode(text).split("\n")[4]).toBe("$retro");
  });
});
