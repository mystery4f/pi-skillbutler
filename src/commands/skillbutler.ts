/**
 * The human surface (ADR-0003, ADR-0009): `/skillbutler list|show|set|unset|why`.
 * Reports go into the transcript because they are worth re-reading; a write is
 * acknowledged with one line, since the file itself is the record.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RegisteredCommand } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { displayPath } from "../paths.js";
import { withPreferencesLock } from "../preferences/lock.js";
import {
  type PreferenceEntry,
  type PreferenceMap,
  SKILL_KEYS,
  type SkillKey,
} from "../preferences/preferences.js";
import { parseSettingValue, withoutSetting, withSetting } from "../preferences/writer.js";
import type { SessionView } from "../session.js";
import type { SkillRecord } from "../skills/inventory.js";
import { readUsageEvents } from "../stats/store.js";

/** Command name: the package name without its `pi` prefix; `/skillbutler` is the one way in. */
export const COMMAND_NAME = "skillbutler";
/** Custom message type the reports arrive as. */
export const REPORT_CUSTOM_TYPE = "skillbutler-report";
/** Marker for a skill the prompt never shows. */
const HIDDEN_MARK = "[hidden]";
/** How many names a "nothing by that name" message offers. */
const NAME_LIMIT = 60;

export interface CommandIo {
  notify(message: string, level?: "info" | "warning" | "error"): void;
  report(text: string): void;
}

export interface CommandDeps {
  /** The current view, or undefined before the first load. */
  view(): SessionView | undefined;
  /** Load the inventory and preferences again after a write. */
  reload(): Promise<SessionView>;
  readonly env?: NodeJS.ProcessEnv;
  /** The two preference files this session reads and writes. */
  readonly files: { readonly user: string; readonly project: string };
  /** The usage log this session appends to and `reset` truncates. */
  readonly statsFile: string;
  /** Deliver a multi-line report into the transcript instead of the footer. */
  send(message: { customType: string; content: string; display: boolean }): void;
}

export type CommandOptions = Omit<RegisteredCommand, "name" | "sourceInfo">;

export const SUBCOMMANDS: readonly AutocompleteItem[] = [
  { value: "list", label: "list", description: "every managed skill, with weight and path" },
  { value: "show", label: "show", description: "one skill's settings and where each came from" },
  { value: "set", label: "set", description: "set one setting in the user file" },
  { value: "unset", label: "unset", description: "remove one setting from the user file" },
  { value: "why", label: "why", description: "why a skill is or is not offered" },
  { value: "reset", label: "reset", description: "clear the usage log" },
];

export function createCommandOptions(deps: CommandDeps): CommandOptions {
  return {
    description: "Inspect and change skill preferences: list, show, set, unset, why, reset",
    getArgumentCompletions: (prefix) => completeArguments(prefix, deps),
    handler: async (args, ctx) => {
      const io: CommandIo = {
        notify: (message, level = "info") => ctx.ui.notify(message, level),
        report: (text) => {
          deps.send({ customType: REPORT_CUSTOM_TYPE, content: text, display: true });
        },
      };
      const { user, project } = deps.files;
      await runCommand(args, io, deps, user, project);
    },
  };
}

/** Dispatch one command line. Exported so a test can drive it without a session. */
export async function runCommand(
  args: string,
  io: CommandIo,
  deps: CommandDeps,
  userFile: string,
  projectFile: string,
): Promise<void> {
  const [subcommand = "list", ...rest] = args.trim().split(/\s+/u);
  try {
    const view = deps.view() ?? (await deps.reload());
    switch (subcommand) {
      case "list":
        io.report(renderList(view, userFile));
        return;
      case "show":
        io.report(renderShow(view, requireName(rest[0], "show"), userFile));
        return;
      case "why":
        io.report(renderWhy(view, requireName(rest[0], "why"), userFile, projectFile));
        return;
      case "set": {
        const name = requireName(rest[0], "set");
        const key = requireKey(rest[1]);
        const raw = rest.slice(2).join(" ");
        if (raw.length === 0)
          throw new Error(`set needs a value: /skillbutler set ${name} ${key} <value>`);
        const value = parseSettingValue(key, raw, userFile, name);
        await withPreferencesLock(userFile, async () => {
          const next = withSetting(await readSource(userFile), userFile, name, key, value);
          await writeUserFile(userFile, next);
        });
        await deps.reload();
        io.notify(`skillbutler: ${name}.${key} = ${String(value)} in ${displayPath(userFile)}`);
        return;
      }
      case "unset": {
        const name = requireName(rest[0], "unset");
        const key = requireKey(rest[1]);
        await withPreferencesLock(userFile, async () => {
          const next = withoutSetting(await readSource(userFile), userFile, name, key);
          await writeUserFile(userFile, next);
        });
        await deps.reload();
        io.notify(`skillbutler: removed ${name}.${key} from ${displayPath(userFile)}`);
        return;
      }
      case "reset": {
        const events = await readUsageEvents(deps.statsFile);
        await writeFile(deps.statsFile, "", "utf8");
        io.notify(
          `skillbutler: cleared ${events.length} namings from ${displayPath(deps.statsFile)}`,
        );
        return;
      }
      default:
        io.notify(
          `skillbutler: unknown subcommand "${subcommand}"; try list, show, set, unset, why, reset`,
          "error",
        );
    }
  } catch (error) {
    io.notify(`skillbutler: ${(error as Error).message}`, "error");
  }
}

async function completeArguments(prefix: string, deps: CommandDeps): Promise<AutocompleteItem[]> {
  const trimmed = prefix.trimStart();
  const space = trimmed.indexOf(" ");
  if (space < 0) return SUBCOMMANDS.filter((item) => item.value.startsWith(trimmed));
  const subcommand = trimmed.slice(0, space);
  const rest = trimmed.slice(space + 1);
  if (subcommand === "set" || subcommand === "unset") {
    if (rest.includes(" ")) return SKILL_KEYS.map((key) => ({ value: key, label: key }));
    return namesOf(deps.view())
      .filter((name) => name.startsWith(rest))
      .map((name) => ({ value: name, label: name }));
  }
  if (subcommand === "reset") return [];
  if (rest.includes(" ")) return [];
  return namesOf(deps.view())
    .filter((name) => name.startsWith(rest))
    .map((name) => ({ value: name, label: name }));
}

function namesOf(view: SessionView | undefined): string[] {
  const names = new Set<string>();
  for (const skill of view?.inventory.skills ?? []) names.add(skill.name);
  for (const skill of view?.hostSkills ?? []) names.add(skill.name);
  return [...names].sort((left, right) => left.localeCompare(right));
}

function renderList(view: SessionView, userFile: string): string {
  const { inventory, preferences } = view;
  const hidden = inventory.skills.filter(
    (skill) => preferences.preferences.get(skill.name)?.hidden === true,
  ).length;
  const lines = [
    `skillbutler — ${inventory.skills.length} managed skills, ${
      inventory.skills.length - hidden
    } visible, ${hidden} hidden`,
    "",
    "Roots:",
    ...inventory.roots.map(
      (root) =>
        `  ${root.present ? "present" : "absent "}  ${String(root.count).padStart(3)} skills  ${displayPath(
          root.root,
        )}`,
    ),
    "",
    "Settings:",
    ...preferences.files.map(
      (file) => `  ${file.present ? "present" : "absent "}  ${displayPath(file.path)}`,
    ),
    "",
    ...inventory.skills.map((skill) => renderSkillLine(skill, preferences.preferences)),
    "",
    `Change a setting with: /skillbutler set <skill> <${SKILL_KEYS.join("|")}> <value>   (writes ${displayPath(
      userFile,
    )})`,
  ];
  if (view.error !== undefined) lines.push("", `Preference file error: ${view.error}`);
  return lines.join("\n");
}

function renderSkillLine(skill: SkillRecord, preferences: PreferenceMap): string {
  const entry = preferences.get(skill.name);
  const marks: string[] = [];
  if (entry?.hidden === true) marks.push(HIDDEN_MARK);
  if (skill.shadowedSkillFile !== undefined) marks.push("[duplicate]");
  const weight = entry?.weight === undefined ? "  -" : String(entry.weight).padStart(3);
  const mark = marks.length > 0 ? ` ${marks.join(" ")}` : "";
  return `  ${skill.name.padEnd(28)} ${weight}${mark}  ${displayPath(skill.skillFile)}`;
}

function renderShow(view: SessionView, name: string, userFile: string): string {
  const skill = view.inventory.skills.find((record) => record.name === name);
  const entry = view.preferences.preferences.get(name);
  const host = view.hostSkills.find((record) => record.name === name);
  if (skill === undefined && entry === undefined && host === undefined)
    return `${name}: nothing by that name. ${knownNames(view)}`;
  const lines = [`${name}${entry?.hidden === true ? `  ${HIDDEN_MARK}` : ""}`];
  if (skill !== undefined) {
    lines.push(`  file:        ${displayPath(skill.skillFile)}`);
    lines.push(`  root:        ${displayPath(skill.root)}`);
    if (skill.description !== undefined) lines.push(`  description: ${skill.description}`);
    if (skill.shadowedSkillFile !== undefined) {
      lines.push(
        `  duplicate:   ${displayPath(skill.shadowedSkillFile)} (a later root; pi uses the file above)`,
      );
    }
  } else if (host !== undefined) {
    lines.push(`  file:        ${displayPath(host.file)}`);
    lines.push("  root:        not managed by this package");
    if (host.description !== undefined) lines.push(`  description: ${host.description}`);
  }
  lines.push("  settings:");
  for (const key of SKILL_KEYS) lines.push(`    ${key}: ${renderSetting(entry, key, userFile)}`);
  return lines.join("\n");
}

function renderWhy(view: SessionView, name: string, userFile: string, projectFile: string): string {
  const skill = view.inventory.skills.find((record) => record.name === name);
  const entry = view.preferences.preferences.get(name);
  const host = view.hostSkills.find((record) => record.name === name);
  if (skill === undefined && entry === undefined && host === undefined)
    return `${name}: nothing by that name. ${knownNames(view)}`;
  const lines: string[] = [];
  if (entry?.hidden === true) {
    lines.push(
      `${name} is hidden: ${displayPath(originOf(entry, "hidden", userFile))} sets hidden: true, so the prompt never lists it.`,
    );
    lines.push(`Typing $${name} still reaches it.`);
  } else if (skill === undefined) {
    lines.push(`${name} is visible: pi loads it from outside the managed roots.`);
  } else {
    lines.push(`${name} is visible: nothing sets hidden: true for it.`);
  }
  if (entry?.weight !== undefined) {
    lines.push(
      `weight ${entry.weight} from ${displayPath(originOf(entry, "weight", userFile))} orders it.`,
    );
  }
  for (const key of ["language", "style"] as const) {
    const value = entry?.[key];
    if (value !== undefined) {
      lines.push(
        `${key} ${value} from ${displayPath(originOf(entry, key, userFile))} is appended to its description.`,
      );
    }
  }
  if (skill?.shadowedSkillFile !== undefined) {
    lines.push(
      `A later root also holds this name; pi uses ${displayPath(skill.skillFile)} and ignores ${displayPath(
        skill.shadowedSkillFile,
      )}.`,
    );
  }
  if (view.preferences.files.every((file) => !file.present)) {
    lines.push(
      `No preference file exists yet; yours would be ${displayPath(userFile)} (project override: ${displayPath(
        projectFile,
      )}).`,
    );
  }
  return lines.join("\n");
}

function renderSetting(
  entry: PreferenceEntry | undefined,
  key: SkillKey,
  userFile: string,
): string {
  const value = entry?.[key];
  if (value === undefined) return "not set";
  return `${String(value)} (from ${displayPath(originOf(entry, key, userFile))})`;
}

function originOf(entry: PreferenceEntry | undefined, key: SkillKey, userFile: string): string {
  return entry?.sources[key] ?? userFile;
}

function knownNames(view: SessionView): string {
  const names = namesOf(view);
  const shown = names.slice(0, NAME_LIMIT).join(", ");
  return `Known names: ${shown}${names.length > NAME_LIMIT ? ` (${names.length} in total)` : ""}`;
}

function requireName(value: string | undefined, subcommand: string): string {
  if (value === undefined || value.length === 0)
    throw new Error(`${subcommand} needs a skill name: /skillbutler ${subcommand} <name>`);
  return value;
}

function requireKey(value: string | undefined): SkillKey {
  if (value === undefined || !(SKILL_KEYS as readonly string[]).includes(value)) {
    throw new Error(
      `the setting must be one of ${SKILL_KEYS.join(", ")}, got ${JSON.stringify(value ?? "")}`,
    );
  }
  return value as SkillKey;
}

async function readSource(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

async function writeUserFile(file: string, text: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}
