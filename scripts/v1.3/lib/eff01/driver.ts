/**
 * EFF-01 driver (design DR-3, DR-5, DR-13 to DR-16, DR-24 to DR-30; A1 §2.9).
 *
 * Order of an invocation: flag checks and the live guard (nothing is spawned before they pass; `NodeProcessRunner` is
 * constructed only after), the isolation and build checks, the `--version` probe, the pin check and tree export per
 * repo, `plan.json` (written once; a later invocation must reproduce it byte for byte), then the selected blocks:
 * calibration and pilot on lane 0 in order, the pilot gate, main and N over at most two lanes. Re-runs, the
 * second-leak stop and the spawn budget apply throughout. Exit codes: 0 ok, 1 gate, leak or budget stop, 2 setup error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { isInsideOrEqual } from '../../../lib/generators/config.js';
import { DEFAULT_RETRY_POLICY, realSleep, systemClock } from '../../../lib/generators/retry.js';
import type { Clock, RetryPolicy, Sleeper } from '../../../lib/generators/retry.js';
import { checkIsolationBeforeSpawn, checkIsolationPaths, isolatedClaudeEnv, parseCliVersion } from '../../../lib/loop/isolation.js';
import { architectureBlock, loadEff01Inputs, sha256Hex } from './inputs.js';
import type { Eff01Inputs } from './inputs.js';
import { countSessions, planSessions, serialisePlan, sessionsOfBlocks } from './plan.js';
import type { Eff01Plan } from './plan.js';
import { buildPrompt, CALIBRATION_PROMPT, FRAME_SHA256 } from './prompt.js';
import { redactPaths, redactRoots } from './redact.js';
import type { RedactRoot } from './redact.js';
import { extractAnswer, normaliseKey, readRecord } from './score.js';
import { createSpawnBudget, runSession, sessionDirOf, SESSION_FILES } from './session.js';
import type { SessionContext, SessionInput, SpawnBudget } from './session.js';
import { StubEff01Runner } from './stub-runner.js';
import type { StubBehaviour, StubOptions } from './stub-runner.js';
import { localCheckProblem } from './local-check.js';
import { checkPin, exportTree, treeFingerprint } from './trees.js';
import { CAP_TOKENS, CAP_TURNS, CAP_WALL_MS, DEFAULT_CLI_VERSION, DEFAULT_MODEL, EFF01_BLOCKS } from './types.js';
import type { Eff01Block, Eff01Condition, SessionRecord, SessionSpec } from './types.js';

export const DRY_CLAUDE_BINARY = '/stub/claude';
export const PILOT_GATE_FILE = 'pilot-gate.json';
export const DEFAULT_FIXTURE_TREE_REL = 'tests/fixtures/eff01/tree-mini';

export interface DriverOptions {
  readonly repoRoot: string;
  readonly out?: string;
  readonly harness?: string;
  readonly clones?: string;
  readonly blocks?: readonly Eff01Block[] | 'all';
  readonly runs?: number;
  readonly withN?: boolean;
  readonly lanes?: number;
  readonly live?: boolean;
  readonly confirmSessions?: number;
  readonly rerunAllowance?: number;
  readonly questionsSha256?: string;
  readonly claude?: string;
  readonly configDir?: string;
  readonly model?: string;
  readonly cliVersion?: string;
  readonly serverEntry?: string;
  readonly nodeBinary?: string;
  readonly stripSpecComments?: boolean;
  readonly calibrationRepo?: string;
  /** Dry run only. */
  readonly behaviour?: StubBehaviour | ((sessionId: string, condition: Eff01Condition) => StubBehaviour);
  readonly fixtureTree?: string;
  readonly outsidePath?: string;
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly clock?: Clock;
  readonly sleep?: Sleeper;
  readonly policy?: RetryPolicy;
  /** Live only: the runner to use instead of `NodeProcessRunner` (tests). Called only after the guard passes. */
  readonly runnerFactory?: () => ProcessRunner;
  readonly log?: (line: string) => void;
}

export interface DriverResult {
  readonly exitCode: 0 | 1 | 2;
  readonly messages: readonly string[];
  readonly runner: ProcessRunner | null;
  readonly sessionsRun: number;
  readonly spawnBudgetUsed: number;
}

interface PilotGate {
  readonly schema: 'eff-01-pilot-gate/v1';
  readonly planSha256: string;
  readonly pass: boolean;
  readonly leaks: readonly string[];
  readonly formatFailures: readonly string[];
  readonly maxTurnsRejected: readonly string[];
  readonly sessions: number;
}

function inside(parent: string, child: string): boolean {
  return isInsideOrEqual(parent, child);
}

export function knownSecretsOf(env: NodeJS.ProcessEnv): readonly string[] {
  return Object.entries(env)
    .flatMap(([k, v]) => (/(KEY|TOKEN|SECRET|PASSWORD)$/i.test(k) && typeof v === 'string' && v.length >= 8 ? [v] : []));
}

function selectedBlocks(b: DriverOptions['blocks']): readonly Eff01Block[] {
  if (b === undefined || b === 'all') return EFF01_BLOCKS;
  return EFF01_BLOCKS.filter((x) => b.includes(x));
}

export interface SessionPrompts {
  readonly promptOf: (s: SessionSpec) => string;
  readonly archBlocks: Readonly<Record<string, string>>;
  readonly specShas: Readonly<Record<string, string>>;
  /** Prompt text → the session's repo and question (the stub's lookup). */
  readonly lookup: ReadonlyMap<string, { readonly repoId: string; readonly questionId: string | null }>;
}

/** The prompt of every planned session (DR-6, DR-7), the architecture blocks and the spec hashes. */
export function sessionPrompts(repoRoot: string, inputs: Eff01Inputs, plan: Eff01Plan, stripSpecComments: boolean): DomainResult<SessionPrompts> {
  const archBlocks: Record<string, string> = {};
  const specShas: Record<string, string> = {};
  for (const repo of inputs.repos) {
    const specPath = path.join(repoRoot, repo.spec);
    if (!fs.existsSync(specPath)) return DomainResult.fail([{ code: 'EFF01_SPEC', message: `spec ${repo.spec} is missing` }]);
    const text = fs.readFileSync(specPath, 'utf8');
    const block = architectureBlock(text, { stripComments: stripSpecComments });
    if (!block.success) return DomainResult.fail([{ code: 'EFF01_SPEC', message: `${repo.spec}: ${block.errors.map((e) => e.message).join('; ')}` }]);
    archBlocks[repo.id] = block.data;
    specShas[repo.id] = sha256Hex(text);
  }
  const promptOf = (s: SessionSpec): string => {
    if (s.questionId === null) return CALIBRATION_PROMPT;
    const q = inputs.questionById.get(s.questionId);
    if (q === undefined) throw new Error(`unknown question ${s.questionId}`);
    return buildPrompt({ condition: s.condition, archBlock: archBlocks[s.repoId] ?? '', conventions: inputs.conventions, question: q });
  };
  const lookup = new Map<string, { repoId: string; questionId: string | null }>();
  for (const s of plan.sessions) lookup.set(promptOf(s), { repoId: s.repoId, questionId: s.questionId });
  return DomainResult.ok({ promptOf, archBlocks, specShas, lookup });
}

/** The dry-run stub over the committed pins and key (also used by tests as a live-mode runner, zero calls). */
export function makeStubRunner(
  inputs: Eff01Inputs,
  prompts: Pick<SessionPrompts, 'lookup'>,
  o: Pick<StubOptions, 'fixtureTree' | 'model' | 'cliVersion' | 'behaviour' | 'outsidePath'>,
): StubEff01Runner {
  return new StubEff01Runner({
    ...o,
    pins: Object.fromEntries(inputs.repos.map((r) => [r.id, r.sha])),
    lookup: (p) => prompts.lookup.get(p),
    keyFor: (qid) => {
      const q = inputs.questionById.get(qid);
      const k = inputs.keys.get(qid);
      return q === undefined || k === undefined ? undefined : normaliseKey(q.template, k.answer);
    },
  });
}

export async function runEff01(opts: DriverOptions): Promise<DriverResult> {
  const messages: string[] = [];
  const say = (m: string): void => {
    messages.push(m);
    opts.log?.(m);
  };
  const result = (exitCode: 0 | 1 | 2, extra: Partial<DriverResult> = {}): DriverResult => ({ exitCode, messages, runner: null, sessionsRun: 0, spawnBudgetUsed: 0, ...extra });
  const setup = (m: string): DriverResult => {
    say(`setup error: ${m}`);
    return result(2);
  };

  const live = opts.live === true;
  const repoRoot = path.resolve(opts.repoRoot);
  const blocks = selectedBlocks(opts.blocks);
  const lanes = opts.lanes ?? 1;
  const parentEnv = opts.parentEnv ?? process.env;
  const clock = opts.clock ?? systemClock;
  const sleep = opts.sleep ?? realSleep;
  const model = opts.model ?? DEFAULT_MODEL;
  const cliVersion = opts.cliVersion ?? DEFAULT_CLI_VERSION;

  // ── 1. Flags and the live guard (DR-30): nothing is spawned before these pass. ─────────────────────────────────
  if (opts.out === undefined) return setup('--out <run dir> is required');
  if (opts.harness === undefined || !path.isAbsolute(opts.harness)) return setup('--harness <abs dir> is required');
  if (opts.clones === undefined || !path.isAbsolute(opts.clones)) return setup('--clones <abs dir> is required');
  if (lanes !== 1 && lanes !== 2) return setup('--lanes must be 1 or 2');
  if (blocks.length === 0) return setup('--block selects no block');
  const runDir = path.resolve(opts.out);
  const harness = path.resolve(opts.harness);
  const clones = path.resolve(opts.clones);
  if (inside(repoRoot, harness)) return setup('--harness must lie outside the repository');
  if (inside(harness, runDir) || inside(runDir, harness)) return setup('--out and --harness must not contain each other');
  const loaded = loadEff01Inputs(repoRoot);
  if (!loaded.success) return setup(loaded.errors.map((e) => e.message).join('; '));
  const inputs = loaded.data;
  const planned = planSessions({ inputs, ...(opts.runs !== undefined ? { runs: opts.runs } : {}), ...(opts.withN !== undefined ? { withN: opts.withN } : {}), ...(opts.calibrationRepo !== undefined ? { calibrationRepo: opts.calibrationRepo } : {}) });
  if (!planned.success) return setup(planned.errors.map((e) => e.message).join('; '));
  const plan = planned.data;
  const n = countSessions(plan, blocks).total;

  let budgetLimit = Number.POSITIVE_INFINITY;
  if (live) {
    if (opts.blocks === 'all' || blocks.length === EFF01_BLOCKS.length) return setup('--live --block all is refused: the pilot gate must be seen before main (run --block pilot first)');
    if (blocks.includes('pilot') && (blocks.includes('main') || blocks.includes('n'))) return setup('--live cannot run the pilot together with main or n');
    if (opts.confirmSessions === undefined) return setup('--live needs --confirm-sessions <n>');
    if (opts.confirmSessions !== n) return setup(`--confirm-sessions ${String(opts.confirmSessions)} differs from the ${String(n)} sessions the selected blocks plan`);
    if (opts.questionsSha256 !== inputs.sha256.questions) return setup('--questions-sha256 is missing or differs from experiments/eff-01/questions.json');
    if (opts.claude === undefined || !path.isAbsolute(opts.claude)) return setup('--live needs --claude <abs path>');
    if (opts.configDir === undefined || !path.isAbsolute(opts.configDir)) return setup('--live needs --config-dir <abs dir>');
    if (opts.behaviour !== undefined || opts.fixtureTree !== undefined) return setup('--behaviour and --fixture-tree are dry-run only');
    if (blocks.includes('main') || blocks.includes('n')) {
      const gateFile = path.join(runDir, PILOT_GATE_FILE);
      const planFile = path.join(runDir, 'plan.json');
      if (!fs.existsSync(gateFile) || !fs.existsSync(planFile)) return setup(`--block main/n needs a passing ${PILOT_GATE_FILE} in the run dir`);
      const gate = JSON.parse(fs.readFileSync(gateFile, 'utf8')) as Partial<PilotGate>;
      if (gate.pass !== true || gate.planSha256 !== sha256Hex(fs.readFileSync(planFile))) return setup(`${PILOT_GATE_FILE} does not show a pass for this plan`);
    }
    const allowance = opts.rerunAllowance ?? Math.ceil(0.1 * n);
    if (!Number.isInteger(allowance) || allowance < 0) return setup('--rerun-allowance must be a non-negative integer');
    budgetLimit = n + allowance;
    say(`live: ${String(n)} sessions approved, re-run allowance ${String(allowance)}, spawn budget ${String(budgetLimit)}`);
  } else {
    if (opts.claude !== undefined) return setup('--claude is live only');
    if (opts.configDir !== undefined) return setup('--config-dir is live only');
    if (opts.confirmSessions !== undefined) return setup('--confirm-sessions is live only');
    if (opts.rerunAllowance !== undefined) return setup('--rerun-allowance is live only');
    if (inside(path.join(repoRoot, 'experiments'), runDir)) return setup('a dry run never writes into experiments/ (choose --out elsewhere)');
  }

  const nodeBinary = opts.nodeBinary ?? process.execPath;
  const serverEntry = opts.serverEntry ?? path.join(repoRoot, 'dist/mcp-server/main.js');
  const fixtureTree = opts.fixtureTree ?? path.join(repoRoot, DEFAULT_FIXTURE_TREE_REL);

  const prompts = sessionPrompts(repoRoot, inputs, plan, opts.stripSpecComments === true);
  if (!prompts.success) return setup(prompts.errors.map((e) => e.message).join('; '));
  const { promptOf, archBlocks, specShas } = prompts.data;

  // ── 2. The runner: live constructs NodeProcessRunner only now; a dry run only the stub. ───────────────────────
  const runner: ProcessRunner = live
    ? (opts.runnerFactory?.() ?? new NodeProcessRunner())
    : makeStubRunner(inputs, prompts.data, {
        fixtureTree,
        model,
        cliVersion,
        ...(opts.behaviour !== undefined ? { behaviour: opts.behaviour } : {}),
        ...(opts.outsidePath !== undefined ? { outsidePath: opts.outsidePath } : {}),
      });
  const done = (exitCode: 0 | 1 | 2, extra: Partial<DriverResult> = {}): DriverResult => result(exitCode, { runner, ...extra });
  const claudeBinary = live ? (opts.claude ?? '') : DRY_CLAUDE_BINARY;

  // ── 3. Isolation and build checks. ─────────────────────────────────────────────────────────────────────────────
  let configDir: string;
  if (live) {
    configDir = path.resolve(opts.configDir ?? '');
    const realHome = parentEnv.HOME ?? '';
    const probs = [
      ...checkIsolationPaths({ configDir }, { repoRoot, outRoot: path.join(harness, 'trees'), harnessRoot: harness, realHome }),
      ...checkIsolationPaths({ configDir }, { repoRoot, outRoot: runDir, harnessRoot: harness, realHome }),
    ];
    if (probs.length > 0) return { ...setup([...new Set(probs.map((p) => p.message))].join('; ')), runner };
    if (!fs.existsSync(serverEntry)) return { ...setup(`the MCP server entry is missing (npm run build first)`), runner };
  } else {
    configDir = path.join(harness, 'dry-config');
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.mkdirSync(runDir, { recursive: true });
  const redact: readonly RedactRoot[] = redactRoots({ harnessRoot: harness, repoRoot, clonesDir: clones, configDir, nodeBinary, ...(parentEnv.HOME !== undefined ? { home: parentEnv.HOME } : {}) });
  const knownSecrets = knownSecretsOf(parentEnv);
  const plainEnv: Record<string, string> = { PATH: parentEnv.PATH ?? '/usr/bin:/bin' };

  let commit: string | null = null;
  if (live) {
    const c = await runner.run('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { env: plainEnv, timeoutMs: 30_000 });
    commit = c.success && c.data.exitCode === 0 ? c.data.stdout.trim() : null;
  }

  // ── 4. The version probe (DR-29). ──────────────────────────────────────────────────────────────────────────────
  const probe = async (): Promise<string | null> => {
    const home = path.join(harness, 'probe-home');
    const iso = checkIsolationBeforeSpawn(home, { configDir });
    if (!iso.success) return null;
    const r = await runner.run(claudeBinary, ['--version'], { env: isolatedClaudeEnv(parentEnv, home, { configDir }), timeoutMs: 30_000 });
    return r.success && r.data.exitCode === 0 ? parseCliVersion(r.data.stdout) : null;
  };
  const startedAt = new Date(clock.now()).toISOString();
  const versionStart = await probe();
  if (versionStart !== cliVersion) return { ...setup(`claude --version is ${versionStart ?? 'unreadable'}, the pin is ${cliVersion}`), runner };

  // ── 5. Pins, trees, fingerprints (DR-14, DR-15). ───────────────────────────────────────────────────────────────
  const trees: Record<string, { dir: string; fingerprint: string; specPath: string }> = {};
  for (const repo of inputs.repos) {
    const clone = path.join(clones, repo.id);
    const pin = await checkPin(runner, clone, repo.sha, plainEnv);
    if (!pin.success) return { ...setup(pin.errors.map((e) => e.message).join('; ')), runner };
    const dest = path.join(harness, 'trees', repo.id);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const ex = await exportTree(runner, clone, repo.sha, dest, plainEnv);
    if (!ex.success) return { ...setup(ex.errors.map((e) => e.message).join('; ')), runner };
    trees[repo.id] = { dir: dest, fingerprint: treeFingerprint(dest), specPath: path.join(repoRoot, repo.spec) };
  }

  if (live) {
    const problem = localCheckProblem(runDir, Object.fromEntries(Object.entries(trees).map(([k, v]) => [k, v.fingerprint])));
    if (problem !== null) return { ...setup(problem), runner };
  }

  // ── 6. plan.json (DR-3, DR-28). ────────────────────────────────────────────────────────────────────────────────
  const hashes: Record<string, string> = {
    questions: inputs.sha256.questions,
    answers: inputs.sha256.answers,
    repos: inputs.sha256.repos,
    frame: FRAME_SHA256,
  };
  for (const repo of inputs.repos) {
    hashes[`spec:${repo.id}`] = specShas[repo.id] ?? '';
    hashes[`archBlock:${repo.id}`] = sha256Hex(archBlocks[repo.id] ?? '');
  }
  const planText = redactPaths(
    serialisePlan(plan, {
      model,
      cliVersion,
      caps: { wallMs: CAP_WALL_MS, turns: CAP_TURNS, tokens: CAP_TOKENS },
      hashes,
      treeFingerprints: Object.fromEntries(Object.entries(trees).map(([k, v]) => [k, v.fingerprint])),
      stripSpecComments: opts.stripSpecComments === true,
      dryRun: !live,
    }),
    redact,
  );
  const planFile = path.join(runDir, 'plan.json');
  if (fs.existsSync(planFile)) {
    if (fs.readFileSync(planFile, 'utf8') !== planText) return { ...setup('plan.json in the run dir differs from this invocation\'s plan; refusing to mix runs'), runner };
  } else {
    fs.writeFileSync(planFile, planText);
  }
  const planSha = sha256Hex(planText);

  // ── 7. Sessions. ───────────────────────────────────────────────────────────────────────────────────────────────
  const budget: SpawnBudget = createSpawnBudget(budgetLimit);
  const ctx: SessionContext = {
    runner,
    parentEnv,
    clock,
    sleep,
    policy: opts.policy ?? DEFAULT_RETRY_POLICY,
    claudeBinary,
    model,
    configDir,
    harnessRoot: harness,
    runDir,
    nodeBinary,
    serverEntry,
    knownSecrets,
    redact,
    cliVersionStart: versionStart,
    dryRun: !live,
    hashes: { questions: inputs.sha256.questions, answers: inputs.sha256.answers },
    budget,
  };
  const runLog = path.join(runDir, 'run-log.jsonl');
  const logLine = (v: Record<string, unknown>): void => {
    fs.appendFileSync(runLog, `${JSON.stringify(redactPaths({ ts: new Date(clock.now()).toISOString(), ...v }, redact))}\n`);
  };
  const ranThisInvocation: string[] = [];
  let stop: { code: 1 | 2; message: string } | null = null;
  /** Read through a call: another lane may set `stop` while this one awaits. */
  const currentStop = (): { code: 1 | 2; message: string } | null => stop;

  const inputOf = (s: SessionSpec): SessionInput => {
    const t = trees[s.repoId];
    if (t === undefined) throw new Error(`no tree for ${s.repoId}`);
    return { spec: s, prompt: promptOf(s), treeDir: t.dir, specPath: t.specPath, specSha256: specShas[s.repoId] ?? '', treeFingerprint: t.fingerprint };
  };

  const runAndLog = async (s: SessionSpec): Promise<SessionRecord | null> => {
    logLine({ event: 'start', sessionId: s.sessionId, lane: s.lane });
    const r = await runSession(inputOf(s), ctx);
    if (!r.success) {
      const code = r.errors[0]?.code ?? 'EFF01';
      stop = { code: code === 'EFF01_SPAWN_BUDGET' ? 1 : 2, message: `${s.sessionId}: ${r.errors.map((e) => e.message).join('; ')}` };
      logLine({ event: 'stop', sessionId: s.sessionId, code });
      return null;
    }
    ranThisInvocation.push(s.sessionId);
    logLine({ event: 'end', sessionId: s.sessionId, status: r.data.status, valid: r.data.valid, modelReachingAttempts: r.data.modelReachingAttempts });
    return r.data;
  };

  /** One planned session with resume (DR-5) and one re-run of an invalid session (DR-24). */
  const runOne = async (s: SessionSpec): Promise<void> => {
    if (currentStop() !== null) return;
    let first = readRecord(runDir, s.sessionId) ?? null;
    if (first === null) {
      first = await runAndLog(s);
      if (first === null) return;
    }
    if (first.valid) return;
    if (first.status === 'tree-changed') {
      stop = { code: 1, message: `${s.sessionId}: the tree changed during the session; every later session would see a different project` };
      return;
    }
    if (s.block === 'pilot' && first.status === 'confinement-leak') return;
    const rerunSpec: SessionSpec = { ...s, sessionId: `${s.sessionId}-rerun`, rerun: true };
    let second = readRecord(runDir, rerunSpec.sessionId) ?? null;
    if (second === null) {
      if (currentStop() !== null) return;
      second = await runAndLog(rerunSpec);
      if (second === null) return;
    }
    if (second.valid) return;
    if (second.status === 'confinement-leak' || second.status === 'tree-changed') {
      stop = { code: 1, message: `${s.sessionId}: invalid twice (${second.status}); the run stops` };
    } else {
      say(`${s.sessionId}: invalid twice (${second.status}); the cell is recorded as missing`);
    }
  };

  const runSequential = async (list: readonly SessionSpec[]): Promise<void> => {
    for (const s of list) {
      if (currentStop() !== null) return;
      await runOne(s);
    }
  };
  const runLanes = async (list: readonly SessionSpec[]): Promise<void> => {
    if (lanes === 1) return runSequential(list);
    await Promise.all([0, 1].map((lane) => runSequential(list.filter((s) => s.lane === lane))));
  };

  const finish = async (exitCode: 0 | 1 | 2): Promise<DriverResult> => {
    const versionEnd = await probe();
    const drift = versionEnd !== versionStart;
    for (const id of ranThisInvocation) {
      const file = path.join(sessionDirOf(runDir, id), SESSION_FILES.record);
      const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionRecord;
      fs.writeFileSync(file, `${JSON.stringify({ ...rec, cliVersionEnd: versionEnd, cliDrift: drift }, null, 1)}\n`);
    }
    fs.appendFileSync(
      path.join(runDir, 'invocations.jsonl'),
      `${JSON.stringify(redactPaths({ startedAt, endedAt: new Date(clock.now()).toISOString(), live, blocks, cliVersionStart: versionStart, cliVersionEnd: versionEnd, cliDrift: drift, commit, sessionsRun: ranThisInvocation.length, modelReachingAttempts: budget.used, spawnBudget: Number.isFinite(budget.limit) ? budget.limit : null, exitCode }, redact))}\n`,
    );
    if (drift) say(`CLI drift: ${versionStart} at start, ${versionEnd ?? '?'} at end`);
    return done(exitCode, { sessionsRun: ranThisInvocation.length, spawnBudgetUsed: budget.used });
  };
  const stopped = async (): Promise<DriverResult | null> => {
    const s = currentStop();
    if (s === null) return null;
    say(`stopped: ${s.message}`);
    return finish(s.code);
  };

  const ofBlock = (b: Eff01Block): readonly SessionSpec[] => (blocks.includes(b) ? sessionsOfBlocks(plan, [b]) : []);
  await runSequential(ofBlock('calibration'));
  const s1 = await stopped();
  if (s1 !== null) return s1;

  if (blocks.includes('pilot')) {
    await runSequential(ofBlock('pilot'));
    const s2 = await stopped();
    if (s2 !== null) return s2;
    const gate = pilotGate(runDir, plan, planSha);
    fs.writeFileSync(path.join(runDir, PILOT_GATE_FILE), `${JSON.stringify(gate, null, 1)}\n`);
    say(`pilot gate: ${gate.pass ? 'pass' : 'FAIL'} (leaks ${String(gate.leaks.length)}, format failures ${String(gate.formatFailures.length)}, --max-turns rejected ${String(gate.maxTurnsRejected.length)})`);
    if (!gate.pass) return finish(1);
    if (live) {
      say('live: the pilot gate is written; the main block needs a separate invocation with --block main');
      return finish(0);
    }
  }

  await runLanes(ofBlock('main'));
  const s3 = await stopped();
  if (s3 !== null) return s3;
  await runLanes(ofBlock('n'));
  const s4 = await stopped();
  if (s4 !== null) return s4;
  return finish(0);
}

/** DR-25: no leak, at most 1 of the pilot sessions without a parsable `ANSWER:` line, no rejected `--max-turns`. */
export function pilotGate(runDir: string, plan: Eff01Plan, planSha256: string): PilotGate {
  const leaks: string[] = [];
  const formatFailures: string[] = [];
  const maxTurnsRejected: string[] = [];
  let sessions = 0;
  for (const s of sessionsOfBlocks(plan, ['pilot'])) {
    const rec = readRecord(runDir, `${s.sessionId}-rerun`) ?? readRecord(runDir, s.sessionId);
    const firsts = [readRecord(runDir, s.sessionId), readRecord(runDir, `${s.sessionId}-rerun`)].filter((r): r is SessionRecord => r !== undefined);
    if (rec === undefined) continue;
    sessions++;
    if (firsts.some((r) => r.status === 'confinement-leak')) leaks.push(s.sessionId);
    const parse = extractAnswer(rec.finalText).parse;
    if (parse === 'missing' || parse === 'unparsable') formatFailures.push(s.sessionId);
    if (firsts.some((r) => r.maxTurnsRejected)) maxTurnsRejected.push(s.sessionId);
  }
  return {
    schema: 'eff-01-pilot-gate/v1',
    planSha256,
    pass: leaks.length === 0 && formatFailures.length <= 1 && maxTurnsRejected.length === 0,
    leaks,
    formatFailures,
    maxTurnsRejected,
    sessions,
  };
}
