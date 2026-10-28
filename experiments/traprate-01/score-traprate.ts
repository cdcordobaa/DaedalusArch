/**
 * TRAPRATE-01 scorer (exploratory task screening, arm `none`; plan `experiments/traprate-01/plan.md` §4). Zero model
 * calls, no Neo4j, no network beyond an optional npm cache warm for the skeleton install.
 *
 *   npx tsx experiments/traprate-01/score-traprate.ts [--results results/v1.5-traprate-01] [--node-modules <dir>]
 *        [--harness-root <dir>] [--out <results>/scores] [--sessions c01,c02]
 *
 * Per snapshot it reuses the final-study scorer unchanged (`scoreSessionSteps` of `experiments/v15-study/score-study.ts`):
 * behaviour tests, oracle sub-goals, D_v15 over the ADMITTED rules only, the exploratory rows, the frozen v1.4
 * instrument (D_frozen) and the evasion undo. Here it adds, per step, the frozen instrument's identities new against
 * the seed (edge grain, Study 2b parameters), and aggregates per session, per task and per style.
 *
 * Without `--node-modules`, the skeleton is installed with `ensureHarness` under `--harness-root` (default: a scratch
 * directory), as the study driver does.
 *
 * Outputs (`<out>/`): `sessions.json` (per session and step), `tasks.json`, `summary.json`, `summary.md`.
 * Absolute paths never reach the output.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../src/mcp-server/context.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { loadRules } from '../../src/v15-instrument/index.js';
import { keysFor } from '../../scripts/lib/drift/identity.js';
import { STUDY2_S2D01, type IdFinding } from '../../scripts/lib/drift/types.js';
import { ensureHarness } from '../../scripts/lib/generators/skeleton.js';
import { engineDeps, engineEnv } from '../../scripts/lib/loop/engine-tee.js';
import { admittedRules, exploratoryRules, newAgainst, scoreSessionSteps, type SessionScoringContext, type Style } from '../v15-study/score-study.js';

const REPO = process.cwd();

// ── Snapshot restoration ──────────────────────────────────────────────────────────────────────────────────────
// The committed snapshots lack every directory named `out/` (the repository's `.gitignore` rule for build output
// matched `application/ports/out/` and `adapters/out/` under `results/`). The diffs (`diffs/<s>/step-0N.diff`) are
// complete. Each snapshot is rebuilt in a scratch copy: step-00 = the committed step-00 plus the task seed's files it
// lacks; step-N = step-(N-1) with the step's diff applied. Every rebuilt tree must match the tree sha256 the driver
// recorded (`input.json` for the seed, `session.json` per step), or scoring stops.

function filesOf(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (rel === '' && (e.name === 'node_modules' || e.name === '.git')) continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.push(r);
    }
  };
  walk('');
  return out.sort();
}
const sha256 = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
/** The driver's tree hash (`treeSha` of `experiments/puzzle-01-baseline/run-baseline.ts`). */
export const treeSha = (dir: string, skip: (f: string) => boolean = () => false): string => sha256(`${filesOf(dir).filter((f) => !skip(f)).map((f) => `${f}\t${sha256(fs.readFileSync(path.join(dir, f)))}`).join('\n')}\n`);
function copyFiles(from: string, to: string, only?: (f: string) => boolean): number {
  let n = 0;
  for (const f of filesOf(from)) {
    if (only !== undefined && !only(f)) continue;
    fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
    fs.copyFileSync(path.join(from, f), path.join(to, f));
    n++;
  }
  return n;
}

export interface RestoreReport { readonly session: string; readonly filesAddedToSeed: number; readonly verified: boolean[] }

/** Rebuilds `<dest>/<id>/snap/step-00..n` and copies `session.json`; throws on any tree hash mismatch. */
export function restoreSession(results: string, id: string, seedDir: string, seedSha: string, dest: string): RestoreReport {
  const src = path.join(results, 'sessions', id);
  const sess = JSON.parse(fs.readFileSync(path.join(src, 'session.json'), 'utf8')) as { steps: { step: string; treeSha256: string }[] };
  const out = path.join(dest, id);
  fs.mkdirSync(path.join(out, 'snap'), { recursive: true });
  fs.copyFileSync(path.join(src, 'session.json'), path.join(out, 'session.json'));
  const s0 = path.join(out, 'snap', 'step-00');
  copyFiles(path.join(src, 'snap', 'step-00'), s0);
  const added = copyFiles(seedDir, s0, (f) => !fs.existsSync(path.join(s0, f)));
  // The seed pin is the task seed alone; the cell also holds the skeleton's package.json (the driver's cell setup).
  const verified: boolean[] = [treeSha(s0, (f) => f === 'package.json') === seedSha];
  if (!verified[0]) throw new Error(`${id}: rebuilt seed does not match the pinned seed tree sha256`);
  for (const [k, st] of sess.steps.entries()) {
    const prev = path.join(out, 'snap', `step-0${String(k)}`);
    const cur = path.join(out, 'snap', `step-0${String(k + 1)}`);
    copyFiles(prev, cur);
    const diff = path.join(results, 'diffs', id, `step-0${String(k + 1)}.diff`);
    if (fs.statSync(diff).size > 0) execFileSync('git', ['apply', '-p2', '--whitespace=nowarn', diff], { cwd: cur, stdio: ['ignore', 'pipe', 'pipe'] });
    const ok = treeSha(cur) === st.treeSha256;
    verified.push(ok);
    if (!ok) throw new Error(`${id} ${st.step}: rebuilt tree does not match the recorded tree sha256`);
  }
  return { session: id, filesAddedToSeed: added, verified };
}

interface StepRow {
  readonly step: string;
  readonly testsPass: boolean;
  readonly tests: { passed: number; failed: number; failing: string[] } | null;
  readonly oracle: { id: string; pass: boolean }[] | null;
  readonly trapFailed: boolean | null;
  readonly admittedNewVsSeed: string[];
  readonly exploratoryNewVsSeed: string[];
  readonly evasionCandidates: string[];
  readonly frozenFileRulesError: string | null;
}

export interface SessionScore {
  readonly session: string; readonly taskId: string; readonly task: string; readonly style: Style; readonly confirmatory: boolean;
  readonly runIndex: number; readonly verdict: string; readonly complete: boolean;
  readonly D: number | null; readonly DperStep: number[]; readonly Y: number | null; readonly newAdmittedIdentities: string[] | null;
  readonly trapFailed: boolean | null; readonly functional: boolean | null;
  /** Plan §4: tests pass and a sub-goal fails (trapped); tests pass and every sub-goal passes (clean). */
  readonly trapped: boolean | null; readonly clean: boolean | null;
  readonly D_frozen: number | null; readonly D_frozenPerStep: { step: number; new: number | null }[] | null;
  readonly exploratoryNew: string[] | null;
  readonly evasionCount: number;
  readonly failingSubGoals: string[];
  readonly steps: (StepRow & { frozenNewVsSeed: string[] | null })[];
}

const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3));
const share = (k: number, n: number): number | null => (n === 0 ? null : +(k / n).toFixed(3));

/** Wilson 95% score interval for k of n. */
export function wilson(k: number, n: number, z = 1.959964): [number, number] | null {
  if (n === 0) return null;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [+Math.max(0, c - h).toFixed(3), +Math.min(1, c + h).toFixed(3)];
}

/** Frozen-instrument identities of a step (edge grain, Study 2b), as sorted keys. */
export const frozenKeys = (f: readonly IdFinding[]): Set<string> => new Set(f.flatMap((x) => keysFor(x, STUDY2_S2D01)));

export interface TaskRow { readonly taskId: string; readonly task: string; readonly style: Style; readonly confirmatory: boolean; readonly runs: number; readonly trapFailed: number; readonly trapped: number; readonly functional: number; readonly clean: number; readonly meanD: number | null; readonly meanD_frozen: number | null }

export function taskRows(sessions: readonly SessionScore[]): TaskRow[] {
  const by = new Map<string, SessionScore[]>();
  for (const s of sessions) by.set(s.taskId, [...(by.get(s.taskId) ?? []), s]);
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([taskId, ss]) => {
    const f = ss[0] as SessionScore;
    return {
      taskId, task: f.task, style: f.style, confirmatory: f.confirmatory, runs: ss.length,
      trapFailed: ss.filter((s) => s.trapFailed === true).length, trapped: ss.filter((s) => s.trapped === true).length,
      functional: ss.filter((s) => s.functional === true).length, clean: ss.filter((s) => s.clean === true).length,
      meanD: mean(ss.map((s) => s.D).filter((x): x is number => x !== null)),
      meanD_frozen: mean(ss.map((s) => s.D_frozen).filter((x): x is number => x !== null)),
    };
  });
}

export function styleSummary(sessions: readonly SessionScore[]): Record<string, unknown> {
  const n = sessions.length;
  const tf = sessions.filter((s) => s.trapFailed === true);
  const tr = sessions.filter((s) => s.trapped === true);
  const steps = sessions.flatMap((s) => s.DperStep);
  const stepsAnyNewVsSeed = sessions.flatMap((s) => s.steps.slice(1).map((x) => x.admittedNewVsSeed.length > 0));
  const flag = (xs: readonly SessionScore[]): Record<string, unknown> => ({
    runs: xs.length,
    frozenFlags: xs.filter((s) => (s.D_frozen ?? 0) > 0).length, frozenShare: share(xs.filter((s) => (s.D_frozen ?? 0) > 0).length, xs.length),
    graphFlags: xs.filter((s) => (s.D ?? 0) > 0).length, graphShare: share(xs.filter((s) => (s.D ?? 0) > 0).length, xs.length),
    both: xs.filter((s) => (s.D ?? 0) > 0 && (s.D_frozen ?? 0) > 0).length,
    graphOnly: xs.filter((s) => (s.D ?? 0) > 0 && (s.D_frozen ?? 0) === 0).length,
    frozenOnly: xs.filter((s) => (s.D ?? 0) === 0 && (s.D_frozen ?? 0) > 0).length,
    neither: xs.filter((s) => (s.D ?? 0) === 0 && (s.D_frozen ?? 0) === 0).length,
  });
  return {
    runs: n,
    trapFailed: tf.length, trapFailedShare: share(tf.length, n), trapFailedWilson95: wilson(tf.length, n),
    trapped: tr.length, trappedShare: share(tr.length, n), trappedWilson95: wilson(tr.length, n),
    functional: sessions.filter((s) => s.functional === true).length, functionalShare: share(sessions.filter((s) => s.functional === true).length, n),
    clean: sessions.filter((s) => s.clean === true).length,
    meanD: mean(sessions.map((s) => s.D).filter((x): x is number => x !== null)),
    meanD_frozen: mean(sessions.map((s) => s.D_frozen).filter((x): x is number => x !== null)),
    steps: steps.length,
    stepsWithNewAdmitted: steps.filter((x) => x > 0).length, stepViolationProbability: share(steps.filter((x) => x > 0).length, steps.length),
    stepsWithAnyAdmittedNewVsSeed: stepsAnyNewVsSeed.filter(Boolean).length, stepAnyNewVsSeedShare: share(stepsAnyNewVsSeed.filter(Boolean).length, stepsAnyNewVsSeed.length),
    graphVsImports: { trapFailedRuns: flag(tf), trappedRuns: flag(tr), allRuns: flag(sessions) },
  };
}

const fmt = (x: unknown): string => (x === null || x === undefined ? 'n/a' : Array.isArray(x) ? `[${x.map(String).join(', ')}]` : String(x));

export function summaryMarkdown(o: { styles: Record<string, Record<string, unknown>>; tasks: TaskRow[]; unsolvable: TaskRow[]; meta: Record<string, unknown> }): string {
  const L: string[] = [];
  L.push('# TRAPRATE-01 scores (arm `none`, exploratory task screening, not v1.5 study data)', '');
  L.push('Scored by `experiments/traprate-01/score-traprate.ts` with zero model calls, reusing the final-study scorer', '(`experiments/v15-study/score-study.ts`, `scoreSessionSteps`) on every snapshot. Plan: `experiments/traprate-01/plan.md` §4.', '');
  L.push(`Instrument commit: \`${fmt(o.meta.instrumentCommit)}\`. Sessions scored: ${fmt(o.meta.sessions)} (complete: ${fmt(o.meta.complete)}). Frozen evaluation failures: ${fmt(o.meta.evaluationFailures)}.`, '');
  const rs = o.meta.restoration as Record<string, unknown> | undefined;
  L.push(`Snapshot restoration: the committed snapshots lack every directory named \`out/\` (the repository \`.gitignore\` build-output rule matched \`application/ports/out/\` and \`adapters/out/\` under \`results/\`). The scorer rebuilds each snapshot from the committed step-00, the task seed and the committed step diffs, and checks every rebuilt tree against the tree sha256 the driver recorded (the seed pin without the skeleton \`package.json\` the cell adds): ${fmt(rs?.treesVerified)} trees verified over ${fmt(rs?.sessions)} sessions (seed files restored in ${fmt(rs?.sessionsWithSeedFilesAdded)} sessions).`, '');
  L.push('Definitions:', '');
  L.push('- **trapFailed**: an oracle sub-goal fails on the final step (step-03), whatever the tests do.');
  L.push('- **trapped** (plan §4): every test passes and at least one sub-goal fails on the final step. **clean**: every test and every sub-goal passes.');
  L.push('- **functional**: every behaviour test passes on the final step.');
  L.push('- **D** (pre-registration D_v15): admitted-rule identities (rule + file + subject) present at a step and absent from the seed and every earlier step, summed over the 3 steps; renames carried.');
  L.push('- **D_frozen**: the frozen v1.4 import-level instrument\'s D (Study 2b parameters, check-correct `correct` only, seed as step 1).');
  L.push('- **step violation probability**: share of task steps whose D_v15 contribution is at least 1 (at least one new admitted identity at that step).');
  L.push('- **graph vs imports**: of the trapped runs, the share with D_frozen > 0 (frozen import-level instrument flags) and with D > 0 (admitted graph rules flag).', '');
  L.push(`Task set note: the plan listed f19-hex-school-canteen (t25) as exploratory; \`study-set.json\` on main (2026-10-28) moved it to confirmatory after H03 was admitted. The Hexagonal rows below include it (13 tasks, 26 runs); the "Hexagonal without f19" row is the plan's 12-task pool. The task tests, oracles and seeds are unchanged since the run; only the clean references of f19 and f24 changed.`, '');
  L.push('## Per style', '');
  L.push('| Style | Runs | trapFailed | Share (Wilson 95%) | Trapped (plan §4) | Share (Wilson 95%) | Functional | Share | Clean | Mean D | Mean D_frozen | Steps with new admitted identity | Step violation probability |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(o.styles)) {
    L.push(`| ${k} | ${fmt(s.runs)} | ${fmt(s.trapFailed)} | ${fmt(s.trapFailedShare)} ${fmt(s.trapFailedWilson95)} | ${fmt(s.trapped)} | ${fmt(s.trappedShare)} ${fmt(s.trappedWilson95)} | ${fmt(s.functional)} | ${fmt(s.functionalShare)} | ${fmt(s.clean)} | ${fmt(s.meanD)} | ${fmt(s.meanD_frozen)} | ${fmt(s.stepsWithNewAdmitted)} of ${fmt(s.steps)} | ${fmt(s.stepViolationProbability)} |`);
  }
  L.push('', 'Plan §5 check (trapped, plan §4 definition, Wilson 95% upper bound below 0.30 = stop and report):', '');
  for (const [k, st] of Object.entries(o.styles)) {
    const w = st.trappedWilson95 as [number, number] | null;
    if (k !== 'All' && w !== null) L.push(`- ${k}: upper bound ${String(w[1])}, ${w[1] < 0.3 ? 'below 0.30 (stop rule met)' : 'not below 0.30 (stop rule not met)'}.`);
  }
  L.push('', '## Graph rules vs the frozen import-level instrument', '');
  L.push('| Style | Runs in set | Frozen flags (D_frozen > 0) | Share | Graph flags (D > 0) | Share | Both | Graph only | Frozen only | Neither |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(o.styles)) {
    const g = s.graphVsImports as Record<string, Record<string, unknown>>;
    for (const [set, lab] of [['trappedRuns', 'trapped'], ['trapFailedRuns', 'trapFailed'], ['allRuns', 'all']] as const) {
      const r = g[set] as Record<string, unknown>;
      L.push(`| ${k}, ${lab} | ${fmt(r.runs)} | ${fmt(r.frozenFlags)} | ${fmt(r.frozenShare)} | ${fmt(r.graphFlags)} | ${fmt(r.graphShare)} | ${fmt(r.both)} | ${fmt(r.graphOnly)} | ${fmt(r.frozenOnly)} | ${fmt(r.neither)} |`);
    }
  }
  L.push('', '## Per task', '');
  L.push('| Id | Task | Style | Runs | trapFailed | Trapped (plan §4) | Functional | Clean | Mean D | Mean D_frozen |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const t of o.tasks) L.push(`| ${t.taskId} | ${t.task} | ${t.style} | ${String(t.runs)} | ${String(t.trapFailed)} | ${String(t.trapped)} | ${String(t.functional)} | ${String(t.clean)} | ${fmt(t.meanD)} | ${fmt(t.meanD_frozen)} |`);
  L.push('', '## Tasks that may be unsolvable as written (functional 0 of 2)', '');
  if (o.unsolvable.length === 0) L.push('None.');
  else for (const t of o.unsolvable) L.push(`- ${t.taskId} ${t.task} (${t.style}): functional 0 of ${String(t.runs)}; to be read by hand before the registration (plan §5).`);
  L.push('', 'Every oracle FAIL is a candidate for the hand read of plan §4; the counts above are provisional until that read. Per-session and per-step detail: `sessions.json`.', '');
  return `${L.join('\n')}\n`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const results = path.resolve(arg('results') ?? 'results/v1.5-traprate-01');
  const outDir = path.resolve(arg('out') ?? path.join(results, 'scores'));
  const only = arg('sessions')?.split(',');
  const input = JSON.parse(fs.readFileSync(path.join(results, 'run', 'input.json'), 'utf8')) as { tasks: { id: string; seedTreeSha256: string; steps: string[] }[] };
  const map = JSON.parse(fs.readFileSync(path.join(results, 'private-id-map.json'), 'utf8')) as Record<string, { task: string; style: Style }>;
  const studySet = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/trap-families/study-set.json'), 'utf8')) as { confirmatory: { ddd: string[]; hexagonal: string[] } };
  const confirmatory = new Set([...studySet.confirmatory.ddd, ...studySet.confirmatory.hexagonal]);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'traprate-score-'));
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(results).join('<results>').split(REPO).join('.').split(os.tmpdir()).join('<tmp>');
  let nm = arg('node-modules');
  if (nm === undefined) {
    const h = path.resolve(arg('harness-root') ?? path.join(scratch, 'h'));
    fs.mkdirSync(h, { recursive: true });
    const ready = await ensureHarness(new NodeProcessRunner(), REPO, h);
    if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
    nm = path.join(ready.data.install.dir, 'node_modules');
  }
  const env = engineEnv(process.env, 'cypher-interp');
  const deps = engineDeps(buildContext({}, env).evaluateDeps, 'cypher-interp');
  const head = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return null; } })();
  let evaluationFailures = 0;
  const ctx: SessionScoringContext = { scratch, scrub, rules: loadRules(), frozenEnabled: true, nm, env, deps, head, onEvaluationFailure: () => { evaluationFailures++; } };
  const recorded = path.join(results, 'sessions');
  const ids = fs.readdirSync(recorded).filter((d) => fs.existsSync(path.join(recorded, d, 'session.json'))).filter((d) => only === undefined || only.includes(d)).sort();
  const sessionsDir = path.join(scratch, 'restored');
  const restores: RestoreReport[] = [];
  for (const id of ids) {
    const t = (JSON.parse(fs.readFileSync(path.join(recorded, id, 'session.json'), 'utf8')) as { taskId: string }).taskId;
    const m = map[t];
    const pin = input.tasks.find((x) => x.id === t)?.seedTreeSha256;
    if (m === undefined || pin === undefined) throw new Error(`no map entry or seed pin for ${t}`);
    restores.push(restoreSession(results, id, path.join(REPO, 'experiments/trap-families', m.task, 'seed'), pin, sessionsDir));
  }
  process.stdout.write(`restored ${String(restores.length)} sessions, every tree hash verified; seed files added: ${String(restores.reduce((a, r) => a + r.filesAddedToSeed, 0))}\n`);
  const sessions: SessionScore[] = [];
  try {
    for (const id of ids) {
      const sess = JSON.parse(fs.readFileSync(path.join(sessionsDir, id, 'session.json'), 'utf8')) as { taskId: string; runIndex: number; verdict: string };
      const m = map[sess.taskId];
      if (m === undefined) throw new Error(`no private map entry for ${sess.taskId}`);
      const nSteps = input.tasks.find((t) => t.id === sess.taskId)?.steps.length ?? 0;
      const sc = await scoreSessionSteps(ctx, { id, sessionsDir, task: m.task, style: m.style, nSteps, verdict: sess.verdict, cell: 'none' });
      fs.rmSync(path.join(scratch, id), { recursive: true, force: true });
      const seedFrozen = sc.frozenIds[0] ?? null;
      const steps = (sc.steps as unknown as StepRow[]).map((st, k) => {
        const f = sc.frozenIds[k] ?? null;
        return { ...st, frozenNewVsSeed: f === null || seedFrozen === null ? null : newAgainst(frozenKeys(f), frozenKeys(seedFrozen)) };
      });
      const final = steps.at(-1);
      const tf = sc.complete ? (final?.trapFailed ?? null) : null;
      const fn = sc.complete ? (final?.testsPass ?? null) : null;
      const dF = sc.dFrozen as { D: number | null; perStepNew: { step: number; new: number | null }[] } | null;
      const row: SessionScore = {
        session: id, taskId: sess.taskId, task: m.task, style: m.style, confirmatory: confirmatory.has(m.task), runIndex: sess.runIndex, verdict: sess.verdict, complete: sc.complete,
        D: sc.dv.D, DperStep: sc.dv.perStep, Y: sc.y?.Y ?? null, newAdmittedIdentities: sc.y?.newIdentities ?? null,
        trapFailed: tf, functional: fn,
        trapped: tf === null || fn === null ? null : fn && tf, clean: tf === null || fn === null ? null : fn && !tf,
        D_frozen: dF?.D ?? null, D_frozenPerStep: dF?.perStepNew ?? null,
        exploratoryNew: sc.complete ? (final?.exploratoryNewVsSeed ?? null) : null,
        evasionCount: sc.evasion.size,
        failingSubGoals: (final?.oracle ?? []).filter((g) => !g.pass).map((g) => g.id),
        steps,
      };
      sessions.push(row);
      process.stdout.write(`${id} ${sess.taskId} ${m.task}: D ${String(row.D)} Y ${String(row.Y)} trapFailed ${String(tf)} functional ${String(fn)} D_frozen ${String(row.D_frozen)} evasion ${String(row.evasionCount)}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const tasks = taskRows(sessions);
  const styles: Record<string, Record<string, unknown>> = {
    DDD: styleSummary(sessions.filter((s) => s.style === 'ddd')),
    Hexagonal: styleSummary(sessions.filter((s) => s.style === 'hexagonal')),
    'Hexagonal without f19': styleSummary(sessions.filter((s) => s.style === 'hexagonal' && s.task !== 'f19-hex-school-canteen')),
    All: styleSummary(sessions),
  };
  const unsolvable = tasks.filter((t) => t.functional === 0);
  const meta = { schema: 'traprate-01-scores/v1', modelCalls: 0, instrumentCommit: head, sessions: sessions.length, complete: sessions.filter((s) => s.complete).length, evaluationFailures, admitted: { ddd: admittedRules('ddd'), hexagonal: admittedRules('hexagonal') }, exploratory: { ddd: exploratoryRules('ddd'), hexagonal: exploratoryRules('hexagonal') }, frozenIdentity: 'edge grain, Study 2b (STUDY2_S2D01)', restoration: { sessions: restores.length, treesVerified: restores.reduce((a, r) => a + r.verified.length, 0), seedFilesAdded: restores.reduce((a, r) => a + r.filesAddedToSeed, 0), sessionsWithSeedFilesAdded: restores.filter((r) => r.filesAddedToSeed > 0).length } };
  fs.mkdirSync(outDir, { recursive: true });
  const w = (f: string, o: unknown): void => fs.writeFileSync(path.join(outDir, f), `${scrub(JSON.stringify(o, null, 1))}\n`);
  w('sessions.json', { ...meta, sessions });
  w('tasks.json', { ...meta, tasks, unsolvable: unsolvable.map((t) => t.taskId) });
  w('summary.json', { ...meta, styles, unsolvable: unsolvable.map((t) => ({ taskId: t.taskId, task: t.task })) });
  fs.writeFileSync(path.join(outDir, 'summary.md'), scrub(summaryMarkdown({ styles, tasks, unsolvable, meta })));
  return evaluationFailures > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith('score-traprate.ts') === true) {
  main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
}
