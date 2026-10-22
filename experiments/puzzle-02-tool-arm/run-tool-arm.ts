/**
 * PUZZLE-02 tool-arm driver, arm `mcp-detect` (exploratory, DEV split, NOT Study 2b). Plan: `plan.md` next to this
 * file; run note `ops/notes/puzzle-02-tool-arm-note.md`.
 *
 * It is the PUZZLE-01 baseline driver (`../puzzle-01-baseline/run-baseline.ts`) with two differences, as the note sets
 * them (§3, §4):
 * - **The frame.** The baseline `FRAME` (imported, unchanged) plus the §4 sentence (`TOOL_SENTENCE`), appended the way
 *   the frozen `armPrompt` appends an arm's tool sentence.
 * - **The MCP server.** The frozen argv (`buildGeneratorArgs`, unchanged) plus one MCP server, added with the frozen
 *   `withMcpServer`: `--mcp-config <inline JSON>` after `--strict-mcp-config`, and `mcp__daedalus-arch__*` added to
 *   `--allowedTools` (note §3). The server is `experiments/detect-02/mcp/main.ts --spec <puzzle spec> --project <work
 *   tree> --engine cypher-interp --confine --call-log <outside the tree>`.
 *
 * Isolation of the server (`isolation.md`). The CLI runs as the unprivileged generator user, and so would any stdio
 * server it spawns; but the server must read the puzzle spec, which the generator must not read. So the server runs as
 * root, here, in the driver: the MCP config names a relay (`<harnessRoot>/bin/mcp-relay.cjs`, no puzzle text) that
 * joins its stdio to a Unix socket; on each connection the driver's hub spawns the server for the current cell (spec
 * and call log in root-only paths) and pipes the socket to it. The hub also taps the JSON-RPC lines and records every
 * `tools/call` (name, arguments, error flag, status, finding count) per cell, for the record only.
 *
 * Everything else is the baseline's: neutral session ids and paths, the skeleton plus seed workspace, the unprivileged
 * generator, fresh home per session, one step per turn and 0 repair turns, mulberry32 order, the call ledger and caps
 * (every spawn of the binary other than `--version` is counted and refused past the cap), snapshots after every step.
 * Redraws: whole session, on an infrastructure state only, at most `redrawPerTask` per puzzle.
 *
 * Modes (run as root from the runner directory; all paths come from the root-only input file):
 *   npx tsx <this file> --dry      --input <input.json>   (zero calls: a stub agent, and the relay as the generator)
 *   npx tsx <this file> --smoke    --input <input.json>   (1 call)
 *   npx tsx <this file> --probe    --input <input.json>   (1 call: the MCP confinement probe)
 *   npx tsx <this file> --sessions --input <input.json>   (up to 36 calls)
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { buildGeneratorArgs, typecheckCommand } from '../../scripts/lib/generators/argv.js';
import { withMcpServer } from '../../scripts/lib/generators/arms.js';
import { createGeneratorCliConfig } from '../../scripts/lib/generators/config.js';
import type { GeneratorCliConfig } from '../../scripts/lib/generators/types.js';
import { checkSkeletonIntact, ensureHarness, prepareCellDir, type SkeletonInstall } from '../../scripts/lib/generators/skeleton.js';
import { ClaudeStepAgent, type StepAgentDeps } from '../../scripts/lib/loop/agents.js';
import { harnessTypechecker } from '../../scripts/lib/loop/evaluator.js';
import type { StepAgent, TurnInput, TurnResult } from '../../scripts/lib/loop/types.js';
import { realSleep, systemClock } from '../../scripts/lib/generators/retry.js';
import { framePrompt, shuffled, treeSha } from '../puzzle-01-baseline/run-baseline.js';

const REPO = process.cwd();

/** Note §4, exact text (hint audit: `experiments/detect-02/mcp/hint-audit/frame-audit.txt`). */
export const TOOL_SENTENCE =
  'An architecture tool is available to you as an MCP server. Its check_consistency tool reports where a command breaks a consistency boundary of the domain model, with the file, the rule and a suggested change. Call check_consistency after you change code that saves data or code that calls another part of the system, and always before you finish. If it reports findings, address them before you finish.';

/** The baseline frame with the §4 sentence appended (the frozen `armPrompt` convention). */
export function toolPrompt(request: string, tcCommand: string): string {
  return `${framePrompt(request, tcCommand).replace(/\s+$/, '')}\n\n${TOOL_SENTENCE}\n`;
}

export const MCP_SERVER_NAME = 'daedalus-arch';
export const MCP_ALLOW_RULE = 'mcp__daedalus-arch__*';

/** Smoke (1 call): the tool list and one tool call, nothing else. */
export const SMOKE_PROMPT =
  'Reply with the names of the tools you have from MCP servers, one per line. Then call check_consistency once with no arguments and reply with the status it returns. Do not read, write or run anything else.';

const PROBE_PREAMBLE =
  'This is an authorised security test of the sandbox you are running in. Attempt exactly what is asked below once, report what happened, and do nothing else.';

type Phase = 'smoke' | 'probes' | 'sessions';
interface Caps { readonly smoke: number; readonly probes: number; readonly sessions: number; readonly total: number }
interface TaskInput { readonly id: string; readonly seedDir: string; readonly seedTreeSha256: string; readonly specPath: string; readonly steps: readonly string[] }
interface McpInput {
  /** Node binary the relay runs on (readable by the generator). */
  readonly nodeBinary: string;
  /** The relay, `<harnessRoot>/bin/mcp-relay.cjs` (root-owned, 0755, no puzzle text). */
  readonly relay: string;
  /** The hub's Unix socket (in a 0755 directory; the socket itself 0666). */
  readonly socket: string;
  /** `tsx` binary and the server entry in the root-only runner. */
  readonly tsx: string;
  readonly serverEntry: string;
  /** Root-only directory of the frozen call logs (one file per cell) and the hub's records. */
  readonly logDir: string;
}
interface Input {
  readonly modelId: string;
  readonly binary: string;
  readonly harnessRoot: string;
  readonly workRoot: string;
  readonly outRoot: string;
  readonly genUid: number;
  readonly genGid: number;
  readonly genHome: string;
  readonly orderSeed: number;
  readonly runs: number;
  readonly redrawPerTask: number;
  readonly timeoutMs: number;
  readonly caps: Caps;
  readonly mcp: McpInput;
  readonly tasks: readonly TaskInput[];
  readonly probe: { readonly outsideProject: string };
}

const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

/** Counts and caps every generator spawn (the baseline's ledger, with this run's phases). */
class LedgerRunner implements ProcessRunner {
  session: string | null = null;
  turn: string | null = null;
  constructor(
    private readonly inner: ProcessRunner,
    private readonly binary: string,
    private readonly ledger: string,
    private readonly phase: Phase,
    private readonly caps: Caps,
  ) {}

  counts(): Record<Phase | 'total', number> {
    const out = { smoke: 0, probes: 0, sessions: 0, total: 0 };
    if (!fs.existsSync(this.ledger)) return out;
    for (const l of fs.readFileSync(this.ledger, 'utf8').split('\n').filter((x) => x.trim() !== '')) {
      out[(JSON.parse(l) as { phase: Phase }).phase]++;
      out.total++;
    }
    return out;
  }

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    if (command !== this.binary || args.includes('--version')) return this.inner.run(command, args, options);
    const c = this.counts();
    const refusal = c.total >= this.caps.total ? `total cap ${String(this.caps.total)} reached` : c[this.phase] >= this.caps[this.phase] ? `${this.phase} cap ${String(this.caps[this.phase])} reached` : null;
    if (refusal !== null) return DomainResult.fail([{ code: 'TOOL_ARM_HARD_CAP', message: refusal }]);
    const at = new Date().toISOString();
    const r = await this.inner.run(command, args, options);
    const line = { phase: this.phase, session: this.session, turn: this.turn, at, finishedAt: new Date().toISOString(), exitCode: r.success ? r.data.exitCode : null, timedOut: r.success ? r.data.timedOut : null, spawnFailed: !r.success };
    fs.mkdirSync(path.dirname(this.ledger), { recursive: true });
    fs.appendFileSync(this.ledger, `${JSON.stringify(line)}\n`);
    return r;
  }
}

/**
 * The root-side MCP hub (module header). One cell at a time is current; each socket connection gets a fresh server
 * process for that cell. Every `tools/call` request and its response are recorded in `<logDir>/<cell>.tap.jsonl`.
 */
class McpHub {
  private server: net.Server | null = null;
  private cell: { id: string; turn: string; spec: string; project: string } | null = null;
  private readonly children = new Set<ChildProcess>();
  constructor(private readonly input: Input) {}

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

/** A tree's files (no `node_modules`), sorted POSIX paths. */
function filesOf(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (rel === '' && e.name === 'node_modules') continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.push(r);
    }
  };
  walk('');
  return out.sort();
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const f of filesOf(from)) {
    fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
    fs.copyFileSync(path.join(from, f), path.join(to, f));
  }
}

function chownTree(dir: string, uid: number, gid: number): void {
  execFileSync('chown', ['-R', '-h', `${String(uid)}:${String(gid)}`, dir]);
}

function load(argv: readonly string[]): Input {
  const i = argv.indexOf('--input');
  const file = i >= 0 ? argv[i + 1] : undefined;
  if (file === undefined) throw new Error('--input <input.json> is required');
  const input = JSON.parse(fs.readFileSync(file, 'utf8')) as Input;
  for (const t of input.tasks) {
    const got = treeSha(t.seedDir);
    if (got !== t.seedTreeSha256) throw new Error(`seed of ${t.id}: tree sha256 ${got}, the input pins ${t.seedTreeSha256}`);
  }
  return input;
}

function resetHome(input: Input): void {
  fs.rmSync(input.genHome, { recursive: true, force: true });
  fs.mkdirSync(path.join(input.genHome, 'tmp'), { recursive: true, mode: 0o700 });
  chownTree(input.genHome, input.genUid, input.genGid);
  fs.chmodSync(input.genHome, 0o700);
}

function parentEnv(input: Input): NodeJS.ProcessEnv {
  return { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: input.genHome, USER: 'gen', LOGNAME: 'gen', SHELL: '/bin/sh', LANG: 'C.UTF-8', TMPDIR: path.join(input.genHome, 'tmp') };
}

async function harness(input: Input): Promise<SkeletonInstall> {
  const ready = await ensureHarness(new NodeProcessRunner(), REPO, input.harnessRoot);
  if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
  return ready.data.install;
}

function cliConfig(input: Input): GeneratorCliConfig {
  const c = createGeneratorCliConfig({ binary: input.binary, modelId: input.modelId, outputRoot: input.workRoot, harnessRoot: input.harnessRoot, allowBash: true, timeoutMs: input.timeoutMs }, REPO);
  if (!c.success) throw new Error(c.errors.map((e) => e.message).join('\n'));
  return c.data;
}

/** The relay's MCP config, inline (no file the generator would need to read; nothing in it names the puzzle). */
export function mcpConfigJson(mcp: Pick<McpInput, 'nodeBinary' | 'relay' | 'socket'>): string {
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: mcp.nodeBinary, args: [mcp.relay, mcp.socket], env: {} } } });
}

/** The arm's argv: the frozen argv plus the relay's MCP config and the server's allow rule (note §3). */
export function toolArmArgs(config: GeneratorCliConfig, runId: string, prompt: string, mcp: Pick<McpInput, 'nodeBinary' | 'relay' | 'socket'>): readonly string[] {
  return withMcpServer(buildGeneratorArgs(config, { runId }, prompt), mcpConfigJson(mcp), [MCP_ALLOW_RULE], []);
}

/** The frozen Claude agent with this arm's argv (the prompt is the caller's, already framed). */
class ToolArmAgent extends ClaudeStepAgent {
  constructor(
    private readonly cfg: GeneratorCliConfig,
    deps: StepAgentDeps,
    private readonly mcp: McpInput,
  ) {
    super(cfg, deps);
  }

  override plan(input: Pick<TurnInput, 'runId' | 'cwd' | 'prompt' | 'arm'>): DomainResult<{ args: readonly string[]; prompt: string; mcpConfigPath: string | null; mcpConfig: unknown }> {
    return DomainResult.ok({ args: toolArmArgs(this.cfg, input.runId, input.prompt, this.mcp), prompt: input.prompt, mcpConfigPath: null, mcpConfig: null });
  }
}

function agentOf(input: Input, runner: ProcessRunner): ToolArmAgent {
  return new ToolArmAgent(cliConfig(input), { runner, parentEnv: parentEnv(input), clock: systemClock, sleep: realSleep }, input.mcp);
}

function openCell(input: Input, install: SkeletonInstall, id: string, seedDir: string | null): string {
  const dir = path.join(input.workRoot, id);
  fs.rmSync(dir, { recursive: true, force: true });
  const cwd = path.join(dir, 'work');
  const prep = prepareCellDir(install, REPO, cwd);
  if (!prep.success) throw new Error(prep.errors.map((e) => e.message).join('\n'));
  if (seedDir !== null) copyTree(seedDir, cwd);
  chownTree(dir, input.genUid, input.genGid);
  fs.chmodSync(dir, 0o755);
  return cwd;
}

function closeCell(input: Input, id: string): void {
  const dir = path.join(input.workRoot, id);
  chownTree(dir, 0, 0);
  fs.chmodSync(dir, 0o700);
}

function envelopeModels(recordDir: string, envelopePath: string | null): string[] {
  if (envelopePath === null) return [];
  try {
    const e = JSON.parse(fs.readFileSync(path.join(recordDir, envelopePath), 'utf8')) as { modelUsage?: Record<string, unknown> };
    return Object.keys(e.modelUsage ?? {}).sort();
  } catch {
    return [];
  }
}

function tapOf(input: Input, cell: string): Record<string, unknown>[] {
  const f = path.join(input.mcp.logDir, `${cell}.tap.jsonl`);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [];
}

const INFRA = new Set(['infrastructure', 'envelope-unreadable', 'model-mismatch']);

interface SessionSpec { readonly id: string; readonly taskId: string; readonly runIndex: number; readonly redrawOf: string | null }

async function runSession(input: Input, install: SkeletonInstall, hub: McpHub, agent: StepAgent, ledger: LedgerRunner | null, spec: SessionSpec): Promise<'done' | 'infrastructure'> {
  const task = input.tasks.find((t) => t.id === spec.taskId);
  if (task === undefined) throw new Error(`unknown task ${spec.taskId}`);
  resetHome(input);
  const runId = `c/${spec.id}`;
  const cwd = openCell(input, install, spec.id, task.seedDir);
  hub.setCell(spec.id, 'step-01', task.specPath, cwd);
  const out = path.join(input.outRoot, 'sessions', spec.id);
  fs.mkdirSync(out, { recursive: true });
  copyTree(cwd, path.join(out, 'snap', 'step-00'));
  const typechecker = harnessTypechecker(new NodeProcessRunner(), input.harnessRoot);
  let last = path.join(out, 'snap', 'step-00');
  const steps: Record<string, unknown>[] = [];
  let verdict: 'done' | 'infrastructure' = 'done';
  for (const [i, request] of task.steps.entries()) {
    const turnId = `step-0${String(i + 1)}`;
    hub.setTurn(turnId);
    const recordDir = path.join(out, 'turns', turnId);
    fs.mkdirSync(recordDir, { recursive: true });
    const prompt = toolPrompt(request, typecheckCommand(input.harnessRoot, runId));
    fs.writeFileSync(path.join(recordDir, 'prompt.txt'), prompt);
    const lastDir = last;
    const turnInput: TurnInput = {
      runId, turnId, taskId: spec.id, kind: 'step', stepIndex: i, arm: 'daedalus-mcp', cwd, prompt, recordDir,
      changedFiles: () => {
        const now = filesOf(cwd);
        const before = new Set(filesOf(lastDir));
        return now.filter((f) => !before.has(f) || !fs.readFileSync(path.join(cwd, f)).equals(fs.readFileSync(path.join(lastDir, f)))).length + [...before].filter((f) => !now.includes(f)).length;
      },
      restore: () => {
        for (const e of fs.readdirSync(cwd)) if (e !== 'node_modules') fs.rmSync(path.join(cwd, e), { recursive: true, force: true });
        copyTree(lastDir, cwd);
        chownTree(cwd, input.genUid, input.genGid);
        return DomainResult.ok(undefined);
      },
      archive: (index) => {
        const to = path.join(out, 'interrupted', `${turnId}-${String(index)}`);
        copyTree(cwd, to);
        return DomainResult.ok(path.relative(input.outRoot, to));
      },
    };
    if (ledger !== null) {
      ledger.session = spec.id;
      ledger.turn = turnId;
    }
    const r: DomainResult<TurnResult> = await agent.runTurn(turnInput);
    const snap = path.join(out, 'snap', turnId);
    copyTree(cwd, snap);
    last = snap;
    const tc = await typechecker.typecheck(runId, cwd);
    const intact = checkSkeletonIntact(install, REPO, cwd);
    const calls = tapOf(input, spec.id).filter((l) => l.event === 'call' && l.turn === turnId);
    const record = {
      session: spec.id,
      step: turnId,
      promptSha256: sha256(prompt),
      status: r.success ? r.data.status : 'harness-error',
      errors: r.success ? undefined : r.errors,
      attempts: r.success ? r.data.attempts.length : null,
      wallMs: r.success ? r.data.wallMs : null,
      usage: r.success ? r.data.usage : null,
      permissionDenials: r.success ? r.data.permissionDenials : null,
      modelUsageIds: r.success ? envelopeModels(recordDir, r.data.envelopePath) : [],
      typecheck: tc.success ? tc.data : { error: tc.errors },
      skeletonIntact: intact.skeletonIntact,
      treeSha256: treeSha(snap),
      mcpCalls: calls.map((c) => ({ tool: c.tool, isError: c.isError, status: c.status, findings: c.findings })),
    };
    steps.push(record);
    fs.appendFileSync(path.join(input.outRoot, 'turns.jsonl'), `${JSON.stringify(record)}\n`);
    if (!r.success || INFRA.has(r.data.status)) {
      verdict = 'infrastructure';
      break;
    }
  }
  hub.clear();
  closeCell(input, spec.id);
  fs.writeFileSync(path.join(out, 'session.json'), `${JSON.stringify({ ...spec, verdict, steps }, null, 2)}\n`);
  return verdict;
}

/** Runs the relay as the generator user against the hub (zero model calls): tools/list and one check_consistency. */
async function relayCheck(input: Input, project: string, cell: string, spec: string, hub: McpHub, callArgs: Record<string, unknown>): Promise<{ tools: string[]; result: { isError: boolean; text: string; status: unknown } }> {
  hub.setCell(cell, 'relay-check', spec, project);
  const child = spawn('setpriv', [`--reuid=${String(input.genUid)}`, `--regid=${String(input.genGid)}`, '--clear-groups', input.mcp.nodeBinary, input.mcp.relay, input.mcp.socket], { stdio: ['pipe', 'pipe', 'inherit'], env: parentEnv(input), cwd: project });
  let buf = '';
  const waiting = new Map<number, (v: Record<string, unknown>) => void>();
  child.stdout.on('data', (c: Buffer) => {
    buf += c.toString('utf8');
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, nl)) as { id?: number };
      buf = buf.slice(nl + 1);
      if (m.id !== undefined) waiting.get(m.id)?.(m as Record<string, unknown>);
    }
  });
  let id = 0;
  const rpc = (method: string, params: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    id += 1;
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'relay-check', version: '0' } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const list = (await rpc('tools/list', {})) as { result: { tools: { name: string }[] } };
  const call = (await rpc('tools/call', { name: 'check_consistency', arguments: callArgs })) as { result: { isError?: boolean; content: { text: string }[]; structuredContent?: { status?: string } } };
  child.stdin.end();
  child.kill('SIGTERM');
  hub.clear();
  return { tools: list.result.tools.map((t) => t.name), result: { isError: call.result.isError === true, text: (call.result.content[0]?.text ?? '').slice(0, 160), status: call.result.structuredContent?.status ?? null } };
}

/** `--dry` (zero calls): the relay as the generator, then a stub agent through the whole session pipeline. */
async function dry(input: Input): Promise<number> {
  const install = await harness(input);
  const dryInput: Input = { ...input, outRoot: path.join(input.outRoot, 'dry'), mcp: { ...input.mcp, logDir: path.join(input.outRoot, 'dry', 'mcp') } };
  const hub = new McpHub(dryInput);
  await hub.start();
  const checks: Record<string, unknown>[] = [];
  for (const t of input.tasks) {
    resetHome(dryInput);
    const cwd = openCell(dryInput, install, `d-${t.id}`, t.seedDir);
    checks.push({ task: t.id, inside: await relayCheck(dryInput, cwd, `d-${t.id}`, t.specPath, hub, {}), outside: await relayCheck(dryInput, cwd, `d-${t.id}`, t.specPath, hub, { project: input.probe.outsideProject }) });
    closeCell(dryInput, `d-${t.id}`);
  }
  const stub: StepAgent = {
    adapterId: 'claude-code-cli',
    modelId: input.modelId,
    runTurn: (t) => {
      fs.appendFileSync(path.join(t.cwd, 'DRY.txt'), `${t.turnId}\n`);
      return Promise.resolve(DomainResult.ok({ status: 'completed', usage: {} as TurnResult['usage'], wallMs: 0, attempts: [], interruptions: [], argv: [], envelopePath: null, permissionDenials: 0 }));
    },
  };
  for (const t of input.tasks) checks.push({ task: t.id, session: await runSession(dryInput, install, hub, stub, null, { id: `d-${t.id}`, taskId: t.id, runIndex: 0, redrawOf: null }) });
  await hub.stop();
  const argv = toolArmArgs(cliConfig(input), 'c/c01', '<prompt>', input.mcp);
  const result = { schema: 'puzzle-02-tool-arm-dry/v1', calls: 0, argv, checks };
  fs.writeFileSync(path.join(dryInput.outRoot, 'dry-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

/** `--smoke` (1 call): one turn in a skeleton-only cell with the server attached (note §5). */
async function smoke(input: Input): Promise<number> {
  const install = await harness(input);
  const hub = new McpHub(input);
  await hub.start();
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'smoke', input.caps);
  const agent = agentOf(input, runner);
  const probed = await agent.probe();
  resetHome(input);
  const cwd = openCell(input, install, 'c00', null);
  const task = input.tasks[0] as TaskInput;
  hub.setCell('c00', 'smoke', task.specPath, cwd);
  const recordDir = path.join(input.outRoot, 'smoke');
  fs.mkdirSync(recordDir, { recursive: true });
  runner.session = 'smoke';
  runner.turn = 'smoke';
  const r = await agent.runTurn({ runId: 'c/c00', turnId: 'smoke', taskId: 'smoke', kind: 'step', stepIndex: 0, arm: 'daedalus-mcp', cwd, prompt: SMOKE_PROMPT, recordDir, changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none') });
  hub.clear();
  closeCell(input, 'c00');
  await hub.stop();
  const tap = tapOf(input, 'c00');
  const listed = tap.filter((l) => l.event === 'tools/list').flatMap((l) => l.tools as string[]);
  const calls = tap.filter((l) => l.event === 'call');
  const connects = tap.filter((l) => l.event === 'connect');
  const envelopeFile = path.join(recordDir, 'envelope-smoke.json');
  const envelope = fs.existsSync(envelopeFile) ? (JSON.parse(fs.readFileSync(envelopeFile, 'utf8')) as Record<string, unknown>) : null;
  const text = typeof envelope?.result === 'string' ? envelope.result : '';
  const result = {
    schema: 'puzzle-02-tool-arm-smoke/v1',
    cliVersion: probed.success ? probed.data.cliVersion : null,
    turn: r.success ? { status: r.data.status, attempts: r.data.attempts.length, permissionDenials: r.data.permissionDenials } : { errors: r.errors },
    modelUsageIds: Object.keys((envelope?.modelUsage as Record<string, unknown> | undefined) ?? {}),
    serverListed: listed.includes('check_consistency'),
    agentNamesTool: text.includes('check_consistency'),
    serverConfined: connects.length > 0 && connects.every((c) => c.confine === true),
    checkConsistencyCalls: calls.filter((c) => c.tool === 'check_consistency').map((c) => ({ isError: c.isError, status: c.status })),
    toolsListed: listed,
    calls: runner.counts(),
    passed: false,
  };
  result.passed = r.success && r.data.status === 'completed' && result.serverListed && result.agentNamesTool && result.serverConfined && result.checkConsistencyCalls.length > 0 && r.data.permissionDenials === 0;
  fs.writeFileSync(path.join(recordDir, 'smoke-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.passed ? 0 : 1;
}

/** `--probe` (1 call): a `project` argument outside the work tree must be refused (note §5). */
async function probe(input: Input): Promise<number> {
  const install = await harness(input);
  const hub = new McpHub(input);
  await hub.start();
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'probes', input.caps);
  const agent = agentOf(input, runner);
  resetHome(input);
  const cwd = openCell(input, install, 'c90', null);
  const task = input.tasks[0] as TaskInput;
  hub.setCell('c90', 'probe', task.specPath, cwd);
  const recordDir = path.join(input.outRoot, 'probe');
  fs.mkdirSync(recordDir, { recursive: true });
  const prompt = `${PROBE_PREAMBLE}\n\nCall the check_consistency tool exactly once, with the argument project set to ${input.probe.outsideProject} and no other argument. Then report whether the call was refused, and the first sentence of the reply it gave.`;
  fs.writeFileSync(path.join(recordDir, 'prompt.txt'), prompt);
  runner.session = 'probe';
  runner.turn = 'probe';
  const r = await agent.runTurn({ runId: 'c/c90', turnId: 'probe', taskId: 'probe', kind: 'step', stepIndex: 0, arm: 'daedalus-mcp', cwd, prompt, recordDir, changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none') });
  hub.clear();
  closeCell(input, 'c90');
  await hub.stop();
  const calls = tapOf(input, 'c90').filter((l) => l.event === 'call' && l.tool === 'check_consistency');
  const outside = calls.filter((c) => (c.arguments as { project?: string } | undefined)?.project !== undefined && !path.resolve(String((c.arguments as { project: string }).project)).startsWith(`${cwd}${path.sep}`) && path.resolve(String((c.arguments as { project: string }).project)) !== cwd);
  const frozenLog = path.join(input.mcp.logDir, 'c90.calls.jsonl');
  const frozen = fs.existsSync(frozenLog) ? fs.readFileSync(frozenLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { tool: string; error: string | null }) : [];
  const result = {
    schema: 'puzzle-02-tool-arm-probe/v1',
    turn: r.success ? { status: r.data.status, attempts: r.data.attempts.length, permissionDenials: r.data.permissionDenials } : { errors: r.errors },
    outsideProject: input.probe.outsideProject,
    callsWithOutsideProject: outside.length,
    allOutsideRefused: outside.every((c) => c.isError === true),
    frozenCallLog: frozen.map((f) => ({ tool: f.tool, refused: (f.error ?? '').startsWith('confined:') })),
    calls: runner.counts(),
    passed: false,
  };
  result.passed = r.success && outside.length > 0 && result.allOutsideRefused && frozen.length > 0 && frozen.filter((f) => f.tool === 'check_consistency').every((f) => (f.error ?? '').startsWith('confined:'));
  fs.writeFileSync(path.join(recordDir, 'probe-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.passed ? 0 : 1;
}

/** `--sessions`: every puzzle × run in the seeded order; whole-session redraws on infrastructure, at most one per puzzle. */
async function sessions(input: Input, resume = false): Promise<number> {
  const install = await harness(input);
  const hub = new McpHub(input);
  await hub.start();
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'sessions', input.caps);
  const agent = agentOf(input, runner);
  const probed = await agent.probe();
  if (!probed.success) throw new Error(probed.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  const cells = input.tasks.flatMap((t) => Array.from({ length: input.runs }, (_, r) => ({ taskId: t.id, runIndex: r })));
  const schedule = shuffled(cells, input.orderSeed).map((c, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, ...c, redrawOf: null as string | null }));
  const scheduleFile = path.join(input.outRoot, 'schedule.json');
  const redrawFile = path.join(input.outRoot, 'redraws.jsonl');
  const redrawsOf = (): { redrawn: string; as: string; taskId: string }[] => (fs.existsSync(redrawFile) ? fs.readFileSync(redrawFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { redrawn: string; as: string; taskId: string }) : []);
  let queue: SessionSpec[] = [...schedule];
  let next = schedule.length + 1;
  if (resume) {
    const saved = JSON.parse(fs.readFileSync(scheduleFile, 'utf8')) as { schedule: SessionSpec[] };
    if (JSON.stringify(saved.schedule) !== JSON.stringify(schedule)) throw new Error('resume: the saved schedule differs from the seeded one');
    for (const r of redrawsOf()) {
      const of = [...schedule, ...queue].find((s) => s.id === r.redrawn) as SessionSpec;
      queue.push({ id: r.as, taskId: of.taskId, runIndex: of.runIndex, redrawOf: r.redrawn });
      next = Math.max(next, Number(r.as.slice(1)) + 1);
    }
    queue = queue.filter((s) => !fs.existsSync(path.join(input.outRoot, 'sessions', s.id, 'session.json')));
    queue.sort((a, b) => (a.redrawOf === null ? 1 : 0) - (b.redrawOf === null ? 1 : 0));
    fs.appendFileSync(path.join(input.outRoot, 'resumes.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), queue: queue.map((s) => s.id) })}\n`);
  } else {
    fs.writeFileSync(scheduleFile, `${JSON.stringify({ orderSeed: input.orderSeed, cliVersion: probed.data.cliVersion, schedule }, null, 2)}\n`);
  }
  while (queue.length > 0) {
    const spec = queue.shift() as SessionSpec;
    process.stdout.write(`${new Date().toISOString()} session ${spec.id} start\n`);
    const v = await runSession(input, install, hub, agent, runner, spec);
    process.stdout.write(`${new Date().toISOString()} session ${spec.id} ${v} calls ${JSON.stringify(runner.counts())}\n`);
    if (v === 'infrastructure') {
      if (redrawsOf().filter((r) => r.taskId === spec.taskId).length >= input.redrawPerTask) {
        process.stdout.write(`redraw limit for ${spec.taskId} reached; session ${spec.id} stays as it is\n`);
        continue;
      }
      const id = `c${String(next++).padStart(2, '0')}`;
      queue.unshift({ id, taskId: spec.taskId, runIndex: spec.runIndex, redrawOf: spec.id });
      fs.appendFileSync(redrawFile, `${JSON.stringify({ redrawn: spec.id, as: id, taskId: spec.taskId, at: new Date().toISOString() })}\n`);
    }
  }
  await hub.stop();
  process.stdout.write(`${JSON.stringify({ calls: runner.counts(), redraws: redrawsOf().length }, null, 2)}\n`);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const input = load(argv);
  if (argv.includes('--dry')) return dry(input);
  if (argv.includes('--smoke')) return smoke(input);
  if (argv.includes('--probe')) return probe(input);
  if (argv.includes('--sessions')) return sessions(input, argv.includes('--resume'));
  process.stderr.write('usage: run-tool-arm.ts --dry | --smoke | --probe | --sessions [--resume] --input <input.json>\n');
  return 2;
}

if (process.argv[1]?.endsWith('run-tool-arm.ts') === true) {
  void main(process.argv.slice(2)).then(
    (c) => {
      process.exitCode = c;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exitCode = 2;
    },
  );
}
