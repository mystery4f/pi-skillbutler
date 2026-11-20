/**
 * One session's view of the inventory and its preferences. Rebuilt whenever a
 * file may have changed — a new session, or a `/skillbutler` write — and read by
 * every consumer, so the prompt overlay, the popup and the report agree.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { HostSkill } from "./completion/entries.js";
import type { LoadedPreferences } from "./preferences/preferences.js";
import type { Inventory } from "./skills/inventory.js";

export interface SessionView {
  readonly inventory: Inventory;
  readonly preferences: LoadedPreferences;
  /** Skills pi loads that the two managed roots do not hold. */
  readonly hostSkills: readonly HostSkill[];
  /**
   * Set when a preference file exists and does not parse. The session keeps
   * running on the last good view — a typo must not cost the user their skills.
   */
  readonly error?: string;
}
