/**
 * The two managed roots and the two preference files are fixed paths; these
 * tests pin them so a later refactor cannot quietly start discovering skills
 * from the working directory.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  agentDir,
  managedRoots,
  projectPreferenceFile,
  userPreferenceFile,
} from "../../src/paths.js";

describe("managed roots", () => {
  it("reads the two fixed roots under the home directory", () => {
    expect(managedRoots({})).toEqual([
      join(homedir(), ".agents", "skills"),
      join(homedir(), ".pi", "agent", "skills"),
    ]);
  });

  it("follows PI_CODING_AGENT_DIR for the agent directory", () => {
    const env = { PI_CODING_AGENT_DIR: "D:/agent-home" };
    expect(agentDir(env)).toBe("D:/agent-home");
    expect(managedRoots(env)).toEqual([
      join(homedir(), ".agents", "skills"),
      join("D:/agent-home", "skills"),
    ]);
  });

  it("ignores a blank PI_CODING_AGENT_DIR", () => {
    expect(agentDir({ PI_CODING_AGENT_DIR: "   " })).toBe(join(homedir(), ".pi", "agent"));
  });
});

describe("preference files", () => {
  it("puts the user level in the agent directory", () => {
    expect(userPreferenceFile({ PI_CODING_AGENT_DIR: "D:/agent-home" })).toBe(
      join("D:/agent-home", "skill-pro.yml"),
    );
  });

  it("puts the project level under .pi", () => {
    expect(projectPreferenceFile("E:/work/demo")).toBe(
      join("E:/work/demo", ".pi", "skill-pro.yml"),
    );
  });
});
