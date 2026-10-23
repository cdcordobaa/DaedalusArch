/**
 * COMPREHEND-01 (v1.5-exp) MCP server: the four comprehension tools `context_map`, `who_writes`, `trace` and `impact`
 * (`comprehend/tools.ts`), symbolic and read-only, no model call. Design: `ops/notes/comprehend-01-design.md` §2, §4.
 *
 * A separate server from `server.ts`, so the `check_consistency` server and its PUZZLE-02 arm are unchanged. By default
 * it serves the four tools alone (the FG arm); `withFrozen` also serves the frozen tools and `check_consistency`
 * (open decision D2). It takes the frozen server's flags (`buildContext`, imported read-only): `--project`, `--spec`,
 * `--tsconfig`, `--confine` and `--call-log`. The tools always answer about the configured project; they take no
 * project or spec argument, and under `--confine` an argument naming another project or spec is refused. Call-log
 * lines use `seq` from 2,000,001, so they never collide with the frozen tools' or `check_consistency`'s.
 *
 * GRAPH-SCALE (2026-10-23) adds a fifth tool, `callers` (every caller of a port or of one of its members, through its
 * implementations), served with `withCallers` (`--with-callers`). Without it the server is the COMPREHEND-01 arm's,
 * four tools, so that pilot stays reproducible.
 */
import * as path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { confineArgs } from '../../../src/mcp-server/confine.js';
import { withCallLog } from '../../../src/mcp-server/call-log.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { cachedIndex } from './comprehend/index.js';
import type { ComprehendIndex } from './comprehend/index.js';
import { callers, callersText, contextMap, contextMapText, impact, impactText, ToolInputError, trace, traceText, whoWrites, whoWritesText } from './comprehend/tools.js';
import { createDetectServer } from './server.js';

export const COMPREHEND_SERVER_NAME = 'daedalus-graph';
export const COMPREHEND_SERVER_VERSION = '0.1.0-exp';
export const COMPREHEND_TOOLS = ['context_map', 'who_writes', 'trace', 'impact'] as const;
/** GRAPH-SCALE: the four plus `callers`. */
export const GRAPH_SCALE_TOOLS = [...COMPREHEND_TOOLS, 'callers'] as const;
export type ComprehendTool = (typeof GRAPH_SCALE_TOOLS)[number];

const scope = {
  project: z.string().optional().describe('Ignored unless it names the configured project; the tools always answer about the configured project.'),
};

export const TOOL_SPECS: Readonly<Record<ComprehendTool, { title: string; description: string; shape: Record<string, z.ZodTypeAny> }>> = {
  context_map: {
    title: 'Bounded contexts and aggregates',
    description: 'Lists the bounded contexts (root folder, published files, number of commands) and the aggregate roots with the context that owns each, '
      + 'and says for every context and aggregate whether it is declared in the architecture spec or inferred from the code. No arguments.',
    shape: { ...scope },
  },
  who_writes: {
    title: 'Commands that write an aggregate',
    description: 'For one aggregate root, lists every command (application-service method or published module function) that saves it, directly or through calls, '
      + 'with the command file:line, its context, whether that context owns the aggregate, the instance written, the store method and the call chain to the write.',
    shape: { aggregate: z.string().min(1).describe('Aggregate root name, as context_map lists it.'), ...scope },
  },
  trace: {
    title: 'Call chain of a command',
    description: 'For one command, the call tree from the command through ports to the adapters that implement them, with file:line at each step and the reads and writes '
      + 'of aggregates, IO calls and unresolved calls there. Steps with none of these below them are hidden unless full is true.',
    shape: {
      command: z.string().min(1).describe('Class.method, or file#Class.method when the name is ambiguous (paths relative to the project root).'),
      full: z.boolean().optional().describe('Show every step, including value-object and helper calls.'),
      ...scope,
    },
  },
  impact: {
    title: 'Impact of a change to a file or symbol',
    description: 'For a file, or a top-level symbol in it, lists the files that import or reference it, the commands whose call tree reaches it, '
      + 'its layer and context, the architecture rules a change there could break (from what kind of file it is, and from findings already reported there), '
      + 'and which importers already break the allowed layer dependencies.',
    shape: { target: z.string().min(1).describe('A project-relative file (src/…/X.ts) or a symbol (src/…/X.ts#Name).'), ...scope },
  },
  callers: {
    title: 'Every caller of a port or method',
    description: 'For an interface or class (a port), or one of its members, lists every unit that calls it with file:line per call site: '
      + 'calls through the port itself, through the classes that implement or extend it, and through members it inherits when the receiver is typed by it. '
      + 'Also lists the implementations. Use it to find everything a change to a port affects.',
    shape: { port_or_method: z.string().min(1).describe('Type, Type.member, file#Type or file#Type.member (paths relative to the project root).'), ...scope },
  },
};

const fail = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] });

export async function runComprehendTool(ctx: ServerContext, tool: ComprehendTool, args: unknown): Promise<CallToolResult> {
  const root = ctx.defaultProjectPath;
  if (root === undefined) return fail('no project: start the server with --project');
  const parsed = z.object(TOOL_SPECS[tool].shape).safeParse(args ?? {});
  if (!parsed.success) return fail(`${tool}: invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const a = parsed.data as Record<string, unknown>;
  if (typeof a.project === 'string' && path.resolve(root, a.project) !== path.resolve(root)) return fail(`${tool}: the tools answer about the configured project only; omit project`);
  const t0 = Date.now();
  // `--tsconfig` (the frozen flag) lands in the frozen context's evaluateDeps; absent = a harness tsconfig over src/**.
  const tsconfig = ctx.evaluateDeps.tsconfigPath;
  let ix: ComprehendIndex; let cached: boolean;
  try {
    ({ index: ix, cached } = cachedIndex(root, { spec: ctx.defaultSpecPath, tsconfig }));
  } catch (e) {
    return fail(`${tool}: could not index the project: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  }
  try {
    let text: string; let data: unknown;
    switch (tool) {
      case 'context_map': { const r = contextMap(ix); text = contextMapText(r); data = r; break; }
      case 'who_writes': { const r = whoWrites(ix, String(a.aggregate)); text = whoWritesText(r); data = r; break; }
      case 'trace': { const r = trace(ix, String(a.command), { full: a.full === true }); text = traceText(r); data = r; break; }
      case 'impact': { const r = await impact(ix, String(a.target), tsconfig); text = impactText(r); data = r; break; }
      case 'callers': { const r = callers(ix, String(a.port_or_method)); text = callersText(r); data = r; break; }
    }
    const ms = Date.now() - t0;
    return { content: [{ type: 'text', text }], structuredContent: { tool, ms, indexCached: cached, result: data } as Record<string, unknown> };
  } catch (e) {
    if (e instanceof ToolInputError) return fail(`${tool}: ${e.message}`);
    return fail(`${tool} failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  }
}

export interface ComprehendServerOptions { readonly withFrozen?: boolean; readonly withCallers?: boolean }

export function createComprehendServer(ctx: ServerContext, opts: ComprehendServerOptions = {}): McpServer {
  const server = opts.withFrozen === true ? createDetectServer(ctx) : new McpServer({ name: COMPREHEND_SERVER_NAME, version: COMPREHEND_SERVER_VERSION });
  const register = server.registerTool.bind(server) as unknown as (name: string, config: Record<string, unknown>, h: (args: unknown) => Promise<CallToolResult>) => unknown;
  let seq = 2_000_000;
  for (const tool of opts.withCallers === true ? GRAPH_SCALE_TOOLS : COMPREHEND_TOOLS) {
    let handler = async (args: unknown): Promise<CallToolResult> => runComprehendTool(ctx, tool, args);
    if (ctx.confine === true) {
      const inner = handler;
      handler = async (args) => {
        const refusal = confineArgs({ specPath: ctx.defaultSpecPath, projectPath: ctx.defaultProjectPath, cwd: process.cwd() }, args);
        return refusal === null ? inner(args) : fail(refusal);
      };
    }
    if (ctx.callLog !== undefined) handler = withCallLog(ctx.callLog, tool, handler, () => ++seq);
    const s = TOOL_SPECS[tool];
    register(tool, {
      title: s.title, description: s.description, inputSchema: s.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, handler);
  }
  return server;
}
