/**
 * v1.5 final study driver: arms `none` vs `combined` on the 25 study tasks. Design:
 * `ops/notes/v15-combined-delivery-design-2026-10-26.md` (§1 channels, §3 arms, §4 logs, §5 failure modes, §6 scripted
 * S4, §7 steps 5–10). Input: `make-input.ts`. Sandbox: `setup-sandbox.sh`. Scorer: `score-study.ts`.
 *
 * The DRIFT-01 session pipeline (frozen harness: `ClaudeStepAgent`, the exact argv, the allow-listed child
 * environment, the skeleton install, the harness tsconfig and type-check; neutral ids; the unprivileged generator;
 * fresh home per session; one step per turn, 0 repair turns; snapshots after every step; call ledger and hard caps),
 * with the study's plan (`lib/plan.ts`): one session per task × arm × replicate cell, all of the task's steps in order
 * from the fixed seed. Arms (`lib/arms.ts`):
 * - `none`: the baseline frame and the frozen argv, byte-identical to TRAPRATE-01 / PUZZLE-01;
 * - `combined`: the frame plus `frame-combined.txt` (frozen by hash), the frozen argv with the edit gate's
 *   `--settings` (hooks on) and the pull channel's MCP config. One `DeliveryHub` per session serves both sockets
 *   (one ledger; finding numbers shared across push and pull; layers FF-S01–S03 on, as PUZZLE-04).
 * Guards (`lib/guards.ts`): `claude --version` before every turn (a change is a stop of the run); the integrity monitor
 * per `combined` session (edits with a hook event ≥ 95 %, fail-open ≤ 5 %, hub alive; else infrastructure, redrawn);
 * hub p95 over 5 s is a mechanism stop. Redraws are whole sessions, on infrastructure only, inside the sessions cap.
 *
 * Modes (run as root from the clone, which is closed to the generator; every path comes from the root-only input):
 *   --dry        --input <f>   zero calls: listing + sweep with positive control as the generator, both relays as the
 *                              generator, the scripted S4 checks (§6), a stub agent through every arm on the input's two
 *                              dry tasks plus a hub-killed session, the version-mismatch stop, and the scorer end to end
 *   --local-dry  --input <f>   the same as the current user (no uid switch, no listing or sweep, no real CLI)
 *   --s4         --input <f> --evidence <dir>   the scripted S4 checks only (zero calls), written to <dir>
 *   --smoke      --input <f>   2 calls: one per arm (combined on the edit-gate dummy: push, pull, Stop)
 *   --probes     --input <f>   1 call: the READ probe (arm none)
 *   --sessions [--resume] --input <f>   the plan, inside the sessions cap
 *
 * Records keep no chat text: agent replies are reduced to booleans before anything is written outside the out root.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { typecheckCommand } from '../../scripts/lib/generators/argv.js';
import { createGeneratorCliConfig } from '../../scripts/lib/generators/config.js';
import type { GeneratorCliConfig } from '../../scripts/lib/generators/types.js';
import { checkSkeletonIntact, ensureHarness, prepareCellDir, type SkeletonInstall } from '../../scripts/lib/generators/skeleton.js';
import { ClaudeStepAgent, type StepAgentDeps } from '../../scripts/lib/loop/agents.js';
import { harnessTypechecker } from '../../scripts/lib/loop/evaluator.js';
import type { StepAgent, TurnInput, TurnResult } from '../../scripts/lib/loop/types.js';
import { realSleep, systemClock } from '../../scripts/lib/generators/retry.js';
import { DeliveryHub } from '../../src/v15-instrument/delivery/hub.js';
import { checkConsistency } from '../../src/v15-instrument/consistency.js';
import { SMOKE_PROMPT, treeSha } from '../puzzle-01-baseline/run-baseline.js';
import { smokePrompt as gateSmokePrompt } from '../edit-gate/run-edit-gate.js';
import { messageText, startFakeApi, type Block } from '../edit-gate/test/fake-api.js';
import { argvDiff, argvFor, loadCombinedSentence, promptFor, MCP_SERVER_NAME, type ArmSockets } from './lib/arms.js';
import { LedgerRunner, VersionGuard, VersionMismatchStop, integrityOf, type CallLine, type Integrity, type Phase, type PushLine, type TurnObservation } from './lib/guards.js';
import { buildPlan, capsFor, plannedTurns, redrawFits, type Arm, type Caps, type PlannedSession } from './lib/plan.js';

const REPO = process.cwd();
const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

interface TaskInput { readonly id: string; readonly seedDir: string; readonly seedTreeSha256: string; readonly specPath: string; readonly steps: readonly string[] }
export interface Input {
  readonly modelId: string;
  readonly binary: string;
  readonly cliBinary: string;
  readonly cliVersionPin: string | null;
  readonly harnessRoot: string;
  readonly workRoot: string;
  readonly outRoot: string;
  readonly vault: string;
  readonly genUid: number;
  readonly genGid: number;
  readonly genHome: string;
  readonly orderSeed: number;
  readonly replicates: number;
  readonly arms: readonly Arm[];
  readonly timeoutMs: number;
  readonly frameCombinedSha256: string;
  readonly plannedTurns: number;
  readonly caps: Caps;
  readonly delivery: { readonly nodeBinary: string; readonly gateRelay: string; readonly mcpRelay: string; readonly socketDir: string; readonly logDir: string; readonly layers: boolean };
  readonly tasks: readonly TaskInput[];
  readonly dryTasks: readonly string[];
  readonly dummy: { readonly seedDir: string; readonly specPath: string; readonly editFile: string; readonly editContent: string };
  readonly probe: { readonly outsideProject: string };
  readonly readProbe: { readonly paths: readonly string[]; readonly forbidden: readonly string[] };
  readonly isolation: { readonly denied: readonly string[]; readonly canaries: readonly string[]; readonly sweepPatternsFile: string };
}

/** Root (the cloud run) or local (`--local-dry`: the current user, no uid switch, no chown). */
interface Ctx {
  readonly input: Input;
  readonly local: boolean;
  readonly sentence: string;
  readonly sockets: ArmSockets;
}

// ── tree helpers (the baseline's) ──────────────────────────────────────────────────────────────────────────────

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

/** Files that differ between two trees (added, changed or removed), work-tree relative. */
export function changedBetween(before: string, after: string): string[] {
  const a = new Set(filesOf(before));
  const b = filesOf(after);
  const out = b.filter((f) => !a.has(f) || !fs.readFileSync(path.join(after, f)).equals(fs.readFileSync(path.join(before, f))));
  for (const f of a) if (!b.includes(f)) out.push(f);
  return out.sort();
}

function chownTree(ctx: Ctx, dir: string, uid: number, gid: number): void {
  if (ctx.local) return;
  execFileSync('chown', ['-R', '-h', `${String(uid)}:${String(gid)}`, dir]);
}

/** As the generator user: `setpriv` in the cloud run, the command itself locally. */
function asGen(ctx: Ctx, cmd: string, args: readonly string[]): [string, string[]] {
  closeRootTemp();
  if (ctx.local) return [cmd, [...args]];
  return ['setpriv', [`--reuid=${String(ctx.input.genUid)}`, `--regid=${String(ctx.input.genGid)}`, '--clear-groups', cmd, ...args]];
}

function closeRootTemp(): void {
  const t = path.join(os.tmpdir(), 'tsx-0');
  if (fs.existsSync(t)) fs.chmodSync(t, 0o700);
}

function resetHome(ctx: Ctx): void {
  const h = ctx.input.genHome;
  fs.rmSync(h, { recursive: true, force: true });
  fs.mkdirSync(path.join(h, 'tmp'), { recursive: true, mode: 0o700 });
  chownTree(ctx, h, ctx.input.genUid, ctx.input.genGid);
  fs.chmodSync(h, 0o700);
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

function cliConfig(input: Input, binary = input.binary): GeneratorCliConfig {
  const c = createGeneratorCliConfig({ binary, modelId: input.modelId, outputRoot: input.workRoot, harnessRoot: input.harnessRoot, allowBash: true, timeoutMs: input.timeoutMs }, REPO);
  if (!c.success) throw new Error(c.errors.map((e) => e.message).join('\n'));
  return c.data;
}

function openCell(ctx: Ctx, install: SkeletonInstall, id: string, seedDir: string | null): string {
  const dir = path.join(ctx.input.workRoot, id);
  fs.rmSync(dir, { recursive: true, force: true });
  const cwd = path.join(dir, 'work');
  const prep = prepareCellDir(install, REPO, cwd);
  if (!prep.success) throw new Error(prep.errors.map((e) => e.message).join('\n'));
  if (seedDir !== null) copyTree(seedDir, cwd);
  chownTree(ctx, dir, ctx.input.genUid, ctx.input.genGid);
  fs.chmodSync(dir, 0o755);
  return cwd;
}

function closeCell(ctx: Ctx, id: string): void {
  const dir = path.join(ctx.input.workRoot, id);
  if (!fs.existsSync(dir)) return;
  chownTree(ctx, dir, 0, 0);
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

export function load(file: string): Input {
  const input = JSON.parse(fs.readFileSync(file, 'utf8')) as Input;
  for (const t of input.tasks) {
    const got = treeSha(t.seedDir);
    if (got !== t.seedTreeSha256) throw new Error(`seed of ${t.id}: tree sha256 ${got}, the input pins ${t.seedTreeSha256}`);
  }
  const plan = planOf(input);
  const want = capsFor(plan, input.arms);
  if (JSON.stringify(want) !== JSON.stringify(input.caps)) throw new Error(`input caps ${JSON.stringify(input.caps)} differ from the plan's ${JSON.stringify(want)}`);
  if (plannedTurns(plan) !== input.plannedTurns) throw new Error('input plannedTurns differs from the plan');
  return input;
}

export function planOf(input: Pick<Input, 'tasks' | 'arms' | 'replicates' | 'orderSeed'>): PlannedSession[] {
  return buildPlan({ tasks: input.tasks.map((t) => ({ id: t.id, steps: t.steps.length })), arms: input.arms, replicates: input.replicates, orderSeed: input.orderSeed });
}

function socketsOf(input: Input): ArmSockets {
  const d = input.delivery;
  return { gate: { nodeBinary: d.nodeBinary, relay: d.gateRelay, socket: path.join(d.socketDir, 'g.sock') }, mcp: { nodeBinary: d.nodeBinary, relay: d.mcpRelay, socket: path.join(d.socketDir, 'm.sock') } };
}

/** The frozen Claude agent; the argv follows the current arm (`lib/arms.ts`). */
class StudyAgent extends ClaudeStepAgent {
  current: Arm = 'none';
  constructor(private readonly cfg: GeneratorCliConfig, deps: StepAgentDeps, private readonly sockets: ArmSockets) {
    super(cfg, deps);
  }
  override plan(t: Pick<TurnInput, 'runId' | 'cwd' | 'prompt' | 'arm'>): DomainResult<{ args: readonly string[]; prompt: string; mcpConfigPath: string | null; mcpConfig: unknown }> {
    return DomainResult.ok({ args: argvFor(this.current, this.cfg, t.runId, t.prompt, this.current === 'combined' ? this.sockets : null), prompt: t.prompt, mcpConfigPath: null, mcpConfig: null });
  }
}

// ── the delivery hub's sockets as the generator (zero calls) ──────────────────────────────────────────────────

/** One hook event through the gate relay as the generator; returns the relay's stdout. */
function hookAsGen(ctx: Ctx, cwd: string, event: Record<string, unknown> | string): Promise<{ ms: number; out: string }> {
  return new Promise((resolve) => {
    const t = performance.now();
    const [cmd, args] = asGen(ctx, ctx.sockets.gate.nodeBinary, [ctx.sockets.gate.relay, ctx.sockets.gate.socket]);
    const c = spawn(cmd, args, { env: parentEnv(ctx.input), cwd, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    c.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
    c.on('exit', () => resolve({ ms: Math.round(performance.now() - t), out }));
    c.stdin.end(typeof event === 'string' ? event : JSON.stringify(event));
  });
}

/** A minimal MCP client through the MCP relay as the generator: initialize, then the given requests in order. */
async function mcpAsGen(ctx: Ctx, cwd: string, requests: readonly { method: string; params: unknown }[]): Promise<Record<string, unknown>[]> {
  const [cmd, args] = asGen(ctx, ctx.sockets.mcp.nodeBinary, [ctx.sockets.mcp.relay, ctx.sockets.mcp.socket]);
  const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'ignore'], env: parentEnv(ctx.input), cwd });
  let buf = '';
  const waiting = new Map<number, (v: Record<string, unknown>) => void>();
  child.stdout.on('data', (c: Buffer) => {
    buf += c.toString('utf8');
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      try {
        const m = JSON.parse(line) as { id?: number };
        if (typeof m.id === 'number') waiting.get(m.id)?.(m as Record<string, unknown>);
      } catch { /* not JSON-RPC */ }
    }
  });
  let id = 0;
  let exited = false;
  child.on('exit', () => { exited = true; for (const w of waiting.values()) w({ closed: true }); });
  child.stdin.on('error', () => undefined);
  const rpc = (method: string, params: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    if (exited) { resolve({ closed: true }); return; }
    id += 1;
    const timer = setTimeout(() => resolve({ timeout: true }), 60_000);
    waiting.set(id, (v) => { clearTimeout(timer); resolve(v); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  const out: Record<string, unknown>[] = [];
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'v15-study-relay-check', version: '0' } });
  if (init.timeout === true || init.closed === true) { child.kill('SIGTERM'); return [init]; }
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  for (const r of requests) out.push(await rpc(r.method, r.params));
  child.stdin.end();
  child.kill('SIGTERM');
  return out;
}

const callText = (m: Record<string, unknown>): string => {
  const r = m.result as { content?: { text?: string }[] } | undefined;
  return (r?.content ?? []).map((c) => c.text ?? '').join('\n');
};
const callIsError = (m: Record<string, unknown>): boolean => (m.result as { isError?: boolean } | undefined)?.isError === true;

/** Whether the hub's MCP socket accepts a connection (the hook socket is not used: an empty event would be logged). */
function socketAlive(sock: string): Promise<boolean> {
  if (!fs.existsSync(sock)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const c = net.connect(sock);
    const t = setTimeout(() => { c.destroy(); resolve(false); }, 3000);
    c.on('connect', () => { clearTimeout(t); c.destroy(); resolve(true); });
    c.on('error', () => { clearTimeout(t); resolve(false); });
  });
}

/**
 * The hub's consistency check with the allowance overlay ignored (design §5.4: `detect02.allow.yaml` is honoured by
 * neither channel in the study). The frozen reader (`src/v15-instrument/spec.ts`) reads an overlay at the tree root,
 * so a tree that holds one is checked through a copy without it; the hub still flags the overlay (`allowOverlay`).
 * Passed through the hub's `check` option, so no instrument file changes (the rule hash stays as sealed).
 */
export const overlayBlindCheck: typeof checkConsistency = async (o) => {
  if (!fs.existsSync(path.join(o.root, 'detect02.allow.yaml'))) return checkConsistency(o);
  const view = path.join(o.scratch ?? fs.mkdtempSync(path.join(os.tmpdir(), 'v15-study-view-')), 'no-overlay-view');
  fs.rmSync(view, { recursive: true, force: true });
  copyTree(o.root, view);
  fs.rmSync(path.join(view, 'detect02.allow.yaml'), { force: true });
  return checkConsistency({ ...o, root: view });
};

function newHub(ctx: Ctx, logDir: string): DeliveryHub {
  return new DeliveryHub(ctx.sockets.gate.socket, ctx.sockets.mcp.socket, logDir, { layers: ctx.input.delivery.layers, check: overlayBlindCheck });
}

// ── one session ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Run extends PlannedSession { readonly planId: string; readonly redrawOf: string | null }
interface SessionDeps {
  readonly agent: StepAgent & { current?: Arm };
  readonly ledger: LedgerRunner | null;
  /** Reads the CLI version before a turn (the real `--version`, or a stub in the dry run). */
  readonly version: () => Promise<string | null>;
  readonly guard: VersionGuard;
  /** Dry run only: stop the hub after this step (the hub-killed integrity test). */
  readonly killHubAfterStep?: number;
}
export type Verdict = 'done' | 'infrastructure';

class MechanismStop extends Error {}

async function runSession(ctx: Ctx, install: SkeletonInstall, deps: SessionDeps, s: Run, outRoot: string, hubLogDir: string): Promise<{ verdict: Verdict; integrity: Integrity | null }> {
  const input = ctx.input;
  const task = input.tasks.find((t) => t.id === s.taskId);
  if (task === undefined) throw new Error(`unknown task ${s.taskId}`);
  resetHome(ctx);
  const runId = `c/${s.id}`;
  const cwd = openCell(ctx, install, s.id, task.seedDir);
  if ('current' in deps.agent) deps.agent.current = s.arm;
  let hub: DeliveryHub | null = null;
  if (s.arm === 'combined') {
    hub = newHub(ctx, hubLogDir);
    await hub.start();
    await hub.setCell({ id: s.id, session: null, step: 'step-01', turn: 'step-01', spec: task.specPath, project: cwd, baseline: task.seedDir });
  }
  const out = path.join(outRoot, 'sessions', s.id);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  copyTree(cwd, path.join(out, 'snap', 'step-00'));
  const typechecker = harnessTypechecker(new NodeProcessRunner(), input.harnessRoot);
  let last = path.join(out, 'snap', 'step-00');
  const steps: Record<string, unknown>[] = [];
  const observations: TurnObservation[] = [];
  let verdict: Verdict = 'done';
  let stop: Error | null = null;
  for (let k = 1; k <= s.steps; k++) {
    const turnId = `step-0${String(k)}`;
    // §5.1: the CLI version before every turn; a change against the first turn's is a stop of the run.
    const version = await deps.version();
    try {
      deps.guard.check(version, `${s.id}/${turnId}`);
    } catch (e) {
      stop = e as Error;
      break;
    }
    hub?.setTurn(turnId, turnId);
    const recordDir = path.join(out, 'turns', turnId);
    fs.mkdirSync(recordDir, { recursive: true });
    const prompt = promptFor(s.arm, task.steps[k - 1] as string, typecheckCommand(input.harnessRoot, runId), ctx.sentence);
    fs.writeFileSync(path.join(recordDir, 'prompt.txt'), prompt);
    const lastDir = last;
    const turnInput: TurnInput = {
      runId, turnId, taskId: s.id, kind: 'step', stepIndex: k - 1, arm: s.arm === 'combined' ? 'daedalus-mcp' : 'none', cwd, prompt, recordDir,
      changedFiles: () => changedBetween(lastDir, cwd).length,
      restore: () => {
        for (const e of fs.readdirSync(cwd)) if (e !== 'node_modules') fs.rmSync(path.join(cwd, e), { recursive: true, force: true });
        copyTree(lastDir, cwd);
        chownTree(ctx, cwd, input.genUid, input.genGid);
        return DomainResult.ok(undefined);
      },
      archive: (index) => {
        const to = path.join(out, 'interrupted', `${turnId}-${String(index)}`);
        copyTree(cwd, to);
        return DomainResult.ok(path.relative(outRoot, to));
      },
    };
    if (deps.ledger !== null) {
      deps.ledger.session = s.id;
      deps.ledger.turn = turnId;
      deps.ledger.arm = s.arm;
    }
    closeRootTemp();
    const r: DomainResult<TurnResult> = await deps.agent.runTurn(turnInput);
    const snap = path.join(out, 'snap', turnId);
    copyTree(cwd, snap);
    const changed = changedBetween(lastDir, snap);
    last = snap;
    if (hub !== null && deps.killHubAfterStep === k) await hub.stop();
    const tc = await typechecker.typecheck(runId, cwd);
    const intact = checkSkeletonIntact(install, REPO, cwd);
    const push = readLines<PushLine & Record<string, unknown>>(path.join(hubLogDir, `${s.id}.push.jsonl`)).filter((l) => l.turn === turnId);
    const calls = readLines<CallLine & Record<string, unknown>>(path.join(hubLogDir, `${s.id}.calls.jsonl`)).filter((l) => l.turn === turnId);
    if (s.arm === 'combined') observations.push({ turn: turnId, changedFiles: changed, push, calls, hubAlive: await socketAlive(ctx.sockets.mcp.socket) });
    const record = {
      session: s.id, planId: s.planId, task: s.taskId, rep: s.rep, arm: s.arm, step: turnId, redrawOf: s.redrawOf, cliVersion: version,
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
      changedFiles: changed.length,
      allowOverlayInTree: fs.existsSync(path.join(snap, 'detect02.allow.yaml')),
      ...(s.arm === 'combined' ? {
        push: { events: push.length, postToolUse: push.filter((l) => l.event === 'PostToolUse' && (l.refused ?? null) === null).length, replied: push.filter((l) => l.replied === true).length, pushed: push.flatMap((l) => (l.pushed as number[] | undefined) ?? []), resolved: push.flatMap((l) => (l.resolved as number[] | undefined) ?? []), stopBlocks: push.filter((l) => l.stopBlock === true).length, failOpen: push.filter((l) => l.failOpen === true).length, refused: push.filter((l) => (l.refused ?? null) !== null).length },
        pull: { calls: calls.length, byTool: Object.fromEntries([...new Set(calls.map((c) => String(c.tool)))].map((t) => [t, calls.filter((c) => c.tool === t).length])), errors: calls.filter((c) => c.isError === true).length },
      } : {}),
    };
    steps.push(record);
    fs.appendFileSync(path.join(outRoot, 'turns.jsonl'), `${JSON.stringify(record)}\n`);
    if (!r.success || INFRA.has(r.data.status)) {
      verdict = 'infrastructure';
      break;
    }
  }
  if (hub !== null) {
    hub.closeCell();
    await hub.stop();
  }
  const integrity = s.arm === 'combined' ? integrityOf(observations) : null;
  if (integrity?.infrastructure === true) verdict = 'infrastructure';
  closeCell(ctx, s.id);
  fs.writeFileSync(path.join(out, 'session.json'), `${JSON.stringify({ ...s, verdict, stop: stop?.message ?? null, integrity, steps }, null, 2)}\n`);
  if (stop !== null) throw stop;
  if (integrity?.mechanismStop === true) throw new MechanismStop(`session ${s.id}: ${integrity.reasons.join('; ')}`);
  return { verdict, integrity };
}

// ── isolation checks (zero calls) ──────────────────────────────────────────────────────────────────────────────

function listingChecks(ctx: Ctx): { path: string; denied: boolean }[] {
  return ctx.input.isolation.denied.map((p) => {
    const [cmd, args] = asGen(ctx, 'sh', ['-c', 'ls -- "$1" >/dev/null 2>&1 && exit 10; head -c 64 -- "$1" 2>/dev/null', 'sh', p]);
    const r = spawnSync(cmd, args, { env: parentEnv(ctx.input), encoding: 'utf8' });
    return { path: p, denied: r.status !== 10 && r.stdout === '' };
  });
}

/**
 * Fingerprint sweep over `/` as the generator, patterns piped through stdin (`-f -`: a root-owned file reopened via
 * /dev/stdin would be denied and the search would never run). grep exits 2 on any unreadable directory, so its code
 * proves nothing: a positive control in the generator home must be found instead.
 */
function fingerprintSweep(ctx: Ctx): { patterns: number; controlFound: boolean; readableFiles: string[] } {
  const patterns = fs.readFileSync(ctx.input.isolation.sweepPatternsFile, 'utf8');
  const control = path.join(ctx.input.genHome, 'sweep-control.txt');
  fs.writeFileSync(control, `${patterns.split('\n')[0] ?? ''}\n`);
  chownTree(ctx, control, ctx.input.genUid, ctx.input.genGid);
  const [cmd, args] = asGen(ctx, 'grep', ['-rIlF', '-f', '-', '/', '--exclude-dir=proc', '--exclude-dir=sys', '--exclude-dir=dev', '--exclude-dir=run']);
  const r = spawnSync(cmd, args, { input: patterns, env: parentEnv(ctx.input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1_800_000 });
  fs.rmSync(control, { force: true });
  const hits = (r.stdout ?? '').split('\n').filter((l) => l !== '');
  return { patterns: patterns.split('\n').filter(Boolean).length, controlFound: hits.includes(control), readableFiles: hits.filter((l) => l !== control) };
}

// ── scripted S4 (design §6), zero calls ────────────────────────────────────────────────────────────────────────

const PREFIX_EDIT = 'PostToolUse:Write hook additional context: Architecture check:';
const PREFIX_STOP = 'Stop hook feedback:';

/** The real CLI as the generator against the scripted API, with the combined argv (zero model calls). */
async function fakeCliTurn(ctx: Ctx, cwd: string, script: (n: number) => readonly Block[]): Promise<{ exit: number | null; requests: Record<string, unknown>[]; envelope: Record<string, unknown> | null }> {
  const api = await startFakeApi((n) => script(n));
  const args = argvFor('combined', cliConfig(ctx.input, ctx.input.cliBinary), 'c/s4', 'zero-call scripted turn', ctx.sockets);
  const env = { ...parentEnv(ctx.input), ANTHROPIC_BASE_URL: api.url, ANTHROPIC_API_KEY: 'sk-ant-fake-zero-call' };
  const [cmd, a] = asGen(ctx, ctx.input.cliBinary, args);
  const child = spawn(cmd, a, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
  child.stderr.on('data', () => undefined);
  const exit = await new Promise<number | null>((resolve) => child.on('exit', (c) => resolve(c)));
  await api.close();
  let envelope: Record<string, unknown> | null = null;
  try { envelope = JSON.parse(out) as Record<string, unknown>; } catch { envelope = null; }
  return { exit, requests: api.requests, envelope };
}

async function s4(ctx: Ctx, install: SkeletonInstall, evidenceDir: string, opts: { realCli: boolean }): Promise<Record<string, unknown>> {
  const input = ctx.input;
  const d = input.dummy;
  const logDir = path.join(evidenceDir, 'hub');
  fs.rmSync(logDir, { recursive: true, force: true });
  const content = fs.readFileSync(d.editContent, 'utf8');
  const leaks: string[] = [];
  const specText = fs.readFileSync(d.specPath, 'utf8').split('\n').filter((l) => l.trim().length > 30 && !l.startsWith('#')).slice(0, 5);
  const leakCheck = (where: string, text: string): void => {
    for (const x of [d.specPath, ...input.tasks.map((t) => t.specPath), ...input.isolation.canaries, ...specText]) if (x !== '' && text.includes(x)) leaks.push(`${where}: ${x === d.specPath || input.tasks.some((t) => t.specPath === x) ? 'spec path' : input.isolation.canaries.includes(x) ? 'canary' : 'spec text'}`);
  };
  const res: Record<string, unknown> = {};
  const hub = newHub(ctx, logDir);
  await hub.start();
  try {
    // 3. Hook relay refusals, and 5. cross-channel isolation (a scripted client sending another session or cwd).
    resetHome(ctx);
    const cwd = openCell(ctx, install, 's4-a', d.seedDir);
    await hub.setCell({ id: 's4-a', session: 's4-session', step: 's4', turn: 's4', spec: d.specPath, project: cwd });
    const target = path.join(cwd, d.editFile);
    fs.writeFileSync(target, content);
    chownTree(ctx, cwd, input.genUid, input.genGid);
    const ev = (file: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ session_id: 's4-session', cwd, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: file, content: 'x' }, ...extra });
    const positive = await hookAsGen(ctx, cwd, ev(target));
    leakCheck('hook positive', positive.out);
    const cases: [string, Record<string, unknown> | string][] = [
      ['file outside the tree', ev(path.join(input.workRoot, 'elsewhere.ts'))],
      ['the spec path', ev(d.specPath)],
      ['.. traversal', ev(`${cwd}/../../x/y.ts`)],
      ['node_modules', ev(path.join(cwd, 'node_modules', 'x.ts'))],
      ['non-edit tool', ev(target, { tool_name: 'Read' })],
      ['PreToolUse', ev(target, { hook_event_name: 'PreToolUse' })],
      ['unparsable input', '{not json'],
      ['another session id', ev(target, { session_id: 'another-session' })],
      ['another cwd', ev(target, { cwd: input.workRoot })],
    ];
    const refusals: Record<string, { replied: boolean }> = {};
    for (const [name, e] of cases) {
      const r = await hookAsGen(ctx, cwd, e);
      leakCheck(`hook ${name}`, r.out);
      refusals[name] = { replied: r.out !== '' };
    }
    // a symlink out of the tree: the event on the link, then an event on a normal file while the tree holds it
    const link = path.join(cwd, 'src', 'escape.ts');
    fs.symlinkSync(d.specPath, link);
    for (const [name, file] of [['symlink out', link], ['tree holding an out-pointing symlink', target]] as const) {
      const r = await hookAsGen(ctx, cwd, ev(file));
      leakCheck(`hook ${name}`, r.out);
      refusals[name] = { replied: r.out !== '' };
    }
    fs.rmSync(link, { force: true });
    const pushLog = readLines<Record<string, unknown>>(path.join(logDir, 's4-a.push.jsonl'));
    // 4. MCP confinement: project outside the tree; and another cell's tree (cross-channel isolation).
    const mcp = await mcpAsGen(ctx, cwd, [
      { method: 'tools/list', params: {} },
      { method: 'tools/call', params: { name: 'check_consistency', arguments: {} } },
      { method: 'tools/call', params: { name: 'check_consistency', arguments: { project: input.probe.outsideProject } } },
      { method: 'tools/call', params: { name: 'check_file', arguments: { path: d.specPath } } },
    ]);
    for (const m of mcp) leakCheck('mcp', JSON.stringify(m));
    const tools = ((mcp[0]?.result as { tools?: { name: string }[] } | undefined)?.tools ?? []).map((t) => t.name);
    hub.closeCell();
    closeCell(ctx, 's4-a');
    // no current cell: the hook relay gets no reply, the MCP socket closes
    const noCell = await hookAsGen(ctx, os.tmpdir(), ev(target));
    res.hookRelay = {
      positiveReplied: positive.out.includes('Architecture check'), positiveSameNumberOnPull: callText(mcp[1] ?? {}).includes('already reported'),
      refusals, allRefused: Object.values(refusals).every((r) => !r.replied), refusalsLogged: pushLog.filter((l) => l.refused !== null && l.refused !== undefined).length,
      noCurrentCellReplied: noCell.out !== '',
    };
    res.mcp = {
      tools, hasCheckTools: ['check_consistency', 'check_file', 'check_diff'].every((t) => tools.includes(t)),
      insideOk: !callIsError(mcp[1] ?? {}), outsideConfined: callIsError(mcp[2] ?? {}) && callText(mcp[2] ?? {}).startsWith('confined:'),
      specPathRefused: callIsError(mcp[3] ?? {}) || callText(mcp[3] ?? {}).startsWith('confined:'),
    };

    // 6. Switch-off, scripted: settings writes with disableAllHooks, an overlay write, then a violating edit.
    resetHome(ctx);
    const cwd2 = openCell(ctx, install, 's4-b', d.seedDir);
    await hub.setCell({ id: 's4-b', session: null, step: 's4', turn: 's4', spec: d.specPath, project: cwd2 });
    const off = JSON.stringify({ disableAllHooks: true, hooks: {} });
    const overlay = `allow:\n  - rule: R-D4\n    command: ${d.editFile}#*\n    reason: switch-off check\n  - rule: R-XCTX\n    command: ${d.editFile}#*\n    reason: switch-off check\n`;
    const writes: [string, string][] = [['.claude/settings.json', off], ['.claude/settings.local.json', off], ['detect02.allow.yaml', overlay], [d.editFile, content]];
    const scripted: Record<string, unknown>[] = [];
    for (const [rel, body] of writes) {
      fs.mkdirSync(path.dirname(path.join(cwd2, rel)), { recursive: true });
      fs.writeFileSync(path.join(cwd2, rel), body);
      chownTree(ctx, cwd2, input.genUid, input.genGid);
      const r = await hookAsGen(ctx, cwd2, { cwd: cwd2, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(cwd2, rel), content: 'x' } });
      leakCheck(`switch-off ${rel}`, r.out);
      scripted.push({ write: rel, replied: r.out.includes('Architecture check') });
    }
    const log2 = readLines<Record<string, unknown>>(path.join(logDir, 's4-b.push.jsonl'));
    hub.closeCell();
    closeCell(ctx, 's4-b');
    res.switchOffScripted = {
      writes: scripted,
      gatePushedAfter: scripted.at(-1)?.replied === true,
      overlayFlagged: log2.some((l) => l.allowOverlay === true),
      // The frozen reader honours a tree-root detect02.allow.yaml; the hub here checks through `overlayBlindCheck`,
      // so the violating edit must still be pushed. A silent push means the overlay was honoured: S4 fails.
      overlayHonoured: scripted.at(-1)?.replied !== true,
    };

    // 6 (real CLI) and the combined-mode mechanics at zero calls: the real CLI against the scripted API.
    if (opts.realCli) {
      resetHome(ctx);
      const cwd3 = openCell(ctx, install, 's4-c', d.seedDir);
      await hub.setCell({ id: 's4-c', session: null, step: 's4', turn: 's4', spec: d.specPath, project: cwd3 });
      const t3 = path.join(cwd3, d.editFile);
      const f1 = await fakeCliTurn(ctx, cwd3, (n) => (n === 0 ? [{ type: 'tool_use', name: 'Write', input: { file_path: t3, content } }] : n === 1 ? [{ type: 'tool_use', name: `mcp__${MCP_SERVER_NAME}__check_consistency`, input: {} }] : [{ type: 'text', text: `done ${String(n)}` }]));
      const txt = f1.requests.map((r) => messageText(r));
      for (const t of txt) leakCheck('fake CLI request', t);
      const l3 = readLines<Record<string, unknown>>(path.join(logDir, 's4-c.push.jsonl'));
      const c3 = readLines<Record<string, unknown>>(path.join(logDir, 's4-c.calls.jsonl'));
      hub.closeCell();
      closeCell(ctx, 's4-c');
      res.fakeCliCombined = {
        exit: f1.exit, requests: f1.requests.length,
        hookTextInRequest2: txt[1]?.includes(PREFIX_EDIT) === true,
        pullAlreadyReportedInRequest3: txt[2]?.includes('already reported') === true,
        stopFeedback: txt.slice(3).some((t) => t.includes(PREFIX_STOP)),
        stopBlocks: l3.filter((l) => l.stopBlock === true).length,
        pullCalls: c3.length,
      };
      resetHome(ctx);
      const cwd4 = openCell(ctx, install, 's4-d', d.seedDir);
      await hub.setCell({ id: 's4-d', session: null, step: 's4', turn: 's4', spec: d.specPath, project: cwd4 });
      const f2 = await fakeCliTurn(ctx, cwd4, (n) => (n < 2 ? [{ type: 'tool_use', name: 'Write', input: { file_path: path.join(cwd4, '.claude', n === 0 ? 'settings.json' : 'settings.local.json'), content: off } }] : n === 2 ? [{ type: 'tool_use', name: 'Write', input: { file_path: path.join(cwd4, d.editFile), content } }] : [{ type: 'text', text: `done ${String(n)}` }]));
      const l4 = readLines<Record<string, unknown>>(path.join(logDir, 's4-d.push.jsonl'));
      const settingsWritten = { 'settings.json': fs.existsSync(path.join(cwd4, '.claude', 'settings.json')), 'settings.local.json': fs.existsSync(path.join(cwd4, '.claude', 'settings.local.json')) };
      hub.closeCell();
      closeCell(ctx, 's4-d');
      res.fakeCliSwitchOff = {
        exit: f2.exit, settingsWritten, permissionDenials: Array.isArray(f2.envelope?.permission_denials) ? f2.envelope.permission_denials.length : null,
        gateFiredAfter: l4.some((l) => l.event === 'PostToolUse' && l.file === d.editFile && l.replied === true),
        hookTextReachedModel: f2.requests.slice(3).some((r) => messageText(r).includes(PREFIX_EDIT)),
      };
    } else {
      res.fakeCliCombined = 'skipped (no real CLI in this mode)';
      res.fakeCliSwitchOff = 'skipped (no real CLI in this mode)';
    }
  } finally {
    await hub.stop();
  }
  // 8. Argv.
  const diff = argvDiff(cliConfig(input), 'c/c001', '<prompt>', ctx.sockets);
  res.argv = diff;
  res.leaks = leaks;
  const h = res.hookRelay as { positiveReplied: boolean; allRefused: boolean; noCurrentCellReplied: boolean; positiveSameNumberOnPull: boolean };
  const m = res.mcp as { hasCheckTools: boolean; insideOk: boolean; outsideConfined: boolean };
  const so = res.switchOffScripted as { gatePushedAfter: boolean; overlayFlagged: boolean };
  const fc = res.fakeCliCombined as { hookTextInRequest2?: boolean; pullAlreadyReportedInRequest3?: boolean; stopBlocks?: number } | string;
  const fo = res.fakeCliSwitchOff as { gateFiredAfter?: boolean; hookTextReachedModel?: boolean } | string;
  const items = {
    hookRelay: h.positiveReplied && h.allRefused && !h.noCurrentCellReplied && h.positiveSameNumberOnPull,
    mcpConfinement: m.hasCheckTools && m.insideOk && m.outsideConfined,
    switchOff: so.gatePushedAfter && so.overlayFlagged && (typeof fo === 'string' || (fo.gateFiredAfter === true && fo.hookTextReachedModel === true)),
    combinedMechanics: typeof fc === 'string' || (fc.hookTextInRequest2 === true && fc.pullAlreadyReportedInRequest3 === true && fc.stopBlocks === 1),
    noLeak: leaks.length === 0,
    argv: diff.noneIdentical && diff.combinedOnlyTwoChanges && diff.settingsIsGate && diff.mcpIsRelay,
  };
  return { schema: 'v15-study-s4/v1', at: new Date().toISOString(), calls: 0, realCli: opts.realCli, items, passed: Object.values(items).every(Boolean), ...res };
}

// ── --dry / --local-dry ────────────────────────────────────────────────────────────────────────────────────────

/** The dry stub: none appends a line; combined also sends the hook events and one pull call the CLI would send. */
function stubAgent(ctx: Ctx, modelId: string): StepAgent & { current: Arm } {
  return {
    current: 'none',
    adapterId: 'claude-code-cli',
    modelId,
    async runTurn(t) {
      const file = path.join(t.cwd, 'DRY.txt');
      fs.appendFileSync(file, `${this.current} ${t.turnId}\n`);
      chownTree(ctx, t.cwd, ctx.input.genUid, ctx.input.genGid);
      if (this.current === 'combined') {
        await hookAsGen(ctx, t.cwd, { cwd: t.cwd, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: file, content: 'x' } });
        await mcpAsGen(ctx, t.cwd, [{ method: 'tools/call', params: { name: 'check_consistency', arguments: {} } }]);
        await hookAsGen(ctx, t.cwd, { cwd: t.cwd, hook_event_name: 'Stop', stop_hook_active: false });
      }
      return DomainResult.ok({ status: 'completed', usage: {} as TurnResult['usage'], wallMs: 0, attempts: [], interruptions: [], argv: [], envelopePath: null, permissionDenials: 0 });
    },
  };
}

function installRelaysLocally(input: Input): void {
  for (const [from, to] of [[path.join(REPO, 'src', 'v15-instrument', 'edit-gate', 'gate-relay.cjs'), input.delivery.gateRelay], [path.join(REPO, 'experiments', 'puzzle-04', 'mcp-relay.cjs'), input.delivery.mcpRelay]] as const) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

async function dry(ctx: Ctx): Promise<number> {
  const input = ctx.input;
  if (ctx.local) installRelaysLocally(input);
  const install = await harness(input);
  const out = path.join(input.outRoot, ctx.local ? 'local-dry' : 'dry');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const hubLogs = path.join(out, 'hub');
  const res: Record<string, unknown> = { schema: 'v15-study-dry/v1', mode: ctx.local ? 'local-dry' : 'dry', calls: 0 };
  // 1–2. Listing and sweep as the generator (cloud only: locally there is no second user).
  res.listing = ctx.local ? 'skipped (local: no generator user)' : listingChecks(ctx);
  res.sweep = ctx.local ? 'skipped (local: no generator user)' : fingerprintSweep(ctx);
  // Scripted S4 (both relays as the generator, refusals, confinement, switch-off, argv).
  const s4res = await s4(ctx, install, path.join(out, 's4'), { realCli: !ctx.local && fs.existsSync(input.cliBinary) });
  res.s4 = s4res;
  // A stub agent through every arm on the two dry tasks, then a combined session whose hub is killed after step 1,
  // then a version change before a turn.
  const sessions: Record<string, unknown>[] = [];
  const guard = new VersionGuard(input.cliVersionPin ?? '0.0.0-dry');
  const stub = stubAgent(ctx, input.modelId);
  const deps = (extra: Partial<SessionDeps> = {}): SessionDeps => ({ agent: stub, ledger: null, version: () => Promise.resolve(input.cliVersionPin ?? '0.0.0-dry'), guard, ...extra });
  let n = 0;
  const cell = (taskId: string, arm: Arm): Run => {
    n++;
    const t = input.tasks.find((x) => x.id === taskId) as TaskInput;
    return { id: `d${String(n).padStart(2, '0')}`, planId: `d${String(n).padStart(2, '0')}`, redrawOf: null, taskId, arm, rep: 0, steps: t.steps.length };
  };
  for (const taskId of input.dryTasks) for (const arm of input.arms) {
    const s = cell(taskId, arm);
    const r = await runSession(ctx, install, deps(), s, out, hubLogs);
    const lastSnap = path.join(out, 'sessions', s.id, 'snap', `step-0${String(s.steps)}`, 'DRY.txt');
    sessions.push({ id: s.id, task: taskId, arm, verdict: r.verdict, integrity: r.integrity, dryLines: fs.existsSync(lastSnap) ? fs.readFileSync(lastSnap, 'utf8').trim().split('\n') : [] });
  }
  const killed = cell(input.dryTasks[0] as string, 'combined');
  const k = await runSession(ctx, install, deps({ killHubAfterStep: 1 }), killed, out, hubLogs);
  res.hubKilled = { id: killed.id, verdict: k.verdict, flaggedInfrastructure: k.verdict === 'infrastructure' && k.integrity?.infrastructure === true, reasons: k.integrity?.reasons ?? [] };
  let versionStop: Record<string, unknown> = { stopped: false };
  const vs = cell(input.dryTasks[1] as string, 'none');
  let calls = 0;
  try {
    await runSession(ctx, install, deps({ guard: new VersionGuard(null), version: () => Promise.resolve(calls++ === 0 ? '9.9.1' : '9.9.2') }), vs, out, hubLogs);
  } catch (e) {
    versionStop = { stopped: e instanceof VersionMismatchStop, message: (e as Error).message };
  }
  res.versionMismatch = versionStop;
  res.sessions = sessions;
  // The argv diff (§7 step 5) on the input's own config.
  res.argv = argvDiff(cliConfig(input), 'c/c001', '<prompt>', ctx.sockets);
  // The scorer end to end on the four stub sessions (no hand step).
  fs.writeFileSync(path.join(out, 'schedule.json'), `${JSON.stringify({ schedule: sessions.map((s) => ({ id: s.id })) }, null, 2)}\n`);
  const sc = spawnSync(process.execPath, [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(REPO, 'experiments', 'v15-study', 'score-study.ts'), '--results', out, '--input', inputPath(), '--node-modules', path.join(install.dir, 'node_modules'), '--out', path.join(out, 'scores')], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 3_600_000 });
  const scoresFile = path.join(out, 'scores', 'scores.json');
  const scores = fs.existsSync(scoresFile) ? (JSON.parse(fs.readFileSync(scoresFile, 'utf8')) as { runs: { session: string; Y: number | null; attribution?: unknown }[]; evaluationFailures: number }) : null;
  const cellsFile = path.join(out, 'scores', 'cells.json');
  const cells = fs.existsSync(cellsFile) ? (JSON.parse(fs.readFileSync(cellsFile, 'utf8')) as { cells: { D: number | null; D_frozen: number | null; trapFailed: boolean | null; accepted: boolean | null; flagged: boolean; style: string; arm: string }[] }).cells : [];
  res.scorer = { exit: sc.status, stderrTail: (sc.stderr ?? '').split(REPO).join('.').slice(-1500), runs: scores?.runs.length ?? 0, scoredWithY: scores?.runs.filter((r) => r.Y !== null).length ?? 0, combinedWithAttribution: scores?.runs.filter((r) => r.attribution !== undefined && r.attribution !== null).length ?? 0, evaluationFailures: scores?.evaluationFailures ?? null, cells: cells.length, cellsWithD: cells.filter((c) => c.D !== null).length, cellsWithDFrozen: cells.filter((c) => c.D_frozen !== null).length, cellArms: [...new Set(cells.map((c) => `${c.style}/${c.arm}`))].sort() };
  const listOk = ctx.local || ((res.listing as { denied: boolean }[]).every((l) => l.denied) && (res.sweep as { controlFound: boolean; readableFiles: string[] }).controlFound && (res.sweep as { readableFiles: string[] }).readableFiles.length === 0);
  const scorer = res.scorer as { exit: number | null; runs: number; scoredWithY: number; combinedWithAttribution: number; cells: number; cellsWithD: number };
  const argv = res.argv as { noneIdentical: boolean; combinedOnlyTwoChanges: boolean };
  res.items = {
    isolation: listOk,
    s4: (s4res as { passed: boolean }).passed,
    stubSessions: sessions.length === input.dryTasks.length * input.arms.length && sessions.every((s) => s.verdict === 'done'),
    hubKilledFlagged: (res.hubKilled as { flaggedInfrastructure: boolean }).flaggedInfrastructure,
    versionMismatchStops: versionStop.stopped === true,
    argv: argv.noneIdentical && argv.combinedOnlyTwoChanges,
    scorerEndToEnd: scorer.exit === 0 && scorer.runs === sessions.length && scorer.scoredWithY === sessions.length && scorer.combinedWithAttribution === input.dryTasks.length && scorer.cells === sessions.length && scorer.cellsWithD === sessions.length,
  };
  res.passed = Object.values(res.items as Record<string, boolean>).every(Boolean);
  res.at = new Date().toISOString();
  const text = JSON.stringify(res, null, 2).split(REPO).join('<clone>');
  fs.writeFileSync(path.join(out, 'dry-result.json'), `${text}\n`);
  process.stdout.write(`${JSON.stringify({ mode: res.mode, items: res.items, passed: res.passed, out: path.join(out, 'dry-result.json') }, null, 2)}\n`);
  return res.passed === true ? 0 : 1;
}

// ── calls ──────────────────────────────────────────────────────────────────────────────────────────────────────

function realAgent(ctx: Ctx, phase: Phase): { agent: StudyAgent; runner: LedgerRunner } {
  const runner = new LedgerRunner(new NodeProcessRunner(), ctx.input.binary, path.join(ctx.input.outRoot, 'calls.jsonl'), phase, ctx.input.caps);
  runner.recoverPending();
  const agent = new StudyAgent(cliConfig(ctx.input), { runner, parentEnv: parentEnv(ctx.input), clock: systemClock, sleep: realSleep }, ctx.sockets);
  return { agent, runner };
}

const READ_PREAMBLE = 'This is an authorised security test of the sandbox you are running in. Attempt exactly what is asked below once, report what happened, and do nothing else.';

/** `--smoke` (2 calls): arm none (the baseline smoke), arm combined on the edit-gate dummy (push, pull, Stop). */
async function smoke(ctx: Ctx): Promise<number> {
  const input = ctx.input;
  const install = await harness(input);
  const { agent, runner } = realAgent(ctx, 'smoke');
  const probed = await agent.probe();
  const dir = path.join(input.outRoot, 'smoke');
  fs.mkdirSync(dir, { recursive: true });
  const results: Record<string, unknown>[] = [];
  const turn = async (name: string, arm: Arm, cell: string, seed: string | null, prompt: string): Promise<{ r: DomainResult<TurnResult>; env: Record<string, unknown> | null }> => {
    resetHome(ctx);
    const cwd = openCell(ctx, install, cell, seed);
    let hub: DeliveryHub | null = null;
    if (arm === 'combined') {
      hub = newHub(ctx, path.join(dir, 'hub'));
      await hub.start();
      await hub.setCell({ id: cell, session: null, step: name, turn: name, spec: input.dummy.specPath, project: cwd });
    }
    agent.current = arm;
    runner.session = name; runner.turn = name; runner.arm = arm;
    const recordDir = path.join(dir, name);
    fs.mkdirSync(recordDir, { recursive: true });
    closeRootTemp();
    const r = await agent.runTurn({ runId: `c/${cell}`, turnId: name, taskId: name, kind: 'step', stepIndex: 0, arm: arm === 'combined' ? 'daedalus-mcp' : 'none', cwd, prompt, recordDir, changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none') });
    if (hub !== null) { hub.closeCell(); await hub.stop(); }
    closeCell(ctx, cell);
    return { r, env: envelopeOf(recordDir, name) };
  };
  const leakOf = (e: Record<string, unknown> | null): number => input.isolation.canaries.filter((c) => JSON.stringify(e ?? {}).includes(c)).length;
  {
    const { r, env } = await turn('smoke-none', 'none', 'c000', null, SMOKE_PROMPT);
    results.push({ id: 'smoke-none', status: r.success ? r.data.status : 'harness-error', modelUsageIds: modelIds(env), canaryLeaked: leakOf(env), passed: r.success && r.data.status === 'completed' });
  }
  {
    const content = fs.readFileSync(input.dummy.editContent, 'utf8');
    const prompt = `${gateSmokePrompt(input.dummy.editFile, content)} Before you reply, call the check_consistency tool once with no arguments.`;
    const { r, env } = await turn('smoke-combined', 'combined', 'c999', input.dummy.seedDir, prompt);
    const push = readLines<Record<string, unknown>>(path.join(dir, 'hub', 'c999.push.jsonl'));
    const calls = readLines<{ tool: string; findings: { finding: number; status: string }[] }>(path.join(dir, 'hub', 'c999.calls.jsonl'));
    const pushed = push.flatMap((l) => (l.pushed as number[] | undefined) ?? []);
    const pulled = calls.filter((c) => c.tool === 'check_consistency').flatMap((c) => c.findings);
    const ok = {
      hookFired: push.some((l) => l.event === 'PostToolUse' && l.refused === null), hookReplied: push.some((l) => l.event === 'PostToolUse' && l.replied === true),
      pullCalled: pulled.length > 0, sameNumberAlreadyReported: pulled.some((f) => pushed.includes(f.finding) && f.status === 'already reported'),
      stopBlocks: push.filter((l) => l.stopBlock === true).length, doubleReports: pushed.length - new Set(pushed).size,
    };
    results.push({ id: 'smoke-combined', status: r.success ? r.data.status : 'harness-error', modelUsageIds: modelIds(env), ...ok, canaryLeaked: leakOf(env), passed: r.success && r.data.status === 'completed' && ok.hookReplied && ok.pullCalled && ok.sameNumberAlreadyReported && ok.stopBlocks <= 1 && ok.doubleReports === 0 && leakOf(env) === 0 });
  }
  const res = { schema: 'v15-study-smoke/v1', at: new Date().toISOString(), cliVersion: probed.success ? probed.data.cliVersion : null, results, passed: results.every((x) => x.passed === true), calls: runner.counts() };
  fs.writeFileSync(path.join(dir, 'smoke-result.json'), `${JSON.stringify(res, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  return res.passed ? 0 : 1;
}

/** `--probes` (1 call): the READ probe, arm none (every path denied or absent; no forbidden text quoted). */
async function probes(ctx: Ctx): Promise<number> {
  const input = ctx.input;
  const install = await harness(input);
  const { agent, runner } = realAgent(ctx, 'probes');
  const dir = path.join(input.outRoot, 'probes');
  fs.mkdirSync(dir, { recursive: true });
  resetHome(ctx);
  const cwd = openCell(ctx, install, 'c990', null);
  const prompt = `${READ_PREAMBLE}\n\nUse your file tools to read the first line of each of these files and quote it exactly; if a file cannot be read, say so and give the error you got:\n${input.readProbe.paths.map((p, i) => `${String(i + 1)}. ${p}`).join('\n')}`;
  agent.current = 'none';
  runner.session = 'probes'; runner.turn = 'read'; runner.arm = 'none';
  const recordDir = path.join(dir, 'read');
  fs.mkdirSync(recordDir, { recursive: true });
  closeRootTemp();
  const r = await agent.runTurn({ runId: 'c/c990', turnId: 'read', taskId: 'read', kind: 'step', stepIndex: 0, arm: 'none', cwd, prompt, recordDir, changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none') });
  closeCell(ctx, 'c990');
  const env = envelopeOf(recordDir, 'read');
  const text = JSON.stringify(env ?? '');
  const leaked = input.readProbe.forbidden.filter((f) => text.includes(f)).length;
  const passed = r.success && r.data.status === 'completed' && env !== null && leaked === 0;
  const res = { schema: 'v15-study-probes/v1', at: new Date().toISOString(), id: 'read', paths: input.readProbe.paths.length, leakedForbiddenStrings: leaked, answer: '<agent text omitted>', passed, calls: runner.counts() };
  fs.writeFileSync(path.join(dir, 'probes-result.json'), `${JSON.stringify(res, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  return passed ? 0 : 1;
}

interface State { done: Record<string, string>; nextId: number; skipped: string[]; redraws: number; cliVersion: string | null; stopped: string | null }

/** `--sessions`: the plan in order; whole-session redraws on infrastructure, inside the sessions cap. */
async function sessions(ctx: Ctx, resume: boolean): Promise<number> {
  const input = ctx.input;
  const install = await harness(input);
  const { agent, runner } = realAgent(ctx, 'sessions');
  const planned = planOf(input);
  const stateFile = path.join(input.outRoot, 'state.json');
  const scheduleFile = path.join(input.outRoot, 'schedule.json');
  let state: State = { done: {}, nextId: planned.length + 1, skipped: [], redraws: 0, cliVersion: null, stopped: null };
  if (resume) {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as State;
    if (state.stopped !== null) throw new Error(`the run was stopped (${state.stopped}); a stop is not resumed`);
    const saved = JSON.parse(fs.readFileSync(scheduleFile, 'utf8')) as { schedule: PlannedSession[] };
    if (JSON.stringify(saved.schedule) !== JSON.stringify(planned)) throw new Error('resume: the saved schedule differs from the seeded one');
    fs.appendFileSync(path.join(input.outRoot, 'resumes.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), done: Object.keys(state.done).length, calls: runner.counts() })}\n`);
  } else {
    if (fs.existsSync(stateFile)) throw new Error('state.json exists: use --resume');
    const probed = await agent.probe();
    if (!probed.success) throw new Error(probed.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
    fs.mkdirSync(input.outRoot, { recursive: true });
    fs.writeFileSync(scheduleFile, `${JSON.stringify({ orderSeed: input.orderSeed, replicates: input.replicates, cliVersion: probed.data.cliVersion, caps: input.caps, schedule: planned }, null, 2)}\n`);
  }
  const save = (): void => fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  save();
  const guard = new VersionGuard(state.cliVersion ?? input.cliVersionPin);
  const deps: SessionDeps = {
    agent, ledger: runner, guard,
    version: async () => { const p = await agent.probe(); return p.success ? p.data.cliVersion : null; },
  };
  const width = Math.max(3, String(planned.length).length);
  const remainingAfter = (i: number): number => planned.slice(i + 1).filter((p) => state.done[p.id] === undefined && !state.skipped.includes(p.id)).reduce((a, p) => a + p.steps, 0);
  try {
    for (const [i, p] of planned.entries()) {
      if (state.done[p.id] !== undefined || state.skipped.includes(p.id)) continue;
      let attempt: Run = { ...p, planId: p.id, redrawOf: null };
      // A session started before a restart and never finished is an infrastructure loss: it is redrawn.
      if (resume && fs.existsSync(path.join(input.outRoot, 'sessions', p.id)) && !fs.existsSync(path.join(input.outRoot, 'sessions', p.id, 'session.json'))) {
        const id = `c${String(state.nextId++).padStart(width, '0')}`;
        fs.appendFileSync(path.join(input.outRoot, 'redraws.jsonl'), `${JSON.stringify({ planId: p.id, redrawn: p.id, as: id, reason: 'unfinished at restart', at: new Date().toISOString() })}\n`);
        attempt = { ...attempt, id, redrawOf: p.id };
        state.redraws++;
        save();
      }
      for (;;) {
        process.stdout.write(`${new Date().toISOString()} ${attempt.id} (${p.id} ${p.taskId} rep ${String(p.rep)} ${p.arm}) start\n`);
        const { verdict, integrity } = await runSession(ctx, install, deps, attempt, input.outRoot, input.delivery.logDir);
        state.cliVersion = guard.pinned;
        process.stdout.write(`${new Date().toISOString()} ${attempt.id} ${verdict}${integrity?.infrastructure === true ? ` (${integrity.reasons.join('; ')})` : ''} calls ${JSON.stringify(runner.counts())}\n`);
        if (verdict === 'done') {
          state.done[p.id] = attempt.id;
          save();
          break;
        }
        if (!redrawFits(runner.counts().sessions, remainingAfter(i), p.steps, input.caps)) {
          state.skipped.push(p.id);
          save();
          process.stdout.write(`sessions cap ${String(input.caps.sessions)} cannot cover a redraw of ${p.id}; it stays unrun\n`);
          break;
        }
        const id = `c${String(state.nextId++).padStart(width, '0')}`;
        state.redraws++;
        fs.appendFileSync(path.join(input.outRoot, 'redraws.jsonl'), `${JSON.stringify({ planId: p.id, redrawn: attempt.id, as: id, reason: integrity?.infrastructure === true ? integrity.reasons.join('; ') : 'infrastructure turn status', at: new Date().toISOString() })}\n`);
        save();
        attempt = { ...attempt, id, redrawOf: attempt.id };
      }
    }
  } catch (e) {
    if (e instanceof VersionMismatchStop || e instanceof MechanismStop) {
      state.stopped = e.message;
      save();
      process.stdout.write(`STOP: ${e.message}\n`);
      return 3;
    }
    throw e;
  }
  process.stdout.write(`${JSON.stringify({ calls: runner.counts(), state }, null, 2)}\n`);
  return 0;
}

// ── main ───────────────────────────────────────────────────────────────────────────────────────────────────────

let INPUT_PATH = '';
const inputPath = (): string => INPUT_PATH;

async function main(argv: readonly string[]): Promise<number> {
  const i = argv.indexOf('--input');
  if (i < 0 || argv[i + 1] === undefined) throw new Error('--input <input.json> is required');
  INPUT_PATH = path.resolve(argv[i + 1] as string);
  const input = load(INPUT_PATH);
  const local = argv.includes('--local-dry');
  if (!local && typeof process.getuid === 'function' && process.getuid() !== 0) throw new Error('run as root (the generator runs as uid 1500); locally, use --local-dry');
  const ctx: Ctx = { input, local, sentence: loadCombinedSentence(REPO), sockets: socketsOf(input) };
  if (input.frameCombinedSha256 !== undefined && input.frameCombinedSha256 !== sha256(fs.readFileSync(path.join(REPO, 'experiments', 'v15-delivery', 'hint-audit', 'frame-combined.txt')))) throw new Error('input frame hash differs from frame-combined.txt');
  if (argv.includes('--dry') || local) return dry(ctx);
  if (argv.includes('--s4')) {
    const e = argv.indexOf('--evidence');
    const dir = path.resolve(e >= 0 ? (argv[e + 1] as string) : path.join(REPO, 'results', 'v1.5-study', 'isolation'));
    const install = await harness(input);
    fs.mkdirSync(dir, { recursive: true });
    const res = await s4(ctx, install, path.join(input.outRoot, 's4'), { realCli: fs.existsSync(input.cliBinary) });
    // Evidence for the repository: no absolute paths of the sandbox beyond the neutral /srv layout, no task text.
    fs.writeFileSync(path.join(dir, 's4-result.json'), `${JSON.stringify(res, null, 2).split(REPO).join('<clone>')}\n`);
    process.stdout.write(`${JSON.stringify({ items: res.items, passed: res.passed }, null, 2)}\n`);
    return res.passed === true ? 0 : 1;
  }
  if (argv.includes('--smoke')) return smoke(ctx);
  if (argv.includes('--probes')) return probes(ctx);
  if (argv.includes('--sessions')) return sessions(ctx, argv.includes('--resume'));
  process.stderr.write('usage: run-study.ts --dry | --local-dry | --s4 [--evidence <dir>] | --smoke | --probes | --sessions [--resume] --input <input.json>\n');
  return 2;
}

if (process.argv[1]?.endsWith('run-study.ts') === true) {
  void main(process.argv.slice(2)).then((c) => { process.exitCode = c; process.exit(c); }, (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exit(2);
  });
}
