/**
 * A preference file is small and fixed in shape, so it is parsed here instead of
 * pulling a YAML engine into the dependency graph. Only what the schema allows is
 * accepted: nested maps of `key: value`, two-space indentation, full-line
 * comments. Anything else fails with the file and the reason, because a silently
 * ignored setting is a bug the human cannot see.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { PreferenceError } from "./errors.js";

interface SourceLine {
  readonly indent: number;
  readonly text: string;
  readonly number: number;
}

/** A config file is parsed into plain maps; the schema decides what is legal. */
export type ParsedConfig = { readonly [key: string]: unknown };

export function parseConfigYaml(source: string, file: string): ParsedConfig {
  const lines: SourceLine[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const number = index + 1;
    if (raw.trim().length === 0) return;
    if (/^\s*#/.test(raw)) return;
    if (raw.includes("\t"))
      throw new PreferenceError(`${file}:${number}: tabs are not allowed, indent with two spaces`);
    const indent = raw.length - raw.trimStart().length;
    if (indent % 2 !== 0)
      throw new PreferenceError(`${file}:${number}: indentation must be a multiple of two spaces`);
    lines.push({ indent, text: raw.trim(), number });
  });
  if (lines.length === 0) return {};
  let at = 0;
  const parseMap = (indent: number, where: string): ParsedConfig => {
    const map: Record<string, unknown> = {};
    while (at < lines.length) {
      const line = lines[at];
      if (line === undefined) break;
      if (line.indent < indent) break;
      if (line.indent > indent) {
        throw new PreferenceError(
          `${file}:${line.number}: unexpected indentation (${line.indent} spaces); ${where} is a map of two-space entries`,
        );
      }
      const colon = line.text.indexOf(":");
      if (colon < 0) {
        throw new PreferenceError(
          `${file}:${line.number}: expected "key: value", found "${line.text}"`,
        );
      }
      const key = line.text.slice(0, colon).trim();
      if (key.length === 0) {
        throw new PreferenceError(
          `${file}:${line.number}: a setting needs a name before the colon`,
        );
      }
      if (Object.hasOwn(map, key))
        throw new PreferenceError(`${file}:${line.number}: "${key}" is set twice`);
      const rest = line.text.slice(colon + 1).trim();
      at += 1;
      if (rest.length === 0) {
        const next = lines[at];
        map[key] = next && next.indent > indent ? parseMap(next.indent, `"${key}"`) : null;
        continue;
      }
      const following = lines[at];
      if (following && following.indent > indent) {
        throw new PreferenceError(
          `${file}:${line.number}: "${key}" already holds "${rest}" and cannot also hold a block`,
        );
      }
      map[key] = parseScalar(rest, file, line.number);
    }
    return map;
  };
  const parsed = parseMap(0, "the file");
  const trailing = lines[at];
  if (trailing)
    throw new PreferenceError(`${file}:${trailing.number}: unexpected line "${trailing.text}"`);
  return parsed;
}

function parseScalar(raw: string, file: string, line: number): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "{}") return {};
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);
  const quoted = /^"(.*)"$/.exec(raw) ?? /^'(.*)'$/.exec(raw);
  if (quoted) return quoted[1] ?? "";
  if (/^["']/.test(raw))
    throw new PreferenceError(`${file}:${line}: a quote is opened and never closed`);
  return raw;
}
