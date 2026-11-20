/**
 * pi-skillbutler — skill preferences and visibility for pi.
 *
 * The extension is a factory so a test can build one without a running pi: the
 * factory registers the session seams and hands back a controller. Four seams
 * carry the behavior — `session_start` loads the view and installs the `$` popup,
 * `before_agent_start` applies the preferences and answers a named skill,
 * `session_shutdown` releases them, and one tool and two commands let a human see
 * and change what the turn will look like.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type {
  ExtensionAPI,
  NormalizedBuildSystemPromptOptions,
} from "@earendil-works/pi-coding-agent";
import { COMMAND_NAME, createCommandOptions } from "./commands/skillbutler.js";
import {
  buildCompletionEntries,
  type CompletionEntry,
  type HostSkill,
} from "./completion/entries.js";
import { createDollarProvider } from "./completion/provider.js";
import { createTranslationTable, translationsFile } from "./completion/translations.js";
import { buildInvocationText, INVOCATION_CUSTOM_TYPE } from "./invocation/inject.js";
import { scanInvocations } from "./invocation/matcher.js";
import {
  agentDir,
  type ManagedRootsOptions,
  managedRoots,
  projectPreferenceFile,
  usageStatsFile,
  userPreferenceFile,
} from "./paths.js";
import { applyPreferences } from "./preferences/overlay.js";
import { loadPreferences } from "./preferences/preferences.js";
import type { SessionView } from "./session.js";
import { parseHostSkills } from "./skills/host.js";
import { scanSkills } from "./skills/inventory.js";
import { appendUsageEvent } from "./stats/store.js";
import { createStatusTool } from "./tools/status.js";

/** Command name and log prefix: one identity for the package. */
export { COMMAND_NAME };
export const LOG_PREFIX = "skillbutler";
/** The `via` value this package writes when the user names a skill with `$name`. */
export const VIA_DOLLAR = "dollar";

export interface ExtensionOptions extends ManagedRootsOptions {
  /** Managed roots; defaults to the two fixed ones. A test passes its own pair. */
  readonly roots?: readonly string[];
  /** Preference files, user and project; defaults resolve from the environment and cwd. */
  readonly preferenceFiles?: { readonly user: string; readonly project: string };
  /** The completion translation file; defaults to `i18n.json` in the agent directory. */
  readonly translationsFile?: string;
  /** The usage log; defaults to the agent directory. */
  readonly statsFile?: string;
  /** Working directory the project preference file is resolved from. */
  readonly cwd?: string;
  /** Character budget for the overview section. */
  readonly overviewLimit?: number;
}

/** What the entry hands back: the resolved roots, the current view and a way out. */
export interface SkillButlerController {
  /** The fixed managed roots this session reads preferences over. */
  readonly roots: readonly string[];
  /** The loaded view, or undefined before the first load. */
  view(): SessionView | undefined;
  /** Scan the roots and read both preference files again. */
  reload(): Promise<SessionView>;
  /** Every skill the `$` popup can offer. */
  entries(): readonly CompletionEntry[];
  dispose(): void;
}

/** Register this package's seams on a running pi and return its controller. */
export function createExtension(
  pi: ExtensionAPI,
  options: ExtensionOptions = {},
): SkillButlerController {
  const env = options.env ?? process.env;
  const roots = options.roots ?? managedRoots(env);
  const preferenceFiles = options.preferenceFiles ?? {
    user: userPreferenceFile(env),
    project: projectPreferenceFile(options.cwd ?? process.cwd()),
  };
  const translations = createTranslationTable(
    options.translationsFile ?? translationsFile(agentDir(env)),
  );
  const statsFile = options.statsFile ?? usageStatsFile(env);
  let view: SessionView | undefined;
  /** Skills already pointed at this session: a second naming says so, not the path. */
  let named = new Set<string>();

  const reload = async (): Promise<SessionView> => {
    const inventory = await scanSkills(roots);
    const hostSkills = view?.hostSkills ?? [];
    try {
      const preferences = await loadPreferences(preferenceFiles);
      view = { inventory, preferences, hostSkills };
    } catch (error) {
      // A file that does not parse must not cost the session its skills: keep the
      // last good preferences, flag the message, and let the report show it.
      view = {
        inventory,
        preferences: view?.preferences ?? { preferences: new Map(), files: [] },
        hostSkills,
        error: (error as Error).message,
      };
    }
    return view;
  };

  const entries = (): readonly CompletionEntry[] =>
    view === undefined
      ? []
      : buildCompletionEntries(view.inventory, view.preferences.preferences, view.hostSkills);

  pi.registerTool(createStatusTool({ roots, env, statsFile }));
  const command = createCommandOptions({
    view: () => view,
    reload,
    env,
    files: preferenceFiles,
    statsFile,
    send: (message) => {
      void pi.sendMessage(message);
    },
  });
  pi.registerCommand(COMMAND_NAME, command);

  const disposers: Array<() => void> = [];
  disposers.push(
    pi.on("session_start", async (_event, ctx) => {
      named = new Set();
      await reload();
      const hostSkills = parseHostSkills(ctx.getSystemPrompt());
      if (hostSkills.length > 0 && view !== undefined) view = { ...view, hostSkills };
      ctx.ui.addAutocompleteProvider((current) =>
        createDollarProvider(current, {
          entries,
          translate: (name) => translations.lookup(name),
          reloadTranslations: () => translations.reload(),
        }),
      );
    }),
  );
  disposers.push(
    pi.on("before_agent_start", async (event) => {
      if (event.messageType !== "user") return;
      let current = view ?? (await reload());
      const hostSkills = hostSkillsOf(event.systemPromptOptions);
      if (hostSkills.length > 0) {
        // The prompt is the authority on what pi loaded; the roots only say what
        // this package manages, and the difference is what the popup labels.
        current = { ...current, hostSkills };
        view = current;
      }
      const scan = scanInvocations(event.prompt, (name) => resolves(current, name));
      applyOverlay(event.systemPromptOptions, current, scan.known, options.overviewLimit);
      const fresh = scan.known.filter((name) => !named.has(name));
      const repeated = scan.known.filter((name) => named.has(name));
      const targets = fresh.flatMap((name) => {
        const file = fileOf(current, name);
        return file === undefined ? [] : [{ name, file }];
      });
      for (const name of scan.known) await record(statsFile, name);
      for (const target of targets) named.add(target.name);
      const text = buildInvocationText(scan, targets, repeated, namesOf(current));
      if (text === undefined) return;
      return {
        message: { customType: INVOCATION_CUSTOM_TYPE, content: text, display: false },
      };
    }),
  );
  disposers.push(
    pi.on("session_shutdown", () => {
      view = undefined;
      named = new Set();
    }),
  );

  return {
    roots,
    view: () => view,
    reload,
    entries,
    dispose() {
      for (const dispose of disposers.splice(0)) dispose();
    },
  };
}

function applyOverlay(
  options: NormalizedBuildSystemPromptOptions,
  view: SessionView,
  named: readonly string[],
  limit: number | undefined,
): void {
  try {
    applyPreferences(options, view.preferences.preferences, named, limit);
  } catch (error) {
    console.warn(`${LOG_PREFIX}: preference overlay skipped: ${(error as Error).message}`);
  }
}

function resolves(view: SessionView, name: string): boolean {
  return fileOf(view, name) !== undefined;
}

/** Where a `$name` points: a managed root first, then whatever pi loaded. */
function fileOf(view: SessionView, name: string): string | undefined {
  const managed = view.inventory.skills.find((skill) => skill.name === name);
  if (managed !== undefined) return managed.skillFile;
  return view.hostSkills.find((skill) => skill.name === name)?.file;
}

function namesOf(view: SessionView): string[] {
  const names = new Set(view.inventory.skills.map((skill) => skill.name));
  for (const skill of view.hostSkills) names.add(skill.name);
  return [...names].sort((left, right) => left.localeCompare(right));
}

function hostSkillsOf(options: NormalizedBuildSystemPromptOptions): readonly HostSkill[] {
  return options.skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    file: skill.filePath,
  }));
}

async function record(statsFile: string, skill: string): Promise<void> {
  try {
    await appendUsageEvent(statsFile, { skill, at: new Date().toISOString(), via: VIA_DOLLAR });
  } catch (error) {
    // A log that cannot be written must never cost the turn.
    console.warn(`${LOG_PREFIX}: usage event dropped: ${(error as Error).message}`);
  }
}

/** Extension entry: register this package's seams on the running pi. */
export default function extension(pi: ExtensionAPI, env: NodeJS.ProcessEnv = process.env): void {
  createExtension(pi, { env });
}

export type { SessionView };
