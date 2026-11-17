/**
 * pi-skill-pro — skill preferences and visibility for pi.
 *
 * The extension is a factory so a test can build one without a running pi: the
 * factory registers the session seams and hands back a controller. The seams
 * exist to be filled by later phases; what they do today is the footer chip, so
 * an installed copy is visible before any preference logic lands.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type ManagedRootsOptions, managedRoots } from "./paths.js";

/** Footer chip key, command name and log prefix: one identity for the package. */
export const SKILL_PRO_KEY = "skill-pro";
export const SKILL_PRO_COMMAND = "skill-pro";
export const LOG_PREFIX = "skill-pro";

export interface ExtensionOptions extends ManagedRootsOptions {}

/** What the entry hands back: the resolved roots and a way to unregister. */
export interface SkillProController {
  /** The fixed managed roots this session reads preferences over. */
  readonly roots: readonly string[];
  dispose(): void;
}

/** Register this package's seams on a running pi and return its controller. */
export function createExtension(
  pi: ExtensionAPI,
  options: ExtensionOptions = {},
): SkillProController {
  const roots = managedRoots(options.env);
  const disposers: Array<() => void> = [];
  disposers.push(
    pi.on("session_start", async (_event, ctx) => {
      // The chip is the only observable effect of Phase 2: it proves the UI seam
      // is wired before the list it will eventually summarize exists.
      ctx.ui.setStatus(SKILL_PRO_KEY, SKILL_PRO_KEY);
    }),
  );
  disposers.push(
    pi.on("session_shutdown", () => {
      // Nothing to stop yet; the hook exists so later phases have one place to
      // release what a session holds.
    }),
  );
  return {
    roots,
    dispose() {
      for (const dispose of disposers.splice(0)) dispose();
    },
  };
}

/** Extension entry: register this package's seams on the running pi. */
export default function extension(pi: ExtensionAPI, env: NodeJS.ProcessEnv = process.env): void {
  createExtension(pi, { env });
}
