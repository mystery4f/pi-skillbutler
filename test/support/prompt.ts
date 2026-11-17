/**
 * Prompt-option stand-ins: `applyPreferences` reads and writes `skills`, `sections`
 * and `systemPromptOptions.skills`, so the tests build those three fields and cast
 * at the seam rather than fake the whole normalized object.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { NormalizedBuildSystemPromptOptions } from "@earendil-works/pi-coding-agent";

/** The fields of one skill these tests read back. */
export interface FakeSkill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  sourceInfo: { source: string };
  disableModelInvocation: boolean;
}

export function fakeSkill(name: string, description = `${name} description`): FakeSkill {
  return {
    name,
    description,
    filePath: `/skills/${name}/SKILL.md`,
    baseDir: `/skills/${name}`,
    sourceInfo: { source: "user" },
    disableModelInvocation: false,
  };
}

/** The prompt options a turn starts with, holding the given skills. */
export function promptOptions(skills: readonly FakeSkill[]): NormalizedBuildSystemPromptOptions {
  return {
    skills: [...skills],
    sections: {},
    promptGuidelines: [],
  } as unknown as NormalizedBuildSystemPromptOptions;
}

/** The skills a turn would render after an overlay, read back for assertions. */
export function skillsOf(options: NormalizedBuildSystemPromptOptions): FakeSkill[] {
  return options.skills as unknown as FakeSkill[];
}
