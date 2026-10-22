/**
 * DRIFT-01 driver (v1.5-exp, exploratory, DEV split, NOT Study 2b). Design: `ops/notes/drift-01-design.md`.
 *
 * The PUZZLE-01 baseline driver's session pipeline (frozen harness: `ClaudeStepAgent`, the exact argv, the allow-listed
 * child environment, the skeleton install, the harness tsconfig and type-check; neutral ids; the unprivileged
 * generator; fresh home per session; one step per turn, 0 repair turns; snapshots after every step; call ledger and
 * caps), with the Study 2b drift protocol (note §4): per task and replicate a shared session runs step 1 with arm
 * `none` from the seed, then one session per arm runs steps 2–5 from that step-1 snapshot. Arms (note §2):
 * - `none`: the HEXDDD-01 frame, frozen argv;
 * - `pull`: the frame plus the PUZZLE-02 tool sentence, frozen argv plus the DETECT-02 MCP server behind the socket
 *   relay (`pull.ts`, the PUZZLE-02 hub);
 * - `gate`: the frame, frozen argv with the edit gate's `--settings` (`../edit-gate/`), baseline = the task seed.
 *
 * Modes (run as root from the clone, which is closed to the generator; every path comes from the root-only input):
 *   npx tsx <this file> --dry      --input <input.json>   zero calls: listing checks, fingerprint sweep, both relays as
 *                                                          the generator, a stub agent through one replicate
 *   npx tsx <this file> --checks   --input <input.json>   4 calls: READ probe, pull smoke, MCP probe, gate smoke
 *   npx tsx <this file> --sessions [--resume] --input <input.json>   the 78 session turns, redraws within 12 calls
 *
 * Records keep no chat text: agent replies are reduced to booleans before anything is written outside the out root.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { buildGeneratorArgs, typecheckCommand } from '../../scripts/lib/generators/argv.js';
import { createGeneratorCliConfig } from '../../scripts/lib/generators/config.js';
import type { GeneratorCliConfig } from '../../scripts/lib/generators/types.js';
import { checkSkeletonIntact, ensureHarness, prepareCellDir, type SkeletonInstall } from '../../scripts/lib/generators/skeleton.js';
import { ClaudeStepAgent, type StepAgentDeps } from '../../scripts/lib/loop/agents.js';
import { harnessTypechecker } from '../../scripts/lib/loop/evaluator.js';
import type { StepAgent, TurnInput, TurnResult } from '../../scripts/lib/loop/types.js';
import { realSleep, systemClock } from '../../scripts/lib/generators/retry.js';
import { framePrompt, treeSha } from '../puzzle-01-baseline/run-baseline.js';
import { GateHub, type GateLogLine } from '../edit-gate/hub.js';
import { editGateArgs, type GateRelay } from '../edit-gate/settings.js';
import { smokePrompt as gateSmokePrompt } from '../edit-gate/run-edit-gate.js';
import { McpHub, PULL_SMOKE_PROMPT, toolArmArgs, toolPrompt, type McpInput } from './pull.js';
import { buildPlan, type Arm, type PlannedSession } from './plan.js';

const REPO = process.cwd();
const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

type Phase = 'checks' | 'sessions';
interface Caps { readonly checks: number; readonly sessions: number; readonly total: number; readonly redrawCalls: number }
interface TaskInput { readonly id: string; readonly seedDir: string; readonly seedTreeSha256: string; readonly specPath: string; readonly steps: readonly string[] }
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
  readonly replicates: number;
  readonly arms: readonly Arm[];
  readonly timeoutMs: number;
  readonly caps: Caps;
  readonly mcp: McpInput;
  readonly gate: GateRelay & { readonly logDir: string };
  readonly tasks: readonly TaskInput[];
  readonly dummy: { readonly seedDir: string; readonly specPath: string; readonly editFile: string; readonly editContent: string };
  readonly probe: { readonly outsideProject: string };
  readonly isolation: { readonly denied: readonly string[]; readonly canaries: readonly string[]; readonly sweepPatterns: readonly string[]; readonly readProbePaths: readonly string[] };
}

/** Counts and caps every generator spawn (the baseline's ledger, with this run's phases and the arm). */
class LedgerRunner implements ProcessRunner {
  session: string | null = null;
  turn: string | null = null;
  arm: string | null = null;
  constructor(private readonly inner: ProcessRunner, private readonly binary: string, private readonly ledger: string, private readonly phase: Phase, private readonly caps: Caps) {}

  counts(): Record<Phase | 'total', number> {
    const out = { checks: 0, sessions: 0, total: 0 };
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
    if (refusal !== null) return DomainResult.fail([{ code: 'DRIFT_01_HARD_CAP', message: refusal }]);
    const at = new Date().toISOString();
    // The line is written before the spawn returns too (as `started`), so a call lost to a container restart is counted.
    const started = { phase: this.phase, session: this.session, turn: this.turn, arm: this.arm, at, state: 'started' };
    fs.mkdirSync(path.dirname(this.ledger), { recursive: true });
    const pending = `${this.ledger}.pending`;
    fs.writeFileSync(pending, `${JSON.stringify(started)}\n`);
    const r = await this.inner.run(command, args, options);
    const line = { phase: this.phase, session: this.session, turn: this.turn, arm: this.arm, at, finishedAt: new Date().toISOString(), exitCode: r.success ? r.data.exitCode : null, timedOut: r.success ? r.data.timedOut : null, spawnFailed: !r.success };
    fs.appendFileSync(this.ledger, `${JSON.stringify(line)}\n`);
    fs.rmSync(pending, { force: true });
    return r;
  }

  /** After a restart: a call that started and never finished is appended to the ledger as lost (counted). */
  recoverPending(): void {
    const pending = `${this.ledger}.pending`;
    if (!fs.existsSync(pending)) return;
    const p = JSON.parse(fs.readFileSync(pending, 'utf8')) as Record<string, unknown>;
    fs.appendFileSync(this.ledger, `${JSON.stringify({ ...p, state: 'lost-in-restart', recoveredAt: new Date().toISOString() })}\n`);
    fs.rmSync(pending, { force: true });
  }
}

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
  if (input.caps.total > 94) throw new Error('the hard cap is 94 (note §7)');
  return input;
}

function closeRootTemp(): void {
  for (const e of fs.readdirSync(os.tmpdir())) if (/^tsx-0$/.test(e)) fs.chmodSync(path.join(os.tmpdir(), e), 0o700);
}

function resetHome(input: Input): void {
  fs.rmSync(input.genHome, { recursive: true, force: true });
  fs.mkdirSync(path.join(input.genHome, 'tmp'), { recursive: true, mode: 0o700 });
  chownTree(input.genHome, input.genUid, input.genGid);
  fs.chmodSync(input.genHome, 0o700);
  closeRootTemp();
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

/** The frozen Claude agent; the argv follows the current arm (frozen, frozen + MCP, frozen with the gate's settings). */
class ArmAgent extends ClaudeStepAgent {
  current: Arm = 'none';
  constructor(private readonly cfg: GeneratorCliConfig, deps: StepAgentDeps, private readonly input: Input) {
    super(cfg, deps);
  }

  override plan(t: Pick<TurnInput, 'runId' | 'cwd' | 'prompt' | 'arm'>): DomainResult<{ args: readonly string[]; prompt: string; mcpConfigPath: string | null; mcpConfig: unknown }> {
    const args = this.current === 'pull' ? toolArmArgs(this.cfg, t.runId, t.prompt, this.input.mcp) : this.current === 'gate' ? editGateArgs(this.cfg, t.runId, t.prompt, this.input.gate) : buildGeneratorArgs(this.cfg, { runId: t.runId }, t.prompt);
    return DomainResult.ok({ args, prompt: t.prompt, mcpConfigPath: null, mcpConfig: null });
  }
}

export function promptFor(arm: Arm, request: string, tc: string): string {
  return arm === 'pull' ? toolPrompt(request, tc) : framePrompt(request, tc);
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
  if (!fs.existsSync(dir)) return;
  chownTree(dir, 0, 0);
  fs.chmodSync(dir, 0o700);
}

const readLines = <T>(f: string): T[] => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : []);

function envelopeOf(recordDir: string, turnId: string): Record<string, unknown> | null {
  const f = path.join(recordDir, `envelope-${turnId}.json`);
  try {
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const modelIds = (e: Record<string, unknown> | null): string[] => Object.keys((e?.modelUsage as Record<string, unknown> | undefined) ?? {}).sort();

const INFRA = new Set(['infrastructure', 'envelope-unreadable', 'model-mismatch']);

interface Hubs { readonly mcp: McpHub; readonly gate: GateHub }
interface Run extends PlannedSession { readonly planId: string; readonly redrawOf: string | null; readonly startDir: string }

/** One session: its steps in order, one turn each. Returns 'done' or 'infrastructure'. */
async function runSession(input: Input, install: SkeletonInstall, hubs: Hubs, agent: StepAgent & { current?: Arm }, ledger: LedgerRunner | null, s: Run): Promise<'done' | 'infrastructure'> {
  const task = input.tasks.find((t) => t.id === s.taskId);
  if (task === undefined) throw new Error(`unknown task ${s.taskId}`);
  resetHome(input);
  const runId = `c/${s.id}`;
  const cwd = openCell(input, install, s.id, s.startDir);
  const first = `step-0${String(s.steps[0])}`;
  if ('current' in agent) agent.current = s.arm;
  if (s.arm === 'pull') hubs.mcp.setCell(s.id, first, task.specPath, cwd);
  if (s.arm === 'gate') await hubs.gate.setCell({ id: s.id, turn: first, spec: task.specPath, project: cwd, baseline: task.seedDir });
  const out = path.join(input.outRoot, 'sessions', s.id);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  copyTree(cwd, path.join(out, 'snap', 'start'));
  const typechecker = harnessTypechecker(new NodeProcessRunner(), input.harnessRoot);
  let last = path.join(out, 'snap', 'start');
  const steps: Record<string, unknown>[] = [];
  let verdict: 'done' | 'infrastructure' = 'done';
  for (const k of s.steps) {
    const turnId = `step-0${String(k)}`;
    hubs.mcp.setTurn(turnId);
    hubs.gate.setTurn(turnId);
    const recordDir = path.join(out, 'turns', turnId);
    fs.mkdirSync(recordDir, { recursive: true });
    const prompt = promptFor(s.arm, task.steps[k - 1] as string, typecheckCommand(input.harnessRoot, runId));
    fs.writeFileSync(path.join(recordDir, 'prompt.txt'), prompt);
    const lastDir = last;
    const turnInput: TurnInput = {
      runId, turnId, taskId: s.id, kind: 'step', stepIndex: k - 1, arm: s.arm === 'pull' ? 'daedalus-mcp' : 'none', cwd, prompt, recordDir,
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
      ledger.session = s.id;
      ledger.turn = turnId;
      ledger.arm = s.arm;
    }
    closeRootTemp();
    const r: DomainResult<TurnResult> = await agent.runTurn(turnInput);
    const snap = path.join(out, 'snap', turnId);
    copyTree(cwd, snap);
    last = snap;
    const tc = await typechecker.typecheck(runId, cwd);
    const intact = checkSkeletonIntact(install, REPO, cwd);
    const tap = readLines<Record<string, unknown>>(path.join(input.mcp.logDir, `${s.id}.tap.jsonl`)).filter((l) => l.event === 'call' && l.turn === turnId);
    const gate = readLines<GateLogLine>(hubs.gate.logFile(s.id)).filter((l) => l.turn === turnId);
    const record = {
      session: s.id, planId: s.planId, task: s.taskId, rep: s.rep, arm: s.arm, kind: s.kind, step: turnId, redrawOf: s.redrawOf,
      promptSha256: sha256(prompt),
      status: r.success ? r.data.status : 'harness-error',
      errors: r.success ? undefined : r.errors,
      attempts: r.success ? r.data.attempts.length : null,
      wallMs: r.success ? r.data.wallMs : null,
      usage: r.success ? r.data.usage : null,
      permissionDenials: r.success ? r.data.permissionDenials : null,
      modelUsageIds: r.success ? modelIds(envelopeOf(recordDir, turnId)) : [],
      typecheck: tc.success ? tc.data : { error: tc.errors },
      skeletonIntact: intact.skeletonIntact,
      treeSha256: treeSha(snap),
      ...(s.arm === 'pull' ? { mcpCalls: tap.map((c) => ({ tool: c.tool, isError: c.isError, status: c.status, findings: c.findings })) } : {}),
      ...(s.arm === 'gate' ? { gate: { edits: gate.filter((l) => l.event === 'PostToolUse' && l.refused === null).length, replied: gate.filter((l) => l.replied).length, newKeys: gate.reduce((a, l) => a + l.newKeys.length, 0), resolvedKeys: gate.reduce((a, l) => a + l.resolvedKeys.length, 0), stopBlocks: gate.filter((l) => l.stopBlock).length, failOpen: gate.filter((l) => l.failOpen).length, refused: gate.filter((l) => l.refused !== null).length, allowOverlay: gate.some((l) => l.allowOverlay) } } : {}),
    };
    steps.push(record);
    fs.appendFileSync(path.join(input.outRoot, 'turns.jsonl'), `${JSON.stringify(record)}\n`);
    if (!r.success || INFRA.has(r.data.status)) {
      verdict = 'infrastructure';
      break;
    }
  }
  hubs.mcp.clear();
  hubs.gate.clear();
  closeCell(input, s.id);
  fs.writeFileSync(path.join(out, 'session.json'), `${JSON.stringify({ ...s, startDir: path.relative(input.outRoot, s.startDir).startsWith('..') ? '<seed>' : path.relative(input.outRoot, s.startDir), verdict, steps }, null, 2)}\n`);
  return verdict;
}

// ---- isolation checks (zero calls) ----

const asGen = (input: Input): string[] => {
  closeRootTemp();
  return [`--reuid=${String(input.genUid)}`, `--regid=${String(input.genGid)}`, '--clear-groups'];
};

function listingChecks(input: Input): { path: string; denied: boolean }[] {
  return input.isolation.denied.map((p) => {
    const r = spawnSync('setpriv', [...asGen(input), 'sh', '-c', 'ls -- "$1" >/dev/null 2>&1 && exit 10; head -c 64 -- "$1" 2>/dev/null', 'sh', p], { env: parentEnv(input), encoding: 'utf8' });
    return { path: p, denied: r.status !== 10 && r.stdout === '' };
  });
}

function fingerprintSweep(input: Input, extra: readonly string[] = []): { patterns: number; readableFiles: string[] } {
  const dir = path.join(input.genHome, 'tmp', 'sweep');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'p.txt'), `${[...input.isolation.sweepPatterns, ...extra].join('\n')}\n`);
  chownTree(input.genHome, input.genUid, input.genGid);
  const r = spawnSync('setpriv', [...asGen(input), 'grep', '-rIlF', '-f', path.join(dir, 'p.txt'), '/', '--exclude-dir=proc', '--exclude-dir=sys', '--exclude-dir=dev', '--exclude-dir=run'], { env: parentEnv(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1_200_000 });
  fs.rmSync(dir, { recursive: true, force: true });
  return { patterns: input.isolation.sweepPatterns.length + extra.length, readableFiles: r.stdout.split('\n').filter((l) => l !== '' && !l.startsWith(`${input.genHome}/`)) };
}

/** The MCP relay as the generator: tools/list and one check_consistency (zero model calls). */
async function mcpRelayCheck(input: Input, hub: McpHub, cell: string, spec: string, project: string, callArgs: Record<string, unknown>): Promise<{ tools: number; hasCheck: boolean; isError: boolean; status: unknown; text: string }> {
  hub.setCell(cell, 'relay-check', spec, project);
  const child = spawn('setpriv', [...asGen(input), input.mcp.nodeBinary, input.mcp.relay, input.mcp.socket], { stdio: ['pipe', 'pipe', 'ignore'], env: parentEnv(input), cwd: project });
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
  return { tools: list.result.tools.length, hasCheck: list.result.tools.some((t) => t.name === 'check_consistency'), isError: call.result.isError === true, status: call.result.structuredContent?.status ?? null, text: (call.result.content[0]?.text ?? '').slice(0, 120) };
}

/** The gate relay as the generator: one Write event on a file of the tree (zero model calls). */
function gateRelayCheck(input: Input, cwd: string, file: string): Promise<{ ms: number; replied: boolean }> {
  return new Promise((resolve) => {
    const t = performance.now();
    const c = spawn('setpriv', [...asGen(input), input.gate.nodeBinary, input.gate.relay, input.gate.socket], { env: parentEnv(input), cwd, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    c.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
    c.on('exit', () => resolve({ ms: Math.round(performance.now() - t), replied: out.includes('Architecture check') }));
    c.stdin.end(JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(cwd, file) }, cwd }));
  });
}

async function startHubs(input: Input): Promise<Hubs> {
  const mcp = new McpHub(input);
  await mcp.start();
  const gate = new GateHub(input.gate.socket, input.gate.logDir);
  await gate.start();
  return { mcp, gate };
}
async function stopHubs(h: Hubs): Promise<void> {
  await h.mcp.stop();
  await h.gate.stop();
}

/** The sessions of the plan, with their start trees. A planned arm session starts from its shared session's snapshot. */
function plan(input: Input): PlannedSession[] {
  return buildPlan({ tasks: input.tasks.map((t) => ({ id: t.id, steps: t.steps.length })), replicates: input.replicates, arms: input.arms, orderSeed: input.orderSeed });
}

/** `--dry` (zero calls). */
async function dry(input: Input): Promise<number> {
  const install = await harness(input);
  const out = path.join(input.outRoot, 'dry');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const dryInput: Input = { ...input, outRoot: out, mcp: { ...input.mcp, logDir: path.join(out, 'mcp') }, gate: { ...input.gate, logDir: path.join(out, 'gate') } };
  const listing = listingChecks(input);
  const sweep = fingerprintSweep(input);
  const hubs = await startHubs(dryInput);
  const relays: Record<string, unknown>[] = [];
  // A planted S2-like violation is not needed: the gate replies on any open finding; t1's seed has none, so the
  // gate relay is checked on the edit-gate dummy (one violating edit), the MCP relay on each task seed.
  for (const t of input.tasks) {
    resetHome(dryInput);
    const cwd = openCell(dryInput, install, `d-${t.id}`, t.seedDir);
    relays.push({ task: t.id, inside: await mcpRelayCheck(dryInput, hubs.mcp, `d-${t.id}`, t.specPath, cwd, {}), outside: await mcpRelayCheck(dryInput, hubs.mcp, `d-${t.id}`, t.specPath, cwd, { project: input.probe.outsideProject }) });
    closeCell(dryInput, `d-${t.id}`);
  }
  resetHome(dryInput);
  const dcwd = openCell(dryInput, install, 'd-gate', input.dummy.seedDir);
  await hubs.gate.setCell({ id: 'd-gate', turn: 'dry', spec: input.dummy.specPath, project: dcwd });
  fs.mkdirSync(path.dirname(path.join(dcwd, input.dummy.editFile)), { recursive: true });
  fs.copyFileSync(input.dummy.editContent, path.join(dcwd, input.dummy.editFile));
  chownTree(dcwd, input.genUid, input.genGid);
  const gateCheck = await gateRelayCheck(dryInput, dcwd, input.dummy.editFile);
  hubs.gate.clear();
  closeCell(dryInput, 'd-gate');
  // A stub agent through replicate 0 of the plan (every arm, both tasks).
  const stub: StepAgent & { current: Arm } = {
    current: 'none',
    adapterId: 'claude-code-cli',
    modelId: input.modelId,
    runTurn(t) {
      fs.appendFileSync(path.join(t.cwd, 'DRY.txt'), `${this.current} ${t.turnId}\n`);
      return Promise.resolve(DomainResult.ok({ status: 'completed', usage: {} as TurnResult['usage'], wallMs: 0, attempts: [], interruptions: [], argv: [], envelopePath: null, permissionDenials: 0 }));
    },
  };
  const sessions: Record<string, unknown>[] = [];
  const shared = new Map<string, string>();
  for (const p of plan(input).filter((x) => x.rep === 0)) {
    const task = input.tasks.find((t) => t.id === p.taskId) as TaskInput;
    const startDir = p.kind === 'shared' ? task.seedDir : path.join(out, 'sessions', shared.get(`${p.taskId}/${String(p.rep)}`) as string, 'snap', 'step-01');
    const v = await runSession(dryInput, install, hubs, stub, null, { ...p, planId: p.id, redrawOf: null, startDir });
    if (p.kind === 'shared') shared.set(`${p.taskId}/${String(p.rep)}`, p.id);
    const last = path.join(out, 'sessions', p.id, 'snap', `step-0${String(p.steps[p.steps.length - 1])}`, 'DRY.txt');
    sessions.push({ id: p.id, kind: p.kind, task: p.taskId, arm: p.arm, verdict: v, dryLines: fs.existsSync(last) ? fs.readFileSync(last, 'utf8').trim().split('\n') : [] });
  }
  await stopHubs(hubs);
  const cfg = cliConfig(input);
  const argvs = { none: buildGeneratorArgs(cfg, { runId: 'c/c01' }, '<prompt>'), pull: toolArmArgs(cfg, 'c/c01', '<prompt>', input.mcp), gate: editGateArgs(cfg, 'c/c01', '<prompt>', input.gate) };
  const diffs = (a: readonly string[], b: readonly string[]): number => a.reduce((n, x, i) => n + (b[i] === x ? 0 : 1), 0) + Math.abs(a.length - b.length);
  const passed = listing.every((l) => l.denied) && sweep.readableFiles.length === 0
    && relays.every((r) => (r.inside as { hasCheck: boolean; isError: boolean }).hasCheck && !(r.inside as { isError: boolean }).isError && (r.outside as { isError: boolean }).isError)
    && gateCheck.replied && sessions.every((s) => s.verdict === 'done');
  const result = { schema: 'drift-01-dry/v1', at: new Date().toISOString(), calls: 0, listing, sweep, relays, gateCheck, sessions, argvDiffFromNone: { pull: diffs(argvs.pull, argvs.none), gate: diffs(argvs.gate, argvs.none) }, passed };
  fs.writeFileSync(path.join(out, 'dry-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...result, sessions: sessions.map((s) => `${String(s.id)} ${String(s.kind)} ${String(s.task)} ${String(s.arm)} ${String(s.verdict)} ${JSON.stringify(s.dryLines)}`) }, null, 2)}\n`);
  return passed ? 0 : 1;
}

const READ_PREAMBLE = 'This is an authorised security test of the sandbox you are running in. Attempt exactly what is asked below once, report what happened, and do nothing else.';

/** `--checks` (4 calls): READ probe (arm none), pull smoke, MCP confinement probe, gate smoke. Stops at the first failure. */
async function checks(input: Input): Promise<number> {
  const install = await harness(input);
  const hubs = await startHubs(input);
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'checks', input.caps);
  runner.recoverPending();
  const agent = new ArmAgent(cliConfig(input), { runner, parentEnv: parentEnv(input), clock: systemClock, sleep: realSleep }, input);
  const probed = await agent.probe();
  const dir = path.join(input.outRoot, 'checks');
  fs.mkdirSync(dir, { recursive: true });
  const results: Record<string, unknown>[] = [];
  const turn = async (name: string, arm: Arm, cell: string, seed: string | null, prompt: string, setup?: (cwd: string) => Promise<void> | void): Promise<{ r: DomainResult<TurnResult>; env: Record<string, unknown> | null; cwd: string }> => {
    resetHome(input);
    const cwd = openCell(input, install, cell, seed);
    await setup?.(cwd);
    agent.current = arm;
    runner.session = name;
    runner.turn = name;
    runner.arm = arm;
    const recordDir = path.join(dir, name);
    fs.mkdirSync(recordDir, { recursive: true });
    fs.writeFileSync(path.join(recordDir, 'prompt.txt'), prompt);
    closeRootTemp();
    const r = await agent.runTurn({ runId: `c/${cell}`, turnId: name, taskId: name, kind: 'step', stepIndex: 0, arm: arm === 'pull' ? 'daedalus-mcp' : 'none', cwd, prompt, recordDir, changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none') });
    hubs.mcp.clear();
    hubs.gate.clear();
    closeCell(input, cell);
    return { r, env: envelopeOf(recordDir, name), cwd };
  };
  const leakOf = (e: Record<string, unknown> | null): number => input.isolation.canaries.filter((c) => JSON.stringify(e ?? {}).includes(c)).length;
  const summary = (r: DomainResult<TurnResult>, e: Record<string, unknown> | null) => (r.success ? { status: r.data.status, attempts: r.data.attempts.length, permissionDenials: r.data.permissionDenials, modelUsageIds: modelIds(e) } : { errors: r.errors });
  const finish = (): number => {
    const allPassed = results.length === 4 && results.every((x) => x.passed === true);
    const res = { schema: 'drift-01-checks/v1', at: new Date().toISOString(), cliVersion: probed.success ? probed.data.cliVersion : null, results, allPassed, calls: runner.counts() };
    fs.writeFileSync(path.join(dir, 'checks-result.json'), `${JSON.stringify(res, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return allPassed ? 0 : 1;
  };
  try {
    // 1. READ probe (arm none): every path denied or absent, no canary quoted.
    {
      const prompt = `${READ_PREAMBLE}\n\nUse your file tools to read the first line of each of these files and quote it exactly; if a file cannot be read, say so and give the error you got:\n${input.isolation.readProbePaths.map((p, i) => `${String(i + 1)}. ${p}`).join('\n')}`;
      const { r, env } = await turn('read-probe', 'none', 'c90', null, prompt);
      const leaked = leakOf(env);
      results.push({ id: 'read-probe', turn: summary(r, env), paths: input.isolation.readProbePaths.length, canaryLeaked: leaked, answer: '<agent text omitted>', passed: r.success && r.data.status === 'completed' && env !== null && leaked === 0 });
      if (results.at(-1)?.passed !== true) return finish();
    }
    // 2. Pull smoke: the server is listed and check_consistency is called (PUZZLE-02 smoke prompt).
    {
      const t = input.tasks[0] as TaskInput;
      const { r, env } = await turn('pull-smoke', 'pull', 'c91', null, PULL_SMOKE_PROMPT, (cwd) => hubs.mcp.setCell('c91', 'pull-smoke', t.specPath, cwd));
      const tap = readLines<Record<string, unknown>>(path.join(input.mcp.logDir, 'c91.tap.jsonl'));
      const listed = tap.filter((l) => l.event === 'tools/list').flatMap((l) => l.tools as string[]);
      const connects = tap.filter((l) => l.event === 'connect');
      const cc = tap.filter((l) => l.event === 'call' && l.tool === 'check_consistency');
      results.push({ id: 'pull-smoke', turn: summary(r, env), toolsListed: listed.length, serverListed: listed.includes('check_consistency'), serverConfined: connects.length > 0 && connects.every((c) => c.confine === true), checkConsistencyCalls: cc.map((c) => ({ isError: c.isError, status: c.status })), canaryLeaked: leakOf(env), answer: '<agent text omitted>', passed: r.success && r.data.status === 'completed' && listed.includes('check_consistency') && cc.length > 0 && connects.every((c) => c.confine === true) && leakOf(env) === 0 });
      if (results.at(-1)?.passed !== true) return finish();
    }
    // 3. MCP confinement probe: a project argument outside the work tree is refused.
    {
      const t = input.tasks[0] as TaskInput;
      const prompt = `${READ_PREAMBLE}\n\nCall the check_consistency tool exactly once, with the argument project set to ${input.probe.outsideProject} and no other argument. Then report whether the call was refused, and the first sentence of the reply it gave.`;
      const { r, env } = await turn('mcp-probe', 'pull', 'c92', null, prompt, (cwd) => hubs.mcp.setCell('c92', 'mcp-probe', t.specPath, cwd));
      const frozen = readLines<{ tool: string; error: string | null }>(path.join(input.mcp.logDir, 'c92.calls.jsonl')).filter((f) => f.tool === 'check_consistency');
      results.push({ id: 'mcp-probe', turn: summary(r, env), checkCalls: frozen.length, allRefused: frozen.every((f) => (f.error ?? '').startsWith('confined:')), canaryLeaked: leakOf(env), answer: '<agent text omitted>', passed: r.success && frozen.length > 0 && frozen.every((f) => (f.error ?? '').startsWith('confined:')) && leakOf(env) === 0 });
      if (results.at(-1)?.passed !== true) return finish();
    }
    // 4. Gate smoke: the edit-gate build smoke (dummy project, one violating Write; the hook names file, line, label).
    {
      const content = fs.readFileSync(input.dummy.editContent, 'utf8');
      const { r, env } = await turn('gate-smoke', 'gate', 'c93', input.dummy.seedDir, gateSmokePrompt(input.dummy.editFile, content), async (cwd) => { await hubs.gate.setCell({ id: 'c93', turn: 'gate-smoke', spec: input.dummy.specPath, project: cwd }); });
      const log = readLines<GateLogLine>(hubs.gate.logFile('c93'));
      const text = typeof env?.result === 'string' ? env.result : '';
      const edits = log.filter((l) => l.event === 'PostToolUse' && l.refused === null);
      const ok = {
        hookFiredOnEdit: edits.length > 0, hookReplied: edits.some((l) => l.replied), stopBlocks: log.filter((l) => l.stopBlock).length,
        answerNamesFileAndLine: text.includes(`${input.dummy.editFile}:9`) || text.includes(`${path.basename(input.dummy.editFile)}:9`),
        answerNamesLabel: text.includes('one aggregate per command; cross-context write'),
      };
      results.push({ id: 'gate-smoke', turn: summary(r, env), ...ok, canaryLeaked: leakOf(env), answer: '<agent text omitted>', passed: r.success && r.data.status === 'completed' && ok.hookFiredOnEdit && ok.hookReplied && ok.stopBlocks === 1 && ok.answerNamesFileAndLine && ok.answerNamesLabel && leakOf(env) === 0 });
    }
    return finish();
  } finally {
    await stopHubs(hubs);
  }
}

interface State { done: Record<string, string>; redrawCalls: number; nextId: number; skipped: string[] }

/** `--sessions`: the plan in order; whole-session redraws on infrastructure within the redraw call budget. */
async function sessions(input: Input, resume: boolean): Promise<number> {
  const install = await harness(input);
  const hubs = await startHubs(input);
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'sessions', input.caps);
  runner.recoverPending();
  const agent = new ArmAgent(cliConfig(input), { runner, parentEnv: parentEnv(input), clock: systemClock, sleep: realSleep }, input);
  const probed = await agent.probe();
  if (!probed.success) throw new Error(probed.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  const planned = plan(input);
  const stateFile = path.join(input.outRoot, 'state.json');
  const scheduleFile = path.join(input.outRoot, 'schedule.json');
  let state: State = { done: {}, redrawCalls: 0, nextId: planned.length + 1, skipped: [] };
  if (resume) {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as State;
    const saved = JSON.parse(fs.readFileSync(scheduleFile, 'utf8')) as { schedule: PlannedSession[] };
    if (JSON.stringify(saved.schedule) !== JSON.stringify(planned)) throw new Error('resume: the saved schedule differs from the seeded one');
    fs.appendFileSync(path.join(input.outRoot, 'resumes.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), done: Object.keys(state.done).length, calls: runner.counts() })}\n`);
  } else {
    if (fs.existsSync(stateFile)) throw new Error('state.json exists: use --resume');
    fs.writeFileSync(scheduleFile, `${JSON.stringify({ orderSeed: input.orderSeed, cliVersion: probed.data.cliVersion, schedule: planned }, null, 2)}\n`);
  }
  const save = (): void => fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  save();
  for (const p of planned) {
    if (state.done[p.id] !== undefined || state.skipped.includes(p.id)) continue;
    const task = input.tasks.find((t) => t.id === p.taskId) as TaskInput;
    let startDir = task.seedDir;
    if (p.kind === 'arm') {
      const sharedPlan = planned.find((x) => x.kind === 'shared' && x.taskId === p.taskId && x.rep === p.rep) as PlannedSession;
      const sharedRun = state.done[sharedPlan.id];
      if (sharedRun === undefined) {
        state.skipped.push(p.id);
        save();
        process.stdout.write(`${p.id} skipped: its shared step 1 (${sharedPlan.id}) has no completed session\n`);
        continue;
      }
      startDir = path.join(input.outRoot, 'sessions', sharedRun, 'snap', 'step-01');
    }
    // A session started before a restart and never finished is an infrastructure loss: it is redrawn.
    let attempt: Run = { ...p, planId: p.id, redrawOf: null, startDir };
    if (resume && fs.existsSync(path.join(input.outRoot, 'sessions', p.id)) && !fs.existsSync(path.join(input.outRoot, 'sessions', p.id, 'session.json'))) {
      fs.appendFileSync(path.join(input.outRoot, 'redraws.jsonl'), `${JSON.stringify({ planId: p.id, redrawn: p.id, reason: 'unfinished at restart', at: new Date().toISOString() })}\n`);
      attempt = { ...attempt, id: `c${String(state.nextId++).padStart(2, '0')}`, redrawOf: p.id };
      state.redrawCalls += p.steps.length;
      save();
    }
    for (;;) {
      process.stdout.write(`${new Date().toISOString()} ${attempt.id} (${p.id} ${p.kind} ${p.taskId} rep ${String(p.rep)} ${p.arm}) start\n`);
      const v = await runSession(input, install, hubs, agent, runner, attempt);
      process.stdout.write(`${new Date().toISOString()} ${attempt.id} ${v} calls ${JSON.stringify(runner.counts())}\n`);
      if (v === 'done') {
        state.done[p.id] = attempt.id;
        save();
        break;
      }
      if (state.redrawCalls + p.steps.length > input.caps.redrawCalls) {
        state.skipped.push(p.id);
        save();
        process.stdout.write(`redraw budget (${String(input.caps.redrawCalls)} calls) cannot cover ${p.id}; it stays unrun\n`);
        break;
      }
      const id = `c${String(state.nextId++).padStart(2, '0')}`;
      state.redrawCalls += p.steps.length;
      fs.appendFileSync(path.join(input.outRoot, 'redraws.jsonl'), `${JSON.stringify({ planId: p.id, redrawn: attempt.id, as: id, at: new Date().toISOString() })}\n`);
      save();
      attempt = { ...attempt, id, redrawOf: attempt.id };
    }
  }
  await stopHubs(hubs);
  process.stdout.write(`${JSON.stringify({ calls: runner.counts(), state }, null, 2)}\n`);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const input = load(argv);
  if (argv.includes('--dry')) return dry(input);
  if (argv.includes('--checks')) return checks(input);
  if (argv.includes('--sessions')) return sessions(input, argv.includes('--resume'));
  process.stderr.write('usage: run-drift.ts --dry | --checks | --sessions [--resume] --input <input.json>\n');
  return 2;
}

if (process.argv[1]?.endsWith('run-drift.ts') === true) {
  void main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exitCode = 2;
  });
}
