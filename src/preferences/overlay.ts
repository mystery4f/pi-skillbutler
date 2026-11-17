/**
 * The preference layer (ADR-0002): one pass over the skill list pi is about to
 * render, so a hidden skill disappears, a heavy one moves up, and a language or
 * style preference rides along in its description. The overlay edits the options
 * in place — a replacement prompt would miss every cache.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { NormalizedBuildSystemPromptOptions, Skill } from "@earendil-works/pi-coding-agent";
import type { PreferenceEntry, PreferenceMap } from "./preferences.js";

/** Section tag the overview lives under, so a later update can replace just it. */
export const OVERVIEW_SECTION = "skillbutler";
/** Characters the overview may spend; it is a hint, not a catalog. */
export const OVERVIEW_LIMIT = 400;
/** How many weighted names the overview prints before it stops. */
const OVERVIEW_WEIGHTED = 8;

export interface OverlayResult {
  readonly applied: boolean;
  readonly visible: number;
  readonly hidden: number;
}

/**
 * Apply the preferences to one turn's prompt options. With no preference at all
 * the options are left untouched — no section, no reordering, nothing — so an
 * unconfigured install sends exactly the prompt pi would have sent.
 */
export function applyPreferences(
  options: NormalizedBuildSystemPromptOptions,
  preferences: PreferenceMap,
  namedThisTurn: readonly string[],
  limit: number = OVERVIEW_LIMIT,
): OverlayResult {
  if (preferences.size === 0) return { applied: false, visible: options.skills.length, hidden: 0 };
  const total = options.skills.length;
  const visible = options.skills.filter((skill) => preferences.get(skill.name)?.hidden !== true);
  const hidden = total - visible.length;
  options.skills = visible.map((skill) => describe(skill, preferences.get(skill.name)));
  options.skills.sort(compareSkills(preferences));
  options.sections[OVERVIEW_SECTION] = overview(preferences, total, hidden, namedThisTurn, limit);
  return { applied: true, visible: visible.length, hidden };
}

/** The description pi shows, with this skill's own language and style appended. */
function describe(skill: Skill, entry: PreferenceEntry | undefined): Skill {
  const notes: string[] = [];
  if (entry?.language !== undefined) notes.push(`answer in ${entry.language}`);
  if (entry?.style !== undefined) notes.push(`style: ${entry.style}`);
  if (notes.length === 0) return skill;
  return { ...skill, description: `${skill.description} (${notes.join("; ")})` };
}

/** Heavier first; equal weights keep the order pi loaded them in. */
function compareSkills(preferences: PreferenceMap): (left: Skill, right: Skill) => number {
  return (left, right) =>
    (preferences.get(right.name)?.weight ?? 0) - (preferences.get(left.name)?.weight ?? 0);
}

function overview(
  preferences: PreferenceMap,
  total: number,
  hidden: number,
  namedThisTurn: readonly string[],
  limit: number,
): string {
  const named = new Set(namedThisTurn);
  const weighted = [...preferences]
    .filter(([, entry]) => entry.weight !== undefined)
    .sort((left, right) => (right[1].weight ?? 0) - (left[1].weight ?? 0))
    .slice(0, OVERVIEW_WEIGHTED)
    .map(([name, entry]) => `${name} (${entry.weight ?? 0})`);
  const hiddenNames = [...preferences]
    .filter(([name, entry]) => entry.hidden === true && !named.has(name))
    .map(([name]) => name)
    .sort();
  const parts = [`${total - hidden} of ${total} skills visible`];
  if (weighted.length > 0) parts.push(`heaviest first: ${weighted.join(", ")}`);
  if (hiddenNames.length > 0) parts.push(`hidden: ${hiddenNames.join(", ")}`);
  const reused = [...named].sort();
  if (reused.length > 0) parts.push(`named this turn: ${reused.join(", ")}`);
  parts.push("read a skill's file before applying it");
  const text = `Skill preferences: ${parts.join("; ")}.`;
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`;
}
