/**
 * One error type for every preference problem: the message already names the
 * file, the key and what is allowed, so a caller only has to show it.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
export class PreferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferenceError";
  }
}

/** A value the schema refuses, said in terms of the key and the value received. */
export function invalidValue(
  file: string,
  skill: string,
  key: string,
  value: unknown,
  want: string,
): PreferenceError {
  return new PreferenceError(
    `${file}: skill "${skill}": "${key}" ${want}, got ${JSON.stringify(value)}`,
  );
}
