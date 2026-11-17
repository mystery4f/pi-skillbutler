/**
 * What the `$` popup offers (ADR-0001, ADR-0006): every skill a `$name` resolves
 * to, visible ones first in the order the model sees them, then the hidden ones
 * that only an explicit name reaches, then the skills pi loads from somewhere
 * outside the two managed roots.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { PreferenceMap } from "../preferences/preferences.js";
import type { Inventory } from "../skills/inventory.js";

/** A skill pi knows about but this package does not manage. */
export interface HostSkill {
  readonly name: string;
  readonly description?: string;
  readonly file: string;
}

export interface CompletionEntry {
  readonly name: string;
  readonly description?: string;
  readonly hidden: boolean;
  readonly weight: number;
  readonly managed: boolean;
  /** Another root holds the same name, so pi uses that root's copy. */
  readonly duplicate: boolean;
  readonly file: string;
}

export function buildCompletionEntries(
  inventory: Inventory,
  preferences: PreferenceMap,
  hostSkills: readonly HostSkill[],
): readonly CompletionEntry[] {
  const entries: CompletionEntry[] = [];
  const managed = new Set<string>();
  for (const record of inventory.skills) {
    const entry = preferences.get(record.name);
    managed.add(record.name);
    entries.push({
      name: record.name,
      description: record.description,
      hidden: entry?.hidden === true,
      weight: entry?.weight ?? 0,
      managed: true,
      duplicate: record.shadowedSkillFile !== undefined,
      file: record.skillFile,
    });
  }
  for (const skill of hostSkills) {
    if (managed.has(skill.name)) continue;
    entries.push({
      name: skill.name,
      description: skill.description,
      hidden: false,
      weight: 0,
      managed: false,
      duplicate: false,
      file: skill.file,
    });
  }
  return entries.sort(compareEntries);
}

/** Visible managed skills by weight, then hidden ones, then unmanaged ones. */
function compareEntries(left: CompletionEntry, right: CompletionEntry): number {
  const rank = (entry: CompletionEntry): number => {
    if (!entry.managed) return 2;
    return entry.hidden ? 1 : 0;
  };
  const byRank = rank(left) - rank(right);
  if (byRank !== 0) return byRank;
  if (left.managed && right.managed) {
    const byWeight = right.weight - left.weight;
    if (byWeight !== 0) return byWeight;
  }
  return left.name.localeCompare(right.name);
}

/** The markers the popup adds after a description, in a fixed order. */
export function entryMarkers(entry: CompletionEntry): string[] {
  const markers: string[] = [];
  if (entry.hidden) markers.push("[hidden]");
  if (!entry.managed) markers.push("[unmanaged]");
  if (entry.duplicate) markers.push("[duplicate]");
  if (entry.weight !== 0) markers.push(`[weight ${entry.weight}]`);
  return markers;
}

/**
 * Case-insensitive subsequence match, so `$gc` still finds `grill-with-docs`.
 * A name that starts with the query ranks above one that merely contains it.
 */
export function matchesQuery(name: string, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = name.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack.startsWith(needle)) return true;
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

/** Prefix matches first, then the rest, each keeping its entry order. */
export function rankByQuery(
  entries: readonly CompletionEntry[],
  query: string,
): readonly CompletionEntry[] {
  const matched = entries.filter((entry) => matchesQuery(entry.name, query));
  const lower = query.toLowerCase();
  const prefixed = matched.filter((entry) => entry.name.toLowerCase().startsWith(lower));
  const rest = matched.filter((entry) => !entry.name.toLowerCase().startsWith(lower));
  return [...prefixed, ...rest];
}
