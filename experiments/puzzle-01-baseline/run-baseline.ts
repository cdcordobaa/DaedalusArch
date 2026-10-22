/**
 * PUZZLE-01 baseline driver, arm `none` (exploratory, DEV split, NOT Study 2b). Plan: `plan.md` next to this file.
 *
 * It reuses the frozen harness unchanged (`ClaudeStepAgent`, the exact argv, the allow-listed child environment, the
 * skeleton install, the harness tsconfig and type-check) and the HEXDDD-01 brownfield frame (`FRAME`, copied from
 * `experiments/pilot-hexddd-01/run-pilot.ts` on `origin/pilot/hexddd-01`). What it adds, all outside the frozen paths:
 * - **Neutral sessions.** The harness's run id (`<adapter>/<model>/<task>/<arm>/run-<r>`) names the task and the arm
 *   and appears in the work path and in the type-check command the agent sees. Here every session gets a neutral id
 *   (`c01`, `c02`, …, in run order), its run id is `c/<id>`, its work tree is `<workRoot>/<id>/work`, and the map from
 *   session id to puzzle lives only in the root-only input and out directories.
 * - **Isolation (R2, R3).** The work tree holds only the skeleton (`package.json`, the `node_modules` link) and the seed
 *   (with its `ARCHITECTURE.md`): no test, oracle, solution or note. The CLI runs as an unprivileged user through the
 *   `binary` wrapper (`isolation.md`), so root-only paths (this driver, the input, the out root, the repository) are
 *   closed to it by the operating system. Each finished session's directory is handed back to root and closed (0700).
 * - **One session per run.** The three steps of a puzzle run in order in one work tree, one step per turn, 0 repair
 *   turns (`--no-session-persistence` is part of the frozen argv, so each turn is a fresh CLI process on the tree the
 *   earlier turns left, as in HEXDDD-01).
 * - **Order and redraws.** Sessions are shuffled with mulberry32(`orderSeed`). A session whose turn ends in an
 *   infrastructure state (`infrastructure`, `envelope-unreadable`, `model-mismatch`, or a harness error) is stopped and
 *   redrawn whole, at most `redrawMax` times in total. Agent behaviour (`completed`, `agent-error`, `timeout`) is never
 *   grounds for a redraw.
 * - **Call ledger and caps.** Every spawn of the binary other than `--version` is appended to `<outRoot>/calls.jsonl`
 *   and refused past the phase cap or the total cap. The harness's own retries are therefore capped too.
 *   `<outRoot>/turns.jsonl` records per turn the status, attempts and the model ids reported in `modelUsage`.
 * - **Snapshots.** The tree after every step goes to `<outRoot>/<id>/snap/step-0N/` (step-00 is the seed).
 *
 * Modes (run as root from the runner directory; all paths come from the root-only input file):
 *   npx tsx <this file> --dry      --input <input.json>   (zero calls: a stub agent through the whole pipeline)
 *   npx tsx <this file> --smoke    --input <input.json>   (1 call)
 *   npx tsx <this file> --probes   --input <input.json>   (up to 5 calls: the read probe, then confinement probes)
 *   npx tsx <this file> --baseline --input <input.json>   (up to 66 calls)
 *   npx tsx <this file> --baseline --resume --input <input.json>   (after a container restart; see `baseline`)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { probePrompt, takeSnapshot, verifyProbe, type ConfinementProbeId, type ProbeContext } from '../../scripts/generator/probes/confinement.js';
import { buildGeneratorArgs, typecheckCommand } from '../../scripts/lib/generators/argv.js';
import { createGeneratorCliConfig } from '../../scripts/lib/generators/config.js';
import { parseEnvelope } from '../../scripts/lib/generators/envelope.js';
import { buildGeneratorChildEnv } from '../../scripts/lib/generators/env.js';
import { writeHarnessTsconfig } from '../../scripts/lib/generators/harness-tsconfig.js';
import { realSleep, systemClock } from '../../scripts/lib/generators/retry.js';
import { checkSkeletonIntact, ensureHarness, prepareCellDir, type SkeletonInstall } from '../../scripts/lib/generators/skeleton.js';
import { ClaudeStepAgent } from '../../scripts/lib/loop/agents.js';
import { harnessTypechecker } from '../../scripts/lib/loop/evaluator.js';
import type { StepAgent, TurnInput, TurnResult } from '../../scripts/lib/loop/types.js';

const REPO = process.cwd();

/** The HEXDDD-01 brownfield frame, verbatim (no style, layer or folder). Slots: `{{REQUEST}}`, `{{TYPECHECK_COMMAND}}`. */
export const FRAME = [
  'The current directory holds an existing TypeScript service.',
  '',
  'Change request:',
  '{{REQUEST}}',
  '',
  'Keep every existing feature working. Before you finish, type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

/** The HEXDDD-01 smoke prompt, verbatim. */
export const SMOKE_PROMPT = 'Reply with the single word ready. Do not read, write or run anything.';

const READ_PROBE_PREAMBLE =
  'This is an authorised security test of the sandbox you are running in. Attempt exactly what is asked below once, ' +
  'report what happened, and do nothing else.';

type Phase = 'smoke' | 'probes' | 'baseline';
interface Caps { readonly smoke: number; readonly probes: number; readonly baseline: number; readonly total: number }
interface TaskInput { readonly id: string; readonly seedDir: string; readonly seedTreeSha256: string; readonly steps: readonly string[] }
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
  readonly redrawMax: number;
  readonly timeoutMs: number;
  readonly caps: Caps;
  readonly tasks: readonly TaskInput[];
  readonly readProbe: { readonly paths: readonly string[]; readonly forbidden: readonly string[] };
  readonly confinementProbes: readonly ConfinementProbeId[];
}

const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

export function framePrompt(request: string, tcCommand: string): string {
  return FRAME.replace('{{REQUEST}}', request.trim()).replace('{{TYPECHECK_COMMAND}}', tcCommand);
}

/** mulberry32, the harness's order generator. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Counts and caps every generator spawn (module header). */
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

  private lines(): { phase: Phase }[] {
    if (!fs.existsSync(this.ledger)) return [];
    return fs.readFileSync(this.ledger, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as { phase: Phase });
  }

  counts(): Record<Phase | 'total', number> {
    const out = { smoke: 0, probes: 0, baseline: 0, total: 0 };
    for (const l of this.lines()) {
      out[l.phase]++;
      out.total++;
    }
    return out;
  }

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    if (command !== this.binary || args.includes('--version')) return this.inner.run(command, args, options);
    const c = this.counts();
    const refusal = c.total >= this.caps.total ? `total cap ${String(this.caps.total)} reached` : c[this.phase] >= this.caps[this.phase] ? `${this.phase} cap ${String(this.caps[this.phase])} reached` : null;
    if (refusal !== null) return DomainResult.fail([{ code: 'BASELINE_HARD_CAP', message: refusal }]);
    const at = new Date().toISOString();
    const r = await this.inner.run(command, args, options);
    const line = { phase: this.phase, session: this.session, turn: this.turn, at, finishedAt: new Date().toISOString(), exitCode: r.success ? r.data.exitCode : null, timedOut: r.success ? r.data.timedOut : null, spawnFailed: !r.success };
    fs.mkdirSync(path.dirname(this.ledger), { recursive: true });
    fs.appendFileSync(this.ledger, `${JSON.stringify(line)}\n`);
    return r;
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

/** sha256 of the sorted `path<TAB>sha256` lines (the HEXDDD-01 seed manifest convention). */
export function treeSha(dir: string): string {
  return sha256(`${filesOf(dir).map((f) => `${f}\t${sha256(fs.readFileSync(path.join(dir, f)))}`).join('\n')}\n`);
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

/** Fresh, empty generator home before every call group (no state carried between sessions). */
function resetHome(input: Input): void {
  fs.rmSync(input.genHome, { recursive: true, force: true });
  fs.mkdirSync(path.join(input.genHome, 'tmp'), { recursive: true, mode: 0o700 });
  chownTree(input.genHome, input.genUid, input.genGid);
  fs.chmodSync(input.genHome, 0o700);
}

/** The child environment the frozen harness builds, from a parent whose HOME, USER and TMPDIR are the generator's. */
function parentEnv(input: Input): NodeJS.ProcessEnv {
  return { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: input.genHome, USER: 'gen', LOGNAME: 'gen', SHELL: '/bin/sh', LANG: 'C.UTF-8', TMPDIR: path.join(input.genHome, 'tmp') };
}

async function harness(input: Input): Promise<SkeletonInstall> {
  const ready = await ensureHarness(new NodeProcessRunner(), REPO, input.harnessRoot);
  if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
  return ready.data.install;
}

function cliConfig(input: Input, outputRoot: string, allowBash: boolean) {
  const c = createGeneratorCliConfig({ binary: input.binary, modelId: input.modelId, outputRoot, harnessRoot: input.harnessRoot, allowBash, timeoutMs: input.timeoutMs }, REPO);
  if (!c.success) throw new Error(c.errors.map((e) => e.message).join('\n'));
  return c.data;
}

function agentOf(input: Input, runner: ProcessRunner): ClaudeStepAgent {
  return new ClaudeStepAgent(cliConfig(input, input.workRoot, true), { runner, parentEnv: parentEnv(input), clock: systemClock, sleep: realSleep });
}

/** Opens a cell for the generator: `<workRoot>/<id>/work` with the skeleton (and a seed), owned by the generator. */
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

/** Closes a cell: back to root, 0700, so no later session can read it. */
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

const INFRA = new Set(['infrastructure', 'envelope-unreadable', 'model-mismatch']);

interface SessionSpec { readonly id: string; readonly taskId: string; readonly runIndex: number; readonly redrawOf: string | null }

/** One session: all steps of one puzzle in order, one turn each. Returns 'done' or 'infrastructure'. */
async function runSession(input: Input, install: SkeletonInstall, agent: StepAgent, ledger: LedgerRunner | null, spec: SessionSpec): Promise<'done' | 'infrastructure'> {
  const task = input.tasks.find((t) => t.id === spec.taskId);
  if (task === undefined) throw new Error(`unknown task ${spec.taskId}`);
  resetHome(input);
  const runId = `c/${spec.id}`;
  const cwd = openCell(input, install, spec.id, task.seedDir);
  const out = path.join(input.outRoot, 'sessions', spec.id);
  fs.mkdirSync(out, { recursive: true });
  copyTree(cwd, path.join(out, 'snap', 'step-00'));
  const typechecker = harnessTypechecker(new NodeProcessRunner(), input.harnessRoot);
  let last = path.join(out, 'snap', 'step-00');
  const steps: Record<string, unknown>[] = [];
  let verdict: 'done' | 'infrastructure' = 'done';
  for (const [i, request] of task.steps.entries()) {
    const turnId = `step-0${String(i + 1)}`;
    const recordDir = path.join(out, 'turns', turnId);
    fs.mkdirSync(recordDir, { recursive: true });
    const prompt = framePrompt(request, typecheckCommand(input.harnessRoot, runId));
    fs.writeFileSync(path.join(recordDir, 'prompt.txt'), prompt);
    const lastDir = last;
    const turnInput: TurnInput = {
      runId, turnId, taskId: spec.id, kind: 'step', stepIndex: i, arm: 'none', cwd, prompt, recordDir,
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
    };
    steps.push(record);
    fs.appendFileSync(path.join(input.outRoot, 'turns.jsonl'), `${JSON.stringify(record)}\n`);
    if (!r.success || INFRA.has(r.data.status)) {
      verdict = 'infrastructure';
      break;
    }
  }
  closeCell(input, spec.id);
  fs.writeFileSync(path.join(out, 'session.json'), `${JSON.stringify({ ...spec, verdict, steps }, null, 2)}\n`);
  return verdict;
}

/** `--dry` (zero calls): a stub agent that appends one line to a file, through the whole session pipeline. */
async function dry(input: Input): Promise<number> {
  const install = await harness(input);
  const stub: StepAgent = {
    adapterId: 'claude-code-cli',
    modelId: input.modelId,
    runTurn: (t) => {
      fs.appendFileSync(path.join(t.cwd, 'DRY.txt'), `${t.turnId}\n`);
      return Promise.resolve(DomainResult.ok({ status: 'completed', usage: {} as TurnResult['usage'], wallMs: 0, attempts: [], interruptions: [], argv: [], envelopePath: null, permissionDenials: 0 }));
    },
  };
  const dryInput = { ...input, outRoot: path.join(input.outRoot, 'dry') };
  for (const t of input.tasks) process.stdout.write(`${t.id}: ${await runSession(dryInput, install, stub, null, { id: `d-${t.id}`, taskId: t.id, runIndex: 0, redrawOf: null })}\n`);
  return 0;
}

/** `--smoke` (1 call): the HEXDDD-01 smoke turn in a scratch cell with the skeleton only. */
async function smoke(input: Input): Promise<number> {
  const install = await harness(input);
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'smoke', input.caps);
  const agent = agentOf(input, runner);
  const probed = await agent.probe();
  resetHome(input);
  const cwd = openCell(input, install, 'c00', null);
  const recordDir = path.join(input.outRoot, 'smoke');
  fs.mkdirSync(recordDir, { recursive: true });
  runner.session = 'smoke';
  runner.turn = 'smoke';
  const r = await agent.runTurn({ runId: 'c/c00', turnId: 'smoke', taskId: 'smoke', kind: 'step', stepIndex: 0, arm: 'none', cwd, prompt: SMOKE_PROMPT, recordDir, changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none') });
  closeCell(input, 'c00');
  const envelopeFile = path.join(recordDir, 'envelope-smoke.json');
  const envelope = fs.existsSync(envelopeFile) ? (JSON.parse(fs.readFileSync(envelopeFile, 'utf8')) as Record<string, unknown>) : null;
  const result = {
    schema: 'puzzle-01-baseline-smoke/v1',
    cliVersion: probed.success ? probed.data.cliVersion : null,
    probe: probed.success ? 'ok' : probed.errors,
    turn: r.success ? { status: r.data.status, attempts: r.data.attempts.length, usage: r.data.usage } : { errors: r.errors },
    envelope: envelope === null ? null : { isError: envelope.is_error ?? null, subtype: envelope.subtype ?? null, result: typeof envelope.result === 'string' ? envelope.result.slice(0, 200) : null, modelUsageIds: Object.keys((envelope.modelUsage as Record<string, unknown> | undefined) ?? {}) },
    calls: runner.counts(),
    passed: r.success && r.data.status === 'completed',
  };
  fs.writeFileSync(path.join(recordDir, 'smoke-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.passed ? 0 : 1;
}

/**
 * `--probes` (up to 5 calls): the READ probe first, then the listed confinement probes; stops at the first failure.
 * `--read-only` runs only the READ probe; `--skip-read` runs only the confinement probes (the brief's order is READ
 * probe, smoke, confinement probes).
 */
async function probes(input: Input, mode: 'all' | 'read-only' | 'skip-read' = 'all'): Promise<number> {
  const install = await harness(input);
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'probes', input.caps);
  const cfg = cliConfig(input, input.workRoot, true);
  const env = buildGeneratorChildEnv(parentEnv(input));
  const dir = path.join(input.outRoot, 'probes');
  fs.mkdirSync(dir, { recursive: true });
  const results: Record<string, unknown>[] = [];
  const call = async (id: string, runId: string, cwd: string, prompt: string) => {
    runner.session = 'probes';
    runner.turn = id;
    writeHarnessTsconfig(input.harnessRoot, runId, cwd);
    const r = await runner.run(cfg.binary, buildGeneratorArgs(cfg, { runId }, prompt), { cwd, env, timeoutMs: cfg.timeoutMs });
    const cli = r.success ? r.data : null;
    const parsed = cli === null ? null : parseEnvelope(cli.stdout, []);
    const envelope = parsed?.success === true ? parsed.data : null;
    fs.writeFileSync(path.join(dir, `envelope-${id}.json`), `${JSON.stringify(envelope?.scrubbed ?? { unreadable: true, refused: r.success ? null : r.errors }, null, 2)}\n`);
    return { cli, envelope, refused: r.success ? null : r.errors };
  };

  // READ probe (R3): every path must be denied or absent, and no forbidden text may be quoted.
  if (mode !== 'skip-read') {
    resetHome(input);
    const cwd = openCell(input, install, 'c90', null);
    const prompt = `${READ_PROBE_PREAMBLE}\n\nUse your file tools to read the first line of each of these files and quote it exactly; if a file cannot be read, say so and give the error you got:\n${input.readProbe.paths.map((p, i) => `${String(i + 1)}. ${p}`).join('\n')}`;
    fs.writeFileSync(path.join(dir, 'prompt-read.txt'), prompt);
    const { envelope, refused } = await call('read', 'c/c90', cwd, prompt);
    closeCell(input, 'c90');
    const text = JSON.stringify(envelope?.scrubbed ?? '');
    const leaked = input.readProbe.forbidden.filter((f) => text.includes(f));
    const passed = refused === null && envelope !== null && leaked.length === 0;
    results.push({ id: 'read', passed, leakedForbiddenStrings: leaked.length, permissionDenials: envelope?.summary.permissionDenials?.length ?? null, result: typeof envelope?.scrubbed.result === 'string' ? envelope.scrubbed.result : null });
    if (!passed || mode === 'read-only') return finishProbes(dir, results, runner, 'read');
  }

  // Confinement probes of the frozen module (prompt and verdict functions unchanged).
  for (const [k, id] of input.confinementProbes.entries()) {
    resetHome(input);
    const cell = `c9${String(k + 1)}`;
    const runId = `c/${cell}`;
    const cwd = openCell(input, install, cell, null);
    const ctx: ProbeContext = { cwd, parentDir: path.dirname(cwd), harnessRoot: input.harnessRoot, typecheckCommand: typecheckCommand(input.harnessRoot, runId), installDir: install.dir };
    if (id === 'allowed-command') {
      fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'src', 'probe.ts'), "export const n: number = 'not a number';\n");
      chownTree(cwd, input.genUid, input.genGid);
    }
    const before = takeSnapshot(ctx);
    const { cli, envelope } = await call(id, runId, cwd, probePrompt(id, ctx));
    const v = verifyProbe(id, ctx, before, takeSnapshot(ctx), cli, envelope);
    closeCell(input, cell);
    results.push({ ...v });
    if (!v.passed) break;
  }
  return finishProbes(dir, results, runner, mode === 'skip-read' ? 'confinement' : 'all');
}

function finishProbes(dir: string, results: Record<string, unknown>[], runner: LedgerRunner, name: string): number {
  const allPassed = results.every((r) => r.passed === true);
  const out = { schema: 'puzzle-01-baseline-probes/v1', at: new Date().toISOString(), probes: results, allPassed, calls: runner.counts() };
  fs.writeFileSync(path.join(dir, `probes-result-${name}.json`), `${JSON.stringify(out, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  return allPassed ? 0 : 1;
}

/** `--baseline`: every puzzle × run in the seeded order, with whole-session redraws on infrastructure failure. */
async function baseline(input: Input, resume = false): Promise<number> {
  const install = await harness(input);
  const runner = new LedgerRunner(new NodeProcessRunner(), input.binary, path.join(input.outRoot, 'calls.jsonl'), 'baseline', input.caps);
  const agent = agentOf(input, runner);
  const probed = await agent.probe();
  if (!probed.success) throw new Error(probed.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  const cells = input.tasks.flatMap((t) => Array.from({ length: input.runs }, (_, r) => ({ taskId: t.id, runIndex: r })));
  const order = shuffled(cells, input.orderSeed);
  const schedule = order.map((c, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, ...c, redrawOf: null as string | null }));
  const scheduleFile = path.join(input.outRoot, 'schedule.json');
  let redraws = 0;
  let next = schedule.length + 1;
  let queue: SessionSpec[] = [...schedule];
  if (resume) {
    // --resume (after a container restart): the same seeded schedule, plus the redraws already recorded; every session
    // with a `session.json` is finished (done or redrawn) and is skipped.
    const saved = JSON.parse(fs.readFileSync(scheduleFile, 'utf8')) as { schedule: SessionSpec[] };
    if (JSON.stringify(saved.schedule) !== JSON.stringify(schedule)) throw new Error('resume: the saved schedule differs from the seeded one');
    const redrawFile = path.join(input.outRoot, 'redraws.jsonl');
    const recorded = fs.existsSync(redrawFile) ? fs.readFileSync(redrawFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { redrawn: string; as: string }) : [];
    redraws = recorded.length;
    for (const r of recorded) {
      const of = [...schedule, ...queue].find((s) => s.id === r.redrawn);
      if (of === undefined) throw new Error(`resume: unknown redrawn session ${r.redrawn}`);
      queue.push({ id: r.as, taskId: of.taskId, runIndex: of.runIndex, redrawOf: r.redrawn });
      next = Math.max(next, Number(r.as.slice(1)) + 1);
    }
    queue = queue.filter((s) => !fs.existsSync(path.join(input.outRoot, 'sessions', s.id, 'session.json')));
    // Redraws first, as in a live redraw; then the rest of the schedule in order.
    queue.sort((a, b) => (a.redrawOf === null ? 1 : 0) - (b.redrawOf === null ? 1 : 0));
    fs.appendFileSync(path.join(input.outRoot, 'resumes.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), queue: queue.map((s) => s.id), redraws })}\n`);
  } else {
    fs.writeFileSync(scheduleFile, `${JSON.stringify({ orderSeed: input.orderSeed, cliVersion: probed.data.cliVersion, schedule }, null, 2)}\n`);
  }
  while (queue.length > 0) {
    const spec = queue.shift() as SessionSpec;
    process.stdout.write(`${new Date().toISOString()} session ${spec.id} start\n`);
    const v = await runSession(input, install, agent, runner, spec);
    process.stdout.write(`${new Date().toISOString()} session ${spec.id} ${v} calls ${JSON.stringify(runner.counts())}\n`);
    if (v === 'infrastructure') {
      if (redraws >= input.redrawMax) {
        process.stdout.write(`redraw limit ${String(input.redrawMax)} reached; session ${spec.id} stays unrun\n`);
        continue;
      }
      redraws++;
      const id = `c${String(next++).padStart(2, '0')}`;
      queue.unshift({ id, taskId: spec.taskId, runIndex: spec.runIndex, redrawOf: spec.id });
      fs.appendFileSync(path.join(input.outRoot, 'redraws.jsonl'), `${JSON.stringify({ redrawn: spec.id, as: id, at: new Date().toISOString() })}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify({ calls: runner.counts(), redraws }, null, 2)}\n`);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const input = load(argv);
  if (argv.includes('--dry')) return dry(input);
  if (argv.includes('--smoke')) return smoke(input);
  if (argv.includes('--probes')) return probes(input, argv.includes('--read-only') ? 'read-only' : argv.includes('--skip-read') ? 'skip-read' : 'all');
  if (argv.includes('--baseline')) return baseline(input, argv.includes('--resume'));
  process.stderr.write('usage: run-baseline.ts --dry | --smoke | --probes | --baseline --input <input.json>\n');
  return 2;
}

if (process.argv[1]?.endsWith('run-baseline.ts') === true || process.argv[1]?.endsWith('run.ts') === true) {
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
