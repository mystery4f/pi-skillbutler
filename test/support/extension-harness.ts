/**
 * Extension seam harness: a fake `ExtensionAPI` that records what the extension
 * registers, and a fake UI context that captures status writes. Tests fire the
 * same events pi fires, so they observe the extension as a session does.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionToolContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
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

/** One registered tool, already bound to a fake tool context. */
export interface RegisteredTool {
  readonly name: string;
  readonly description: string;
  execute(
    params: Record<string, unknown>,
    cwd: string,
  ): Promise<AgentToolResult<Record<string, unknown>>>;
}

export interface Harness {
  readonly pi: ExtensionAPI;
  readonly controller: SkillProController;
  /** Every `setStatus` call, in order. */
  readonly statuses: StatusWrite[];
  /** Registered handlers per event name. */
  readonly handlers: ReadonlyMap<string, readonly Handler[]>;
  /** Registered tools by name, as pi would expose them. */
  readonly tools: ReadonlyMap<string, RegisteredTool>;
  /** Call one tool the way the model does, in a working directory. */
  callTool(
    name: string,
    params?: Record<string, unknown>,
    cwd?: string,
  ): Promise<AgentToolResult<Record<string, unknown>>>;
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
  const tools = new Map<string, RegisteredTool>();
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
    registerTool(tool: ToolDefinition): void {
      tools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        execute: (params, cwd) =>
          tool.execute("harness-call", params, undefined, undefined, {
            ...ctx,
            cwd,
          } as unknown as ExtensionToolContext) as Promise<
            AgentToolResult<Record<string, unknown>>
          >,
      });
    },
  } as unknown as ExtensionAPI;

  const controller = createExtension(pi, harnessOptions.options ?? {});

  return {
    pi,
    controller,
    statuses,
    handlers,
    tools,
    async callTool(
      name: string,
      params: Record<string, unknown> = {},
      cwd: string = process.cwd(),
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`no tool is registered as "${name}"`);
      return tool.execute(params, cwd);
    },
    async fire(event: string, payload: unknown = {}): Promise<void> {
      for (const handler of [...(handlers.get(event) ?? [])]) await handler(payload, ctx);
    },
    dispose(): void {
      controller.dispose();
      for (const off of disposeHandlers.splice(0)) off();
    },
  };
}
