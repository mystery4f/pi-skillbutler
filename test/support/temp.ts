/**
 * Temp directories for the tests that read real files: one helper so every test
 * makes and removes its own tree the same way.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionOptions } from "../../src/index.js";

/** A fresh directory under the system temp path. */
export async function tempDir(prefix = "skillbutler-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/** Write one file inside a directory, creating the parents, and return its path. */
export async function writeFileIn(dir: string, relative: string, content: string): Promise<string> {
  const target = join(dir, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}

export interface SkillFrontmatter {
  readonly description?: string;
  /** A name that differs from the directory, the way a frontmatter rename does. */
  readonly name?: string;
}

/** A whole session's worth of files, laid out the way the real ones are. */
export interface TestProject {
  readonly root: string;
  /** `~/.agents/skills` for this test. */
  readonly userRoot: string;
  /** `~/.pi/agent/skills` for this test. */
  readonly agentRoot: string;
  readonly userPreferences: string;
  readonly projectPreferences: string;
  readonly translations: string;
  readonly stats: string;
  readonly cwd: string;
  /** Options that point every seam at this tree. */
  readonly options: ExtensionOptions;
  /** Write one `SKILL.md` under the given root and return its path. */
  skill(name: string, frontmatter?: SkillFrontmatter, root?: string): string;
  write(relative: string, content: string): string;
  cleanup(): void;
}

/** Build a self-contained tree: two roots, both preference files, cwd, stats and i18n. */
export function makeProject(): TestProject {
  // Windows CI hands out short names (`RUNNER~1`); resolve once so a path compared
  // in a test is the same path the code reports.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "skillbutler-")));
  const userRoot = join(root, "home", ".agents", "skills");
  const agentRoot = join(root, "agent", "skills");
  const userPreferences = join(root, "agent", "skillbutler.yml");
  const projectPreferences = join(root, "project", ".pi", "skillbutler.yml");
  const translations = join(root, "agent", "i18n.json");
  const stats = join(root, "agent", "skillbutler-stats.jsonl");
  const cwd = join(root, "project");
  mkdirSync(userRoot, { recursive: true });
  mkdirSync(agentRoot, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  return {
    root,
    userRoot,
    agentRoot,
    userPreferences,
    projectPreferences,
    translations,
    stats,
    cwd,
    options: {
      roots: [userRoot, agentRoot],
      preferenceFiles: { user: userPreferences, project: projectPreferences },
      translationsFile: translations,
      statsFile: stats,
      cwd,
      env: {},
    },
    skill(name, frontmatter = {}, at = userRoot) {
      const directory = join(at, name);
      mkdirSync(directory, { recursive: true });
      const lines = ["---"];
      if (frontmatter.name !== undefined) lines.push(`name: ${frontmatter.name}`);
      lines.push(`description: ${frontmatter.description ?? `${name} skill`}`);
      lines.push("---", "", `# ${name}`, "");
      const file = join(directory, "SKILL.md");
      writeFileSync(file, lines.join("\n"), "utf8");
      return file;
    },
    write(relative, content) {
      const target = join(root, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
      return target;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
