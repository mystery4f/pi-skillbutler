/**
 * The completion popup's own language (ADR-0006). `@wuyaos/pi-i18n` keeps its
 * translations in one JSON file keyed by slash-command name, and it never looks
 * at a `$name` completion, so the popup stays English. Reading that file is
 * enough: no import, no second source of truth, and a missing file is simply
 * untranslated.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

/** The file `@wuyaos/pi-i18n` writes, inside the agent directory. */
export const TRANSLATIONS_FILE = "i18n.json";
/** The schema version this reader understands; anything else is ignored. */
const SUPPORTED_VERSION = 1;
/** The key one skill's translation sits under. */
export function translationKey(name: string): string {
  return `skill:${name}`;
}

/** The translation file for one agent directory. */
export function translationsFile(agentDir: string): string {
  return join(agentDir, TRANSLATIONS_FILE);
}

export interface TranslationTable {
  /** Re-read the file when it changed since the last load. Never throws. */
  reload(): Promise<void>;
  /** The human-facing description for a skill, when the file has one. */
  lookup(skillName: string): string | undefined;
}

export function createTranslationTable(file: string): TranslationTable {
  let stamp: string | undefined;
  let commands: ReadonlyMap<string, string> = new Map();
  return {
    async reload(): Promise<void> {
      try {
        const info = await stat(file);
        const next = `${info.mtimeMs}:${info.size}`;
        if (next === stamp) return;
        commands = readCommands(await readFile(file, "utf8"));
        stamp = next;
      } catch {
        // A missing or unreadable file is a language the popup does not have yet.
        commands = new Map();
        stamp = undefined;
      }
    },
    lookup(skillName: string): string | undefined {
      return commands.get(translationKey(skillName));
    },
  };
}

function readCommands(source: string): ReadonlyMap<string, string> {
  try {
    const parsed: unknown = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null) return new Map();
    const record = parsed as { version?: unknown; commands?: unknown };
    if (record.version !== SUPPORTED_VERSION) return new Map();
    if (typeof record.commands !== "object" || record.commands === null) return new Map();
    const commands = new Map<string, string>();
    for (const [key, value] of Object.entries(record.commands as Record<string, unknown>))
      if (typeof value === "string" && value.trim().length > 0) commands.set(key, value);
    return commands;
  } catch {
    return new Map();
  }
}
