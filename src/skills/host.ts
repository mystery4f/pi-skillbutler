/**
 * What pi already knows about skills (ADR-0006, ADR-0001): the rendered prompt
 * lists every skill a `$name` can reach that this package does not manage, which
 * is the only way the popup can label one as unmanaged.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { HostSkill } from "../completion/entries.js";

/** One `<skill>` block, as `formatSkillsForPrompt` writes it. */
const BLOCK =
  /<skill>\s*<name>([\s\S]*?)<\/name>\s*<description>([\s\S]*?)<\/description>\s*<location>([\s\S]*?)<\/location>\s*<\/skill>/gu;

/** Every skill the prompt lists. A prompt without a skills block yields none. */
export function parseHostSkills(systemPrompt: string): readonly HostSkill[] {
  const skills: HostSkill[] = [];
  for (const match of systemPrompt.matchAll(BLOCK)) {
    const name = unescapeXml(match[1] ?? "").trim();
    const location = unescapeXml(match[3] ?? "").trim();
    if (name.length === 0 || location.length === 0) continue;
    const description = unescapeXml(match[2] ?? "").trim();
    skills.push({ name, file: location, ...(description.length > 0 ? { description } : {}) });
  }
  return skills;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&");
}
