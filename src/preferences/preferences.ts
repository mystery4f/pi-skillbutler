/**
 * The preference file: one map, keyed by skill name, of the four settings the
 * spec kept. A project file overrides the user file one key at a time, so a
 * project can pin `weight` without restating `style`.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { readFile } from "node:fs/promises";
import { invalidValue, PreferenceError } from "./errors.js";
import { type ParsedConfig, parseConfigYaml } from "./yaml.js";

/** The only settings a skill entry accepts. */
export const SKILL_KEYS = ["hidden", "weight", "language", "style"] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];
/** The only top-level key the file accepts. */
export const TOP_KEYS = ["skills"] as const;

/** One skill's settings, plus the file each one came from. */
export interface PreferenceEntry {
  readonly hidden?: boolean;
  readonly weight?: number;
  readonly language?: string;
  readonly style?: string;
  readonly sources: Readonly<Partial<Record<SkillKey, string>>>;
}

export type PreferenceMap = ReadonlyMap<string, PreferenceEntry>;

/** How one file was found, for the report. */
export interface PreferenceFileState {
  readonly path: string;
  readonly present: boolean;
}

export interface LoadedPreferences {
  readonly preferences: PreferenceMap;
  readonly files: readonly PreferenceFileState[];
}

/** Parse one file's text into entries, refusing anything the schema does not define. */
export function parsePreferences(source: string, file: string): PreferenceMap {
  const parsed = parseConfigYaml(source, file);
  for (const key of Object.keys(parsed)) {
    if (!(TOP_KEYS as readonly string[]).includes(key)) {
      throw new PreferenceError(
        `${file}: unknown setting "${key}"; this file takes ${TOP_KEYS.map((name) => `"${name}"`).join(", ")}`,
      );
    }
  }
  const skills = parsed.skills;
  if (skills === undefined || skills === null) return new Map();
  if (typeof skills !== "object" || Array.isArray(skills))
    throw new PreferenceError(`${file}: "skills" must be a map of skill name to its settings`);
  const entries = new Map<string, PreferenceEntry>();
  for (const [name, raw] of Object.entries(skills as ParsedConfig)) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new PreferenceError(
        `${file}: skill "${name}" must be a map of settings, got ${JSON.stringify(raw)}`,
      );
    }
    entries.set(name, parseEntry(name, raw as ParsedConfig, file));
  }
  return entries;
}

function parseEntry(name: string, raw: ParsedConfig, file: string): PreferenceEntry {
  const sources: Partial<Record<SkillKey, string>> = {};
  let hidden: boolean | undefined;
  let weight: number | undefined;
  let language: string | undefined;
  let style: string | undefined;
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    switch (key) {
      case "hidden":
        if (typeof value !== "boolean")
          throw invalidValue(file, name, key, value, "must be true or false");
        hidden = value;
        break;
      case "weight":
        if (typeof value !== "number" || !Number.isFinite(value))
          throw invalidValue(file, name, key, value, "must be a number");
        weight = value;
        break;
      case "language":
        if (typeof value !== "string" || value.trim().length === 0)
          throw invalidValue(file, name, key, value, "must be a non-empty string such as en or zh");
        language = value;
        break;
      case "style":
        if (typeof value !== "string" || value.trim().length === 0)
          throw invalidValue(file, name, key, value, "must be a non-empty string");
        style = value;
        break;
      default:
        throw new PreferenceError(
          `${file}: skill "${name}": unknown setting "${key}"; allowed: ${SKILL_KEYS.join(", ")}`,
        );
    }
    sources[key as SkillKey] = file;
  }
  return { hidden, weight, language, style, sources };
}

/** Project entries win per key; a key only the user file sets stays as it was. */
export function mergePreferences(user: PreferenceMap, project: PreferenceMap): PreferenceMap {
  const merged = new Map<string, PreferenceEntry>(user);
  for (const [name, entry] of project) {
    const before = merged.get(name);
    if (!before) {
      merged.set(name, entry);
      continue;
    }
    merged.set(name, {
      hidden: entry.hidden ?? before.hidden,
      weight: entry.weight ?? before.weight,
      language: entry.language ?? before.language,
      style: entry.style ?? before.style,
      sources: { ...before.sources, ...entry.sources },
    });
  }
  return merged;
}

/**
 * Read both files. A file that is absent is not an error — nothing is configured
 * yet — but a file that exists and does not parse is, with its own message.
 */
export async function loadPreferences(files: {
  readonly user: string;
  readonly project: string;
}): Promise<LoadedPreferences> {
  const states: PreferenceFileState[] = [];
  const maps: Array<{ file: string; map: PreferenceMap }> = [];
  for (const file of [files.user, files.project]) {
    const text = await readIfPresent(file);
    states.push({ path: file, present: text !== undefined });
    if (text !== undefined) maps.push({ file, map: parsePreferences(text, file) });
  }
  const merged = maps[0] ? mergePreferences(maps[0].map, maps[1]?.map ?? new Map()) : new Map();
  return { preferences: merged, files: states };
}

async function readIfPresent(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw new PreferenceError(`${file}: ${(error as Error).message}`);
  }
}
