/**
 * The two frontmatter fields this plugin needs: the skill's name and its
 * one-line description. A `SKILL.md` without frontmatter still counts — pi reads
 * the directory name then.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
export interface Frontmatter {
  readonly name?: string;
  readonly description?: string;
}

export function readFrontmatter(source: string): Frontmatter {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      end = index;
      break;
    }
  }
  if (end < 0) return {};
  const block = lines.slice(1, end);
  const fields: Record<string, string> = {};
  for (let index = 0; index < block.length; index += 1) {
    const line = block[index] ?? "";
    const match = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1] ?? "";
    const rest = (match[2] ?? "").trim();
    if (rest === ">" || rest === "|" || rest === ">-" || rest === "|-") {
      const collected: string[] = [];
      while (index + 1 < block.length) {
        const next = block[index + 1] ?? "";
        if (next.trim().length > 0 && !/^\s/.test(next)) break;
        collected.push(next.trim());
        index += 1;
      }
      fields[key] = collected.join(rest.startsWith(">") ? " " : "\n").trim();
      continue;
    }
    fields[key] = unquote(rest);
  }
  const name = fields.name?.trim();
  const description = fields.description?.trim();
  return {
    name: name && name.length > 0 ? name : undefined,
    description: description && description.length > 0 ? description : undefined,
  };
}

function unquote(value: string): string {
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  return quoted ? (quoted[1] ?? "") : value;
}
