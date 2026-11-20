/**
 * Writing the user-level file back (ADR-0003, ADR-0009). `set` and `unset` are
 * the only writers, they only ever touch the user file, and they rewrite it from
 * the parsed map — a hand-written project file keeps every byte it had.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { invalidValue, PreferenceError } from "./errors.js";
import {
  type PreferenceEntry,
  type PreferenceMap,
  parsePreferences,
  SKILL_KEYS,
  type SkillKey,
} from "./preferences.js";
import { parseConfigYaml } from "./yaml.js";

/** Header of a file this package wrote; a hand-written file keeps its own head. */
const WRITTEN_HEADER =
  "# Written by /skillbutler. Comments and ordering are yours to restore; only the settings below are kept.";

export type SettingValue = boolean | number | string;

/** One `set` argument, typed the way the schema wants it, or a message saying why not. */
export function parseSettingValue(
  key: SkillKey,
  raw: string,
  file: string,
  name: string,
): SettingValue {
  switch (key) {
    case "hidden":
      if (raw === "true") return true;
      if (raw === "false") return false;
      throw invalidValue(file, name, key, raw, "must be true or false");
    case "weight": {
      const value = Number(raw);
      if (raw.length === 0 || !Number.isFinite(value))
        throw invalidValue(file, name, key, raw, "must be a number");
      return value;
    }
    default:
      if (raw.trim().length === 0)
        throw invalidValue(file, name, key, raw, "must be a non-empty string");
      return raw;
  }
}

/** One skill entry with `key` set. The returned text is the whole file. */
export function withSetting(
  source: string | undefined,
  file: string,
  name: string,
  key: SkillKey,
  value: SettingValue,
): string {
  const entries = readEntries(source, file);
  const before = entries.get(name) ?? emptyEntry();
  entries.set(name, { ...before, [key]: value });
  return serializePreferences(entries);
}

/** One skill entry with `key` removed; an entry left empty is removed too. */
export function withoutSetting(
  source: string | undefined,
  file: string,
  name: string,
  key: SkillKey,
): string {
  const entries = readEntries(source, file);
  const before = entries.get(name);
  if (before === undefined || before[key] === undefined)
    throw new PreferenceError(`${file}: skill "${name}" has no "${key}" setting to remove`);
  const next: PreferenceEntry = { ...before };
  delete next[key];
  if (SKILL_KEYS.every((setting) => next[setting] === undefined)) entries.delete(name);
  else entries.set(name, next);
  return serializePreferences(entries);
}

/** Rewrite the map as YAML: the header, then every skill in name order. */
export function serializePreferences(entries: PreferenceMap): string {
  const names = [...entries.keys()].sort((left, right) => left.localeCompare(right));
  if (names.length === 0) return `${WRITTEN_HEADER}\nskills: {}\n`;
  const lines = [WRITTEN_HEADER, "skills:"];
  for (const name of names) {
    lines.push(`  ${formatScalar(name)}:`);
    const entry = entries.get(name);
    for (const key of SKILL_KEYS) {
      const value = entry?.[key];
      if (value !== undefined) lines.push(`    ${key}: ${formatScalar(value)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function readEntries(source: string | undefined, file: string): Map<string, PreferenceEntry> {
  if (source === undefined) return new Map();
  // Parse first: a file that does not validate must not be overwritten by a guess.
  parseConfigYaml(source, file);
  return new Map(parsePreferences(source, file));
}

function emptyEntry(): PreferenceEntry {
  return { sources: {} };
}

function formatScalar(value: SettingValue): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value) ? value : JSON.stringify(value);
}
