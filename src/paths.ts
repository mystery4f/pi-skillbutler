/**
 * Where skills and preferences live. Two fixed roots — nothing is discovered
 * from the working directory — and user-level files in the agent directory.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { homedir } from "node:os";
import { join, sep } from "node:path";

/** Preference file name, user level; the project level sits at `.pi/skill-pro.yml`. */
export const USER_PREFERENCE_FILE = "skill-pro.yml";
export const PROJECT_PREFERENCE_DIR = ".pi";
/** Usage log file name, user level (ADR-0008); one JSON event per line. */
export const USAGE_STATS_FILE = "skillbutler-stats.jsonl";

export interface ManagedRootsOptions {
  /** Environment the agent directory is resolved from; defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
}

/** The pi agent directory: `$PI_CODING_AGENT_DIR`, else `~/.pi/agent`. */
export function agentDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PI_CODING_AGENT_DIR?.trim();
  return configured && configured.length > 0 ? configured : join(homedir(), ".pi", "agent");
}

/** The fixed managed roots, in the order they are reported. */
export function managedRoots(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  return [join(homedir(), ".agents", "skills"), join(agentDir(env), "skills")];
}

/** The user-level preference file. */
export function userPreferenceFile(env: NodeJS.ProcessEnv = process.env): string {
  return join(agentDir(env), USER_PREFERENCE_FILE);
}

/** The project-level preference file for one project root. */
export function projectPreferenceFile(projectRoot: string): string {
  return join(projectRoot, PROJECT_PREFERENCE_DIR, USER_PREFERENCE_FILE);
}

/** The user-level usage log. */
export function usageStatsFile(env: NodeJS.ProcessEnv = process.env): string {
  return join(agentDir(env), USAGE_STATS_FILE);
}

/** A path as the report shows it: the home directory becomes `~`. */
export function displayPath(absolute: string): string {
  const home = homedir();
  if (absolute === home) return "~";
  const prefix = home.endsWith(sep) ? home : `${home}${sep}`;
  return absolute.startsWith(prefix) ? `~${absolute.slice(home.length)}` : absolute;
}
