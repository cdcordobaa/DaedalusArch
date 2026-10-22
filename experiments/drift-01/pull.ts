/**
 * DRIFT-01 arm `pull`: the PUZZLE-02 tool arm's MCP hub, prompt and argv, copied verbatim from
 * `experiments/puzzle-02-tool-arm/run-tool-arm.ts` on `origin/pilot/puzzle-02-tool-arm` (commit `9d8205004`, not
 * merged). Only changes: the hub takes `{ mcp }` instead of the whole input, and the hub is exported.
 * Design: `ops/notes/drift-01-design.md` §2.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { buildGeneratorArgs } from '../../scripts/lib/generators/argv.js';
import { withMcpServer } from '../../scripts/lib/generators/arms.js';
import type { GeneratorCliConfig } from '../../scripts/lib/generators/types.js';
import { framePrompt } from '../puzzle-01-baseline/run-baseline.js';

const REPO = process.cwd();

export interface McpInput {
  /** Node binary the relay runs on (readable by the generator). */
  readonly nodeBinary: string;
  /** The relay, `<harnessRoot>/bin/mcp-relay.cjs` (root-owned, 0755, no task text). */
  readonly relay: string;
  /** The hub's Unix socket (in a 0755 directory; the socket itself 0666). */
  readonly socket: string;
  /** `tsx` binary and the server entry (root-only). */
  readonly tsx: string;
  readonly serverEntry: string;
  /** Root-only directory of the frozen call logs (one file per cell) and the hub's taps. */
  readonly logDir: string;
}

/** Note §4, exact text (hint audit: `experiments/detect-02/mcp/hint-audit/frame-audit.txt`). */
export const TOOL_SENTENCE =
  'An architecture tool is available to you as an MCP server. Its check_consistency tool reports where a command breaks a consistency boundary of the domain model, with the file, the rule and a suggested change. Call check_consistency after you change code that saves data or code that calls another part of the system, and always before you finish. If it reports findings, address them before you finish.';

/** The baseline frame with the §4 sentence appended (the frozen `armPrompt` convention). */
export function toolPrompt(request: string, tcCommand: string): string {
  return `${framePrompt(request, tcCommand).replace(/\s+$/, '')}\n\n${TOOL_SENTENCE}\n`;
}

export const MCP_SERVER_NAME = 'daedalus-arch';
export const MCP_ALLOW_RULE = 'mcp__daedalus-arch__*';

export const PULL_SMOKE_PROMPT =
  'Reply with the names of the tools you have from MCP servers, one per line. Then call check_consistency once with no arguments and reply with the status it returns. Do not read, write or run anything else.';

/** The relay's MCP config, inline (no file the generator would need to read; nothing in it names the puzzle). */
export function mcpConfigJson(mcp: Pick<McpInput, 'nodeBinary' | 'relay' | 'socket'>): string {
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: mcp.nodeBinary, args: [mcp.relay, mcp.socket], env: {} } } });
}

/** The arm's argv: the frozen argv plus the relay's MCP config and the server's allow rule (note §3). */
export function toolArmArgs(config: GeneratorCliConfig, runId: string, prompt: string, mcp: Pick<McpInput, 'nodeBinary' | 'relay' | 'socket'>): readonly string[] {
  return withMcpServer(buildGeneratorArgs(config, { runId }, prompt), mcpConfigJson(mcp), [MCP_ALLOW_RULE], []);
}

/**
 * The root-side MCP hub (module header). One cell at a time is current; each socket connection gets a fresh server
 * process for that cell. Every `tools/call` request and its response are recorded in `<logDir>/<cell>.tap.jsonl`.
 */
export class McpHub {
  private server: net.Server | null = null;
  private cell: { id: string; turn: string; spec: string; project: string } | null = null;
  private readonly children = new Set<ChildProcess>();
  constructor(private readonly input: { readonly mcp: McpInput }) {}

  serverArgs(spec: string, project: string, cell: string): string[] {
    return [this.input.mcp.serverEntry, '--spec', spec, '--project', project, '--engine', 'cypher-interp', '--confine', '--call-log', path.join(this.input.mcp.logDir, `${cell}.calls.jsonl`)];
  }

  setCell(id: string, turn: string, spec: string, project: string): void {
    this.cell = { id, turn, spec, project };
  }

  setTurn(turn: string): void {
    if (this.cell !== null) this.cell = { ...this.cell, turn };
  }

  clear(): void {
    this.cell = null;
    for (const c of this.children) c.kill('SIGTERM');
  }

  async start(): Promise<void> {
    const sock = this.input.mcp.socket;
    fs.mkdirSync(this.input.mcp.logDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(sock), { recursive: true });
    fs.chmodSync(path.dirname(sock), 0o755);
    fs.rmSync(sock, { force: true });
    this.server = net.createServer((conn) => this.connect(conn));
    await new Promise<void>((resolve) => this.server?.listen(sock, resolve));
    fs.chmodSync(sock, 0o666);
  }

  async stop(): Promise<void> {
    this.clear();
    await new Promise<void>((resolve) => (this.server === null ? resolve() : this.server.close(() => resolve())));
    fs.rmSync(this.input.mcp.socket, { force: true });
  }

  private record(cell: string, line: Record<string, unknown>): void {
    fs.appendFileSync(path.join(this.input.mcp.logDir, `${cell}.tap.jsonl`), `${JSON.stringify({ at: new Date().toISOString(), ...line })}\n`);
  }

  private connect(conn: net.Socket): void {
    const cell = this.cell;
    if (cell === null) {
      conn.destroy();
      return;
    }
    const args = this.serverArgs(cell.spec, cell.project, cell.id);
    const child = spawn(this.input.mcp.tsx, args, { cwd: REPO, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/root', NODE_ENV: 'production' }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.children.add(child);
    this.record(cell.id, { event: 'connect', turn: cell.turn, confine: args.includes('--confine'), pid: child.pid ?? null });
    const stderr = fs.createWriteStream(path.join(this.input.mcp.logDir, `${cell.id}.stderr.log`), { flags: 'a' });
    child.stderr.pipe(stderr);
    const pending = new Map<string, { name: string; arguments: unknown }>();
    const tap = (dir: 'in' | 'out') => {
      let buf = '';
      return (chunk: Buffer): void => {
        buf += chunk.toString('utf8');
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          try {
            const m = JSON.parse(line) as { id?: unknown; method?: string; params?: { name?: string; arguments?: unknown }; result?: { isError?: boolean; structuredContent?: { status?: string; findings?: unknown[] }; tools?: { name: string }[] } };
            if (dir === 'in' && m.method === 'tools/call') pending.set(String(m.id), { name: String(m.params?.name), arguments: m.params?.arguments ?? {} });
            if (dir === 'out' && m.id !== undefined && pending.has(String(m.id))) {
              const req = pending.get(String(m.id)) as { name: string; arguments: unknown };
              pending.delete(String(m.id));
              this.record(cell.id, { event: 'call', turn: this.cell?.turn ?? cell.turn, tool: req.name, arguments: req.arguments, isError: m.result?.isError === true, status: m.result?.structuredContent?.status ?? null, findings: Array.isArray(m.result?.structuredContent?.findings) ? m.result.structuredContent.findings.length : null });
            }
            if (dir === 'out' && Array.isArray(m.result?.tools)) this.record(cell.id, { event: 'tools/list', turn: this.cell?.turn ?? cell.turn, tools: m.result.tools.map((t) => t.name) });
          } catch {
            // not a JSON-RPC line; ignore
          }
        }
      };
    };
    conn.on('data', tap('in'));
    child.stdout.on('data', tap('out'));
    conn.pipe(child.stdin);
    child.stdout.pipe(conn);
    const end = (): void => {
      if (!child.killed) child.kill('SIGTERM');
      this.children.delete(child);
    };
    conn.on('close', end);
    conn.on('error', end);
    child.on('exit', (code) => {
      this.children.delete(child);
      this.record(cell.id, { event: 'server-exit', code });
      conn.end();
    });
  }
}

