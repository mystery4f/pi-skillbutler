/**
 * The managed inventory: every directory under the two fixed roots that holds a
 * `SKILL.md`. A name found in both roots is kept from the first root and reported
 * as a duplicate, because a silent pick would hide the clash from the human.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { readFrontmatter } from "./frontmatter.js";

/** The filename pi itself looks for. */
export const SKILL_FILE = "SKILL.md";

export interface SkillRecord {
  /** Frontmatter name, else the directory name. */
  readonly name: string;
  readonly description?: string;
  /** Directory name as it sits on disk; differs from `name` when frontmatter renames it. */
  readonly directory: string;
  readonly skillFile: string;
  /** The managed root this record came from. */
  readonly root: string;
  /** A later root holds the same name; its file is reported but not usable. */
  readonly shadowedSkillFile?: string;
}

export interface RootSummary {
  readonly root: string;
  readonly present: boolean;
  /** Directories that held a `SKILL.md`. */
  readonly count: number;
}

export interface Inventory {
  readonly roots: readonly RootSummary[];
  readonly skills: readonly SkillRecord[];
}

export async function scanSkills(roots: readonly string[]): Promise<Inventory> {
  const summaries: RootSummary[] = [];
  const byName = new Map<string, SkillRecord>();
  for (const root of roots) {
    const directories = await listDirectories(root);
    summaries.push({ root, present: directories !== undefined, count: 0 });
    let count = 0;
    for (const directory of directories ?? []) {
      const skillFile = join(root, directory, SKILL_FILE);
      const source = await readIfPresent(skillFile);
      if (source === undefined) continue;
      count += 1;
      const frontmatter = readFrontmatter(source);
      const name = frontmatter.name ?? directory;
      const existing = byName.get(name);
      if (existing) {
        if (existing.shadowedSkillFile === undefined) {
          byName.set(name, { ...existing, shadowedSkillFile: skillFile });
        }
        continue;
      }
      byName.set(name, {
        name,
        description: frontmatter.description,
        directory,
        skillFile,
        root,
      });
    }
    summaries[summaries.length - 1] = { root, present: directories !== undefined, count };
  }
  return {
    roots: summaries,
    skills: [...byName.values()].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

async function listDirectories(root: string): Promise<string[] | undefined> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

async function readIfPresent(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR") return undefined;
    throw error;
  }
}
