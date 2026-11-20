/**
 * Extension seam harness: a fake `ExtensionAPI` that records what the extension
 * registers, and a fake UI context that captures status writes, notifications and
 * reports. Tests fire the same events pi fires, so they observe the extension as
 * a session does.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionToolContext,
  RegisteredCommand,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import {
  createExtension,
  type ExtensionOptions,
  type SkillButlerController,
} from "../../src/index.js";

/** One write the extension made to the footer. */
export interface StatusWrite {
  readonly key: string;
  readonly text: string | undefined;
}

/** One message the extension sent into the transcript. */
export interface SentMessage {
  readonly customType: string;
  readonly content: unknown;
  readonly display?: boolean;
}

/** One notification the extension raised. */
export interface Notification {
  readonly message: string;
  readonly level: string;
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
  readonly controller: SkillButlerController;
  /** Every `setStatus` call, in order. */
  readonly statuses: StatusWrite[];
  /** Every message the extension sent into the transcript. */
  readonly messages: SentMessage[];
  /** Every notification, with its level. */
  readonly notifications: Notification[];
  /** Completion providers installed through `ui.addAutocompleteProvider`, applied. */
  readonly providers: AutocompleteProvider[];
  /** Registered handlers per event name. */
  readonly handlers: ReadonlyMap<string, readonly Handler[]>;
  /** Registered tools by name, as pi would expose them. */
  readonly tools: ReadonlyMap<string, RegisteredTool>;
  /** Registered commands by name. */
  readonly commands: ReadonlyMap<string, Omit<RegisteredCommand, "name" | "sourceInfo">>;
  /** Call one tool the way the model does, in a working directory. */
  callTool(
    name: string,
    params?: Record<string, unknown>,
    cwd?: string,
  ): Promise<AgentToolResult<Record<string, unknown>>>;
  /** Run every handler registered for one event, as pi does; returns what they returned. */
  fire(event: string, payload?: unknown): Promise<unknown[]>;
  /** Run one command's handler, as the slash-command surface does. */
  runCommand(name: string, args: string): Promise<void>;
  dispose(): void;
}

export interface HarnessOptions {
  readonly options?: ExtensionOptions;
  /** Shrink the watch debounce in the watch tests. */
  readonly watchDebounceMs?: number;
  /** What `getSystemPrompt()` answers; empty by default. */
  readonly systemPrompt?: string;
}

/** A provider that answers nothing, standing in for pi's own. */
const NO_PROVIDER: AutocompleteProvider = {
  triggerCharacters: [],
  async getSuggestions(): Promise<null> {
    return null;
  },
  applyCompletion(lines, cursorLine, cursorCol, item) {
    const line = lines[cursorLine] ?? "";
    const next = [...lines];
    next[cursorLine] = `${line.slice(0, cursorCol)}${item.value}${line.slice(cursorCol)}`;
    return { lines: next, cursorLine, cursorCol: cursorCol + item.value.length };
  },
};

export function createHarness(harnessOptions: HarnessOptions = {}): Harness {
  const statuses: StatusWrite[] = [];
  const messages: SentMessage[] = [];
  const notifications: Notification[] = [];
  const providers: AutocompleteProvider[] = [];
  const handlers = new Map<string, Handler[]>();
  const tools = new Map<string, RegisteredTool>();
  const commands = new Map<string, Omit<RegisteredCommand, "name" | "sourceInfo">>();
  const disposeHandlers: Array<() => void> = [];
  const systemPrompt = harnessOptions.systemPrompt ?? "";

  const ui = {
    setStatus(key: string, text: string | undefined): void {
      statuses.push({ key, text });
    },
    notify(message: string, level: "info" | "warning" | "error" = "info"): void {
      notifications.push({ message, level });
    },
    addAutocompleteProvider(
      factory: (current: AutocompleteProvider) => AutocompleteProvider,
    ): void {
      providers.push(factory(NO_PROVIDER));
    },
  };
  const ctx = {
    ui,
    cwd: harnessOptions.options?.cwd ?? process.cwd(),
    sessionId: "harness-session",
    getSystemPrompt: (): string => systemPrompt,
    sendMessage: (message: SentMessage): void => {
      messages.push(message);
    },
  };

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
    registerCommand(name: string, options: Omit<RegisteredCommand, "name" | "sourceInfo">): void {
      commands.set(name, options);
    },
    sendMessage(message: SentMessage): Promise<void> {
      messages.push(message);
      return Promise.resolve();
    },
  } as unknown as ExtensionAPI;

  const controller = createExtension(pi, {
    ...(harnessOptions.options ?? {}),
    watchDebounceMs: harnessOptions.watchDebounceMs,
  });

  return {
    pi,
    controller,
    statuses,
    messages,
    notifications,
    providers,
    handlers,
    tools,
    commands,
    async callTool(
      name: string,
      params: Record<string, unknown> = {},
      cwd: string = process.cwd(),
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`no tool is registered as "${name}"`);
      return tool.execute(params, cwd);
    },
    async fire(event: string, payload: unknown = {}): Promise<unknown[]> {
      const results: unknown[] = [];
      for (const handler of [...(handlers.get(event) ?? [])]) {
        results.push(await handler(payload, ctx));
      }
      return results;
    },
    async runCommand(name: string, args: string): Promise<void> {
      const command = commands.get(name);
      if (!command) throw new Error(`no command is registered as "${name}"`);
      await command.handler(args, ctx as never);
    },
    dispose(): void {
      controller.dispose();
      for (const off of disposeHandlers.splice(0)) off();
    },
  };
}
