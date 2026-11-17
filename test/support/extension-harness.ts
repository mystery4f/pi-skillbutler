/**
 * Extension seam harness: a fake `ExtensionAPI` that records what the extension
 * registers, and a fake UI context that captures status writes. Tests fire the
 * same events pi fires, so they observe the extension as a session does.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createExtension,
  type ExtensionOptions,
  type SkillProController,
} from "../../src/index.js";

/** One write the extension made to the footer. */
export interface StatusWrite {
  readonly key: string;
  readonly text: string | undefined;
}

type Handler = (event: unknown, ctx: unknown) => unknown;

export interface Harness {
  readonly pi: ExtensionAPI;
  readonly controller: SkillProController;
  /** Every `setStatus` call, in order. */
  readonly statuses: StatusWrite[];
  /** Registered handlers per event name. */
  readonly handlers: ReadonlyMap<string, readonly Handler[]>;
  /** Run every handler registered for one event, as pi does. */
  fire(event: string, payload?: unknown): Promise<void>;
  dispose(): void;
}

export interface HarnessOptions {
  readonly options?: ExtensionOptions;
}

export function createHarness(harnessOptions: HarnessOptions = {}): Harness {
  const statuses: StatusWrite[] = [];
  const handlers = new Map<string, Handler[]>();
  const disposeHandlers: Array<() => void> = [];

  const ui = {
    setStatus(key: string, text: string | undefined): void {
      statuses.push({ key, text });
    },
  };
  const ctx = { ui, cwd: process.cwd(), sessionId: "harness-session" };

  const pi = {
    on(event: string, handler: Handler): () => void {
      const registered = handlers.get(event) ?? [];
      registered.push(handler);
      handlers.set(event, registered);
      const off = (): void => {
        const current = handlers.get(event);
        if (!current) return;
        const at = current.indexOf(handler);
        if (at >= 0) current.splice(at, 1);
      };
      disposeHandlers.push(off);
      return off;
    },
  } as unknown as ExtensionAPI;

  const controller = createExtension(pi, harnessOptions.options ?? {});

  return {
    pi,
    controller,
    statuses,
    handlers,
    async fire(event: string, payload: unknown = {}): Promise<void> {
      for (const handler of [...(handlers.get(event) ?? [])]) await handler(payload, ctx);
    },
    dispose(): void {
      controller.dispose();
      for (const off of disposeHandlers.splice(0)) off();
    },
  };
}
