/**
 * `skillbutler_status`: the model's read-only view of the inventory and the
 * preferences that shape it. One question — "what does pi-skillbutler see, and
 * why" — answered from the files, never from a cache the tool has to explain.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type {
  AgentToolResult,
  ExtensionToolContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  displayPath,
  projectPreferenceFile,
  usageStatsFile,
  userPreferenceFile,
} from "../paths.js";
import {
  loadPreferences,
  type PreferenceEntry,
  type PreferenceFileState,
} from "../preferences/preferences.js";
import { type Inventory, scanSkills } from "../skills/inventory.js";
import { readUsageEvents, summarizeUsage, type UsageSummary } from "../stats/store.js";

/** Tool name: the plugin prefix, then the one verb. */
export const STATUS_TOOL = "skillbutler_status";

/** Names listed in one answer before the list is clipped; the count stays exact. */
export const INVENTORY_LINE_LIMIT = 120;
/** Skill names the usage line prints before it clips; the totals stay exact. */
export const USAGE_NAME_LIMIT = 5;

export interface StatusToolDeps {
  readonly roots: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  /** The usage log; defaults to the agent directory. */
  readonly statsFile?: string;
}

export interface StatusReport {
  readonly text: string;
  readonly details: Record<string, unknown>;
}

/** The parameters the model may pass: one optional name, nothing else. */
const StatusParameters = Type.Object({
  name: Type.Optional(
    Type.String({
      description:
        "One skill's full record: where its file is, the settings in effect, and which file each came from. Omit it for the whole inventory.",
    }),
  ),
});

/**
 * The static description carries the fixed paths and the reload rule; the list
 * of skill names is deliberately not injected — it changes with every install and
 * the inventory call already answers it.
 */
export function statusDescription(deps: StatusToolDeps): string {
  const env = deps.env ?? process.env;
  return [
    "Read-only view of the skills pi-skillbutler manages: each skill's file, whether it is hidden, and the weight that orders it. Use it when the skill you expected is missing from the list, or to answer why one is not offered.",
    `Managed roots, scanned in this order: ${deps.roots.map((root) => `\`${displayPath(root)}\``).join(", ")}. A name found in both keeps the first and is reported as a duplicate.`,
    `Settings: \`${displayPath(userPreferenceFile(env))}\` overridden per key by \`.pi/skill-pro.yml\` in the working directory. Both are read when the extension loads, so an edited file applies after /reload or a new session.`,
  ].join("\n\n");
}

export function createStatusTool(deps: StatusToolDeps): ToolDefinition {
  const env = deps.env ?? process.env;
  const statsFile = deps.statsFile ?? usageStatsFile(env);
  return {
    name: STATUS_TOOL,
    label: "Skill inventory",
    description: statusDescription(deps),
    parameters: StatusParameters,
    async execute(
      _toolCallId: string,
      params: { name?: string },
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionToolContext,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      const inventory = await scanSkills(deps.roots);
      const loaded = await loadPreferences({
        user: userPreferenceFile(env),
        project: projectPreferenceFile(ctx.cwd),
      });
      const usage = summarizeUsage(await readUsageEvents(statsFile));
      const report = params.name
        ? describeOneSkill(inventory, loaded.preferences, loaded.files, usage, params.name)
        : describeInventory(
            inventory,
            loaded.preferences,
            loaded.files,
            usage,
            displayPath(statsFile),
          );
      return { content: [{ type: "text", text: report.text }], details: report.details };
    },
  };
}

export function describeInventory(
  inventory: Inventory,
  preferences: ReadonlyMap<string, PreferenceEntry>,
  files: readonly PreferenceFileState[],
  usage: ReadonlyMap<string, UsageSummary>,
  usageFile: string,
): StatusReport {
  const rows = inventory.skills.map((skill) => ({
    name: skill.name,
    root: displayPath(skill.root),
    skillFile: displayPath(skill.skillFile),
    hidden: preferences.get(skill.name)?.hidden === true,
    weight: preferences.get(skill.name)?.weight ?? 0,
    description: skill.description,
    shadowedSkillFile: skill.shadowedSkillFile && displayPath(skill.shadowedSkillFile),
    namings: usage.get(skill.name)?.count ?? 0,
  }));
  const ranked = [...rows].sort(
    (left, right) => right.weight - left.weight || left.name.localeCompare(right.name),
  );
  const hidden = ranked.filter((row) => row.hidden);
  const lines: string[] = ["roots"];
  for (const summary of inventory.roots) {
    lines.push(
      `  ${displayPath(summary.root)}  ${summary.present ? `${summary.count} skills` : "missing"}`,
    );
  }
  lines.push("settings");
  for (const file of files) {
    lines.push(`  ${displayPath(file.path)}  ${file.present ? "present" : "missing"}`);
  }
  lines.push(
    `inventory: ${rows.length} skills, ${rows.length - hidden.length} visible, ${hidden.length} hidden`,
  );
  lines.push(usageLine(usage, rows.length));
  const shown = ranked.slice(0, INVENTORY_LINE_LIMIT);
  for (const row of shown) {
    lines.push(
      `  ${row.name}${row.hidden ? "  [hidden]" : ""}  weight ${row.weight}  ${row.skillFile}${row.shadowedSkillFile ? `  (also ${row.shadowedSkillFile})` : ""}`,
    );
  }
  if (ranked.length > shown.length) {
    lines.push(`  … ${ranked.length - shown.length} more not listed; pass a name to inspect one`);
  }
  return {
    text: lines.join("\n"),
    details: {
      roots: inventory.roots.map((summary) => ({ ...summary, root: displayPath(summary.root) })),
      settings: files.map((file) => ({ ...file, path: displayPath(file.path) })),
      counts: { total: rows.length, visible: rows.length - hidden.length, hidden: hidden.length },
      skills: rows,
      usage: [...usage].map(([skill, summary]) => ({ skill, ...summary })),
      usageFile,
    },
  };
}

export function describeOneSkill(
  inventory: Inventory,
  preferences: ReadonlyMap<string, PreferenceEntry>,
  files: readonly PreferenceFileState[],
  usage: ReadonlyMap<string, UsageSummary>,
  name: string,
): StatusReport {
  const skill = inventory.skills.find((record) => record.name === name);
  if (!skill) return missingSkill(inventory, name);
  const entry = preferences.get(name);
  const lines = [skill.name];
  lines.push(`  file: ${displayPath(skill.skillFile)}`);
  lines.push(`  root: ${displayPath(skill.root)}`);
  if (skill.description) lines.push(`  description: ${skill.description}`);
  if (skill.shadowedSkillFile) {
    lines.push(`  duplicate: ${displayPath(skill.shadowedSkillFile)} is shadowed by this one`);
  }
  if (!entry) {
    lines.push("  settings: none; the skill is visible and orders as weight 0");
  } else {
    lines.push(`  hidden: ${entry.hidden === true}${origin(entry, "hidden", files)}`);
    lines.push(`  weight: ${entry.weight ?? 0}${origin(entry, "weight", files)}`);
    if (entry.language !== undefined)
      lines.push(`  language: ${entry.language}${origin(entry, "language", files)}`);
    if (entry.style !== undefined)
      lines.push(`  style: ${entry.style}${origin(entry, "style", files)}`);
  }
  const used = usage.get(name);
  lines.push(
    used === undefined
      ? "  usage: never named"
      : `  usage: ${used.count} namings, last ${used.lastAt}`,
  );
  return {
    text: lines.join("\n"),
    details: {
      name: skill.name,
      skillFile: displayPath(skill.skillFile),
      root: displayPath(skill.root),
      description: skill.description,
      duplicateOf: skill.shadowedSkillFile && displayPath(skill.shadowedSkillFile),
      settings: entry ?? null,
      settingsFiles: files.map((file) => ({ ...file, path: displayPath(file.path) })),
      usage: usage.get(name) ?? null,
    },
  };
}

function origin(
  entry: PreferenceEntry,
  key: keyof PreferenceEntry,
  files: readonly PreferenceFileState[],
): string {
  if (key === "sources") return "";
  const file = entry.sources[key];
  if (!file) return "";
  const state = files.find((candidate) => candidate.path === file);
  return state
    ? `  (from ${displayPath(file)})`
    : `  (from ${displayPath(file)}, which is no longer present)`;
}

function missingSkill(inventory: Inventory, name: string): StatusReport {
  const names = inventory.skills.map((skill) => skill.name);
  const shown = names.slice(0, 40);
  const more = names.length - shown.length;
  return {
    text: [
      `No managed skill is named "${name}".`,
      shown.length === 0
        ? "No skill is installed under the two managed roots."
        : `Known names (${names.length}): ${shown.join(", ")}${more > 0 ? `, and ${more} more` : ""}.`,
    ].join("\n"),
    details: { name, known: names },
  };
}

/** One line answering "how often, and when last" for the whole log. */
export function usageLine(usage: ReadonlyMap<string, UsageSummary>, managed?: number): string {
  if (usage.size === 0) {
    return managed === undefined
      ? "usage: no namings yet"
      : `usage: no namings yet; none of ${managed} managed skills has been named`;
  }
  const total = [...usage.values()].reduce((sum, summary) => sum + summary.count, 0);
  const last = [...usage.values()].reduce(
    (latest, summary) => (summary.lastAt > latest ? summary.lastAt : latest),
    "",
  );
  const shown = [...usage].slice(0, USAGE_NAME_LIMIT);
  const more = usage.size > shown.length ? `, and ${usage.size - shown.length} more` : "";
  const skills = `${usage.size} skill${usage.size === 1 ? "" : "s"}`;
  const names = shown.map(([skill, summary]) => `${skill} ${summary.count}`).join(", ");
  const unused =
    managed === undefined ? "" : `, ${Math.max(0, managed - usage.size)} of ${managed} never named`;
  return [
    `usage: ${total} namings across ${skills}`,
    `(${names}${more}), last ${last}${unused}`,
  ].join(" ");
}
