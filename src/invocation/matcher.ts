/**
 * Which `$name` tokens a prompt actually invokes (ADR-0007). A fenced code block
 * is usually something the user quotes rather than asks for, so a token inside
 * one stays prose; inline code is the ordinary way to write a `$name` in a
 * sentence, so it counts.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */

/** `$` followed by the characters a skill name is allowed to use. */
const TOKEN = /\$([A-Za-z0-9][A-Za-z0-9._-]*)/gu;
/** A fence opener or closer: three or more backticks or tildes, indented at most three. */
const FENCE = /^\s{0,3}(`{3,}|~{3,})/u;

export interface InvocationScan {
  /** Names this session can point at, in the order the prompt mentions them. */
  readonly known: readonly string[];
  /** Names nothing answers to, in the order the prompt mentions them. */
  readonly unknown: readonly string[];
}

/** Blank out fenced code blocks, keeping every line and column where it was. */
export function maskFencedCode(text: string): string {
  let fence: string | undefined;
  return text
    .split("\n")
    .map((line) => {
      const marker = FENCE.exec(line);
      if (fence === undefined) {
        if (marker?.[1] === undefined) return line;
        fence = marker[1][0];
        return " ".repeat(line.length);
      }
      if (marker?.[1]?.startsWith(fence) === true) fence = undefined;
      return " ".repeat(line.length);
    })
    .join("\n");
}

/**
 * Scan one prompt. Each name is reported once — the first occurrence is the one
 * that gets replaced, and a repeat adds nothing to the turn.
 */
export function scanInvocations(
  prompt: string,
  resolves: (name: string) => boolean,
): InvocationScan {
  const known: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  const masked = maskFencedCode(prompt);
  for (const match of masked.matchAll(TOKEN)) {
    const name = match[1];
    const at = match.index;
    if (name === undefined || at === undefined) continue;
    if (isEscaped(masked, at) || seen.has(name)) continue;
    seen.add(name);
    if (resolves(name)) known.push(name);
    else unknown.push(name);
  }
  return { known, unknown };
}

/** An odd number of backslashes right before the `$` means the user escaped it. */
function isEscaped(text: string, at: number): boolean {
  let count = 0;
  for (let index = at - 1; index >= 0 && text[index] === "\\"; index -= 1) count += 1;
  return count % 2 === 1;
}
