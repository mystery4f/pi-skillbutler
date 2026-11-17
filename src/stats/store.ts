/**
 * The usage-event store: one append-only JSONL file in the agent directory
 * (ADR-0008). Writes are line appends; reads tolerate everything a crash or a
 * stray editor can leave behind. Aggregation happens at read time, never in the
 * file.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface UsageEvent {
  /** The managed skill this event names. */
  readonly skill: string;
  /** When it was used, as an ISO timestamp. */
  readonly at: string;
  /** How it fired — `$name`, a slash command, or the model's own pick. */
  readonly via?: string;
}

/** One event as the JSON a line holds; the newline belongs to the store. */
export function serializeUsageEvent(event: UsageEvent): string {
  return JSON.stringify(event);
}

/** A line as an event; a truncated write or a stray edit is skipped, not thrown. */
export function parseUsageLine(line: string): UsageEvent | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as { skill?: unknown; at?: unknown; via?: unknown };
  if (typeof record.skill !== "string" || record.skill.length === 0) return undefined;
  if (typeof record.at !== "string" || record.at.length === 0) return undefined;
  if (typeof record.via === "string" && record.via.length > 0) {
    return { skill: record.skill, at: record.at, via: record.via };
  }
  return { skill: record.skill, at: record.at };
}

/** Append one event, creating the parent directory when the file is new. */
export async function appendUsageEvent(file: string, event: UsageEvent): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${serializeUsageEvent(event)}\n`, "utf8");
}

/** Every readable event, oldest first; a missing file is no events, not an error. */
export async function readUsageEvents(file: string): Promise<UsageEvent[]> {
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw error;
  }
  const events: UsageEvent[] = [];
  for (const line of source.split("\n")) {
    const event = parseUsageLine(line);
    if (event) events.push(event);
  }
  return events;
}

/** Uses per skill, most-used first, name breaking ties. */
export function summarizeUsage(events: readonly UsageEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.skill, (counts.get(event.skill) ?? 0) + 1);
  }
  return new Map(
    [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}
