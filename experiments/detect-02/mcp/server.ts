/**
 * DETECT-02 experimental MCP server (v1.5-exp, exploratory; never the Study 2b instrument). It builds the frozen
 * DaedalusArch server exactly as `src/mcp-server/main.ts` does (imported read-only: same tools, same flags, same
 * `--confine` and `--call-log`), then registers one more tool, `check_consistency` (R-D4 and R-XCTX, symbolic, no
 * model call). `--confine` applies to it with the frozen `confineArgs`; `--call-log` records it with the frozen
 * `withCallLog` (its `seq` counts from 1,000,001 so it never collides with the frozen tools' sequence).
 */
import * as path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildContext, parseArgs } from '../../../src/mcp-server/context.js';
import { createServer } from '../../../src/mcp-server/server.js';
import { confineArgs } from '../../../src/mcp-server/confine.js';
import { withCallLog } from '../../../src/mcp-server/call-log.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { checkConsistency, formatText } from './consistency.js';

export const CHECK_CONSISTENCY = 'check_consistency';

export const CHECK_CONSISTENCY_DESCRIPTION =
  'Checks the consistency boundaries of the domain model: whether a command (an application service or use-case method) saves more than one aggregate instance, or changes an aggregate that another bounded context owns, in the same synchronous call. '
  + 'It follows calls through ports, adapters and published module interfaces to the repository writes, and reads the aggregates and contexts from the architecture spec. '
  + 'WHEN: after you change persistence code (repositories, stores, save calls), a command that loads or saves aggregates, or code that calls another context; and always before you finish a step. '
  + 'Each finding gives file:line, the rule, why this code breaks it (the command, the aggregates, the calls that write them) and a fix. status is clean, violations or not-applicable (no aggregates). '
  + 'Fast and deterministic (no model call). Pass `files` (changed files, project-relative) to see only findings that involve them, or nothing to check the whole project.';

const shape = {
  files: z.array(z.string().min(1)).optional().describe('Changed files, relative to the project root; omit to check the whole project.'),
  project: z.string().optional().describe("Project root; defaults to the server's configured project."),
  spec: z.string().optional().describe("Path to the firewall spec YAML; defaults to the server's configured spec."),
};

export async function consistencyHandler(ctx: ServerContext, args: unknown): Promise<CallToolResult> {
  const a = z.object(shape).parse(args ?? {});
  const root = a.project !== undefined ? path.resolve(ctx.defaultProjectPath ?? process.cwd(), a.project) : ctx.defaultProjectPath;
  if (root === undefined) return { isError: true, content: [{ type: 'text', text: 'no project: start the server with --project or pass project' }] };
  const spec = a.spec ?? ctx.defaultSpecPath;
  try {
    const res = await checkConsistency({ root, ...(spec !== undefined ? { spec } : {}), ...(a.files !== undefined ? { files: a.files } : {}) });
    return { content: [{ type: 'text', text: formatText(res) }], structuredContent: { ...res, findings: res.findings.map((f) => ({ ...f })) } as Record<string, unknown> };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `check_consistency failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}` }] };
  }
}

/** The frozen server plus `check_consistency`. */
export function createDetectServer(ctx: ServerContext): McpServer {
  const server = createServer(ctx);
  let handler = async (args: unknown): Promise<CallToolResult> => consistencyHandler(ctx, args);
  if (ctx.confine === true) {
    const inner = handler;
    handler = async (args) => {
      const refusal = confineArgs({ specPath: ctx.defaultSpecPath, projectPath: ctx.defaultProjectPath, cwd: process.cwd() }, args);
      return refusal === null ? inner(args) : { isError: true, content: [{ type: 'text', text: refusal }] };
    };
  }
  if (ctx.callLog !== undefined) {
    let seq = 1_000_000;
    handler = withCallLog(ctx.callLog, CHECK_CONSISTENCY, handler, () => ++seq);
  }
  const register = server.registerTool.bind(server) as unknown as (name: string, config: Record<string, unknown>, h: (args: unknown) => Promise<CallToolResult>) => unknown;
  register(CHECK_CONSISTENCY, {
    title: 'Check aggregate and context consistency boundaries',
    description: CHECK_CONSISTENCY_DESCRIPTION,
    inputSchema: shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handler);
  return server;
}

export function contextFrom(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): ServerContext {
  return buildContext(parseArgs(argv), env);
}
