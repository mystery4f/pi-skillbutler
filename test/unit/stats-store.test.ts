/**
 * The usage store's honesty: a round trip keeps events, a crash-torn or edited
 * file loses only its bad lines, and a missing file is no events.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appendUsageEvent,
  parseUsageLine,
  readUsageEvents,
  serializeUsageEvent,
  summarizeUsage,
} from "../../src/stats/store.js";
import { removeDir, tempDir } from "../support/temp.js";

let dir = "";

beforeAll(async () => {
  dir = await tempDir("skillbutler-stats-");
});

afterAll(async () => {
  await removeDir(dir);
});

describe("parseUsageLine", () => {
  it("keeps a full event and a bare one", () => {
    expect(parseUsageLine('{"skill":"retro","at":"2026-11-17T00:00:00Z","via":"dollar"}')).toEqual({
      skill: "retro",
      at: "2026-11-17T00:00:00Z",
      via: "dollar",
    });
    expect(parseUsageLine('{"skill":"retro","at":"2026-11-17T00:00:00Z"}')).toEqual({
      skill: "retro",
      at: "2026-11-17T00:00:00Z",
    });
  });

  it("skips blank, torn, and hollow lines", () => {
    expect(parseUsageLine("")).toBeUndefined();
    expect(parseUsageLine('{"skill":"retro","at":"2026-11-17T')).toBeUndefined();
    expect(parseUsageLine('{"nope":true}')).toBeUndefined();
    expect(parseUsageLine('"just a string"')).toBeUndefined();
  });
});

describe("appendUsageEvent and readUsageEvents", () => {
  it("round-trips events oldest first and creates the parent directory", async () => {
    const file = join(dir, "nested", "skillbutler-stats.jsonl");
    await appendUsageEvent(file, { skill: "retro", at: "2026-11-17T00:00:01Z" });
    await appendUsageEvent(file, { skill: "grill", at: "2026-11-17T00:00:02Z", via: "dollar" });
    expect(await readUsageEvents(file)).toEqual([
      { skill: "retro", at: "2026-11-17T00:00:01Z" },
      { skill: "grill", at: "2026-11-17T00:00:02Z", via: "dollar" },
    ]);
  });

  it("reads a missing file as no events", async () => {
    expect(await readUsageEvents(join(dir, "absent.jsonl"))).toEqual([]);
  });

  it("keeps the good lines around a torn tail", async () => {
    const file = join(dir, "torn.jsonl");
    const good = `${serializeUsageEvent({ skill: "retro", at: "2026-11-17T00:00:00Z" })}\n`;
    await writeFile(file, `${good}{"skill":"grill","at":"2026-11-17T\n${good}`, "utf8");
    const events = await readUsageEvents(file);
    expect(events.map((event) => event.skill)).toEqual(["retro", "retro"]);
    expect((await readFile(file, "utf8")).includes("grill")).toBe(true);
  });
});

describe("summarizeUsage", () => {
  it("counts per skill, most-used first, name breaking ties", () => {
    const events = [
      { skill: "beta", at: "a" },
      { skill: "alpha", at: "b" },
      { skill: "beta", at: "c" },
      { skill: "gamma", at: "d" },
    ];
    expect(summarizeUsage(events)).toEqual(
      new Map([
        ["beta", { count: 2, lastAt: "c" }],
        ["alpha", { count: 1, lastAt: "b" }],
        ["gamma", { count: 1, lastAt: "d" }],
      ]),
    );
  });

  it("keeps the newest time even when the log is out of order", () => {
    const usage = summarizeUsage([
      { skill: "beta", at: "c" },
      { skill: "beta", at: "a" },
    ]);
    expect(usage.get("beta")).toEqual({ count: 2, lastAt: "c" });
  });

  it("answers an empty log with an empty summary", () => {
    expect(summarizeUsage([]).size).toBe(0);
  });
});
