/**
 * The `$` popup. pi's own completion provider answers `/` commands and `@` paths
 * and nothing else, so this wrapper stacks on top of it: a `$` token is ours, and
 * anything else is handed straight back.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { type CompletionEntry, entryMarkers, rankByQuery } from "./entries.js";

/** The token the popup answers: `$` plus every non-space, non-`$` character before the cursor. */
const DOLLAR_PREFIX = /(\$[^\s$]*)$/u;
/** Most items the popup shows at once; the rest are noise on a small terminal. */
const ITEM_LIMIT = 200;

/** The `$…` token that ends at the cursor, or undefined when the cursor is elsewhere. */
export function extractDollarPrefix(textBeforeCursor: string): string | undefined {
  return DOLLAR_PREFIX.exec(textBeforeCursor)?.[1];
}

export interface CompletionDeps {
  /** The current entries, read fresh for every keystroke. */
  readonly entries: () => readonly CompletionEntry[];
  /** The human-facing description, when a translation exists (ADR-0006). */
  readonly translate: (skillName: string) => string | undefined;
  /** Re-read the translation file first; a freshly edited file must be honored. */
  readonly reloadTranslations: () => Promise<void>;
}

/** Stack `$` completion on top of whatever provider pi already had. */
export function createDollarProvider(
  current: AutocompleteProvider,
  deps: CompletionDeps,
): AutocompleteProvider {
  return {
    triggerCharacters: [...new Set([...(current.triggerCharacters ?? []), "$"])],
    async getSuggestions(
      lines,
      cursorLine,
      cursorCol,
      options,
    ): Promise<AutocompleteSuggestions | null> {
      const line = lines[cursorLine] ?? "";
      const prefix = extractDollarPrefix(line.slice(0, cursorCol));
      if (prefix === undefined)
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      await deps.reloadTranslations();
      const items = suggest(deps, prefix.slice(1));
      if (items.length === 0) return current.getSuggestions(lines, cursorLine, cursorCol, options);
      return { items, prefix };
    },
    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      if (!prefix.startsWith("$"))
        return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
      const line = lines[cursorLine] ?? "";
      const start = Math.max(0, cursorCol - prefix.length);
      // The cursor can sit inside the word: consume the rest of the token, or the
      // tail survives the replacement and the prompt reads `$alphaalpha`.
      const tail = line.slice(cursorCol).match(/^[^\s$]*/u)?.[0] ?? "";
      const end = cursorCol + tail.length;
      const next = [...lines];
      next[cursorLine] = `${line.slice(0, start)}${item.value}${line.slice(end)}`;
      return { lines: next, cursorLine, cursorCol: start + item.value.length };
    },
    shouldTriggerFileCompletion(lines, cursorLine, cursorCol): boolean {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };
}

function suggest(deps: CompletionDeps, query: string): AutocompleteItem[] {
  return rankByQuery(deps.entries(), query)
    .slice(0, ITEM_LIMIT)
    .map((entry) => {
      const text = deps.translate(entry.name) ?? entry.description;
      const description = [...entryMarkers(entry), text ?? ""].filter((part) => part.length > 0);
      return {
        value: `$${entry.name}`,
        label: `$${entry.name} [skill]`,
        ...(description.length > 0 ? { description: description.join(" ") } : {}),
      };
    });
}
