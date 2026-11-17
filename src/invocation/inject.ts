/**
 * The one message a named skill adds to a turn (ADR-0005): its file, never its
 * text. pi already lists every visible skill's path in the system prompt, so the
 * message earns its place by naming a skill the list cannot show — a hidden one —
 * and by recording which skill the user meant this turn.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { InvocationScan } from "./matcher.js";

/** Custom message type, so a transcript can tell these messages apart. */
export const INVOCATION_CUSTOM_TYPE = "skillbutler-invocation";
/** How many names a "nothing answers to that" hint offers before it stops counting. */
export const HINT_NAME_LIMIT = 40;

export interface InvocationTarget {
  readonly name: string;
  /** Absolute path of the skill's `SKILL.md`. */
  readonly file: string;
}

/**
 * Text for the turn, or undefined when the prompt names nothing — an unnamed turn
 * adds no message at all, which is what keeps an untouched session byte-identical.
 */
export function buildInvocationText(
  scan: InvocationScan,
  targets: readonly InvocationTarget[],
  alreadyNamed: readonly string[],
  available: readonly string[],
): string | undefined {
  if (scan.known.length === 0 && scan.unknown.length === 0) return undefined;
  const lines: string[] = [];
  if (targets.length > 0) {
    lines.push(
      "The user named these skills with `$name`. Read each file before acting on it, then follow it:",
    );
    for (const target of targets) lines.push(`- $${target.name} → ${target.file}`);
  }
  if (alreadyNamed.length > 0) {
    if (lines.length > 0) lines.push("");
    const named = alreadyNamed.map((name) => `$${name}`).join(", ");
    lines.push(`Already named earlier this session, so the path is not repeated: ${named}.`);
  }
  if (scan.unknown.length > 0) {
    if (lines.length > 0) lines.push("");
    const quoted = scan.unknown.map((name) => `$${name}`).join(", ");
    const hint = available.length > 0 ? ` Names available: ${nameList(available)}.` : "";
    lines.push(`Nothing is installed under ${quoted}.${hint}`);
  }
  return lines.join("\n");
}

function nameList(names: readonly string[]): string {
  const shown = names.slice(0, HINT_NAME_LIMIT).join(", ");
  return names.length > HINT_NAME_LIMIT ? `${shown} (${names.length} in total)` : shown;
}
