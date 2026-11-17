/**
 * The `$` popup (ADR-0001, ADR-0006): it stacks on pi's provider instead of
 * replacing it, the label keeps pi's own `$name [skill]` shape, and the
 * description is the human translation when the i18n file has one.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { AutocompleteItem, AutocompleteProvider } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import type { CompletionEntry } from "../../src/completion/entries.js";
import { createDollarProvider, extractDollarPrefix } from "../../src/completion/provider.js";

/** pi always passes the editor's abort signal; nothing here aborts. */
const SIGNAL = new AbortController().signal;

function entry(name: string, extra: Partial<CompletionEntry> = {}): CompletionEntry {
  return {
    name,
    description: `${name} description`,
    hidden: false,
    weight: 0,
    managed: true,
    duplicate: false,
    file: `/skills/${name}/SKILL.md`,
    ...extra,
  };
}

/** pi's own provider: handles `@`, and replaces the token before the cursor. */
const CURRENT: AutocompleteProvider = {
  triggerCharacters: ["@"],
  async getSuggestions() {
    return { items: [{ value: "@src", label: "@src" }], prefix: "@src" };
  },
  applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
    const line = lines[cursorLine] ?? "";
    const start = Math.max(0, cursorCol - prefix.length);
    const next = [...lines];
    next[cursorLine] = `${line.slice(0, start)}${item.value}${line.slice(cursorCol)}`;
    return { lines: next, cursorLine, cursorCol: start + item.value.length };
  },
  shouldTriggerFileCompletion() {
    return true;
  },
};

function provider(entries: readonly CompletionEntry[], translations: Record<string, string> = {}) {
  return createDollarProvider(CURRENT, {
    entries: () => entries,
    translate: (name) => translations[name],
    reloadTranslations: async () => undefined,
  });
}

describe("extractDollarPrefix", () => {
  it("takes the token that ends at the cursor", () => {
    expect(extractDollarPrefix("ask $gr")).toBe("$gr");
    expect(extractDollarPrefix("ask $")).toBe("$");
    expect(extractDollarPrefix("ask $gr now")).toBeUndefined();
    expect(extractDollarPrefix("no dollar")).toBeUndefined();
  });
});

describe("createDollarProvider", () => {
  it("adds $ to the characters pi already watches", () => {
    expect(provider([]).triggerCharacters).toEqual(["@", "$"]);
  });

  it("offers a matching skill with pi's label shape", async () => {
    const suggestions = await provider([entry("grill-with-docs", { weight: 3 })]).getSuggestions(
      ["run $gr"],
      0,
      7,
      { signal: SIGNAL },
    );
    expect(suggestions).toEqual({
      items: [
        {
          value: "$grill-with-docs",
          label: "$grill-with-docs [skill]",
          description: "[weight 3] grill-with-docs description",
        },
      ],
      prefix: "$gr",
    });
  });

  it("shows the translation and falls back to the description", async () => {
    const suggestions = await provider([entry("grill"), entry("retro")], {
      grill: "拷问",
    }).getSuggestions(["$"], 0, 1, { signal: SIGNAL });
    expect(suggestions?.items.map((item: AutocompleteItem) => item.description)).toEqual([
      "拷问",
      "retro description",
    ]);
  });

  it("hands anything that is not a $ token back to pi", async () => {
    const suggestions = await provider([entry("grill")]).getSuggestions(["@sr"], 0, 3, {
      signal: SIGNAL,
    });
    expect(suggestions).toEqual({ items: [{ value: "@src", label: "@src" }], prefix: "@src" });
  });

  it("replaces the token in place and leaves the cursor after the name", () => {
    const result = provider([]).applyCompletion(
      ["run $gr"],
      0,
      7,
      { value: "$grill-with-docs", label: "$grill-with-docs [skill]" },
      "$gr",
    );
    expect(result.lines).toEqual(["run $grill-with-docs"]);
    expect(result.cursorCol).toBe("run $grill-with-docs".length);
  });

  it("eats the rest of the token when the cursor sits inside it", () => {
    const result = provider([]).applyCompletion(
      ["run $grill-with-docs and more"],
      0,
      7,
      { value: "$grill-with-docs", label: "$grill-with-docs [skill]" },
      "$gr",
    );
    expect(result.lines).toEqual(["run $grill-with-docs and more"]);
    expect(result.cursorCol).toBe("run $grill-with-docs".length);
  });

  it("leaves a non-$ completion to pi", () => {
    const result = provider([]).applyCompletion(
      ["@sr"],
      0,
      3,
      { value: "@src", label: "@src" },
      "@sr",
    );
    expect(result.lines).toEqual(["@src"]);
  });

  it("delegates the file-completion question to pi", () => {
    expect(provider([]).shouldTriggerFileCompletion?.(["x"], 0, 1)).toBe(true);
  });
});
