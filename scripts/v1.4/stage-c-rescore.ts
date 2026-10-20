/**
 * Exploratory Study 2a, Stage C: re-score every scored loop snapshot at the instrument of record, label every blocking
 * finding with check-correct, and compute D, Y1 and Yk per run (registration `Docs/v1.4/exploratory-study-registration.md`
 * §7–§9, Amendment 1 items 3 and 4). Entry file: no exports. Report: `Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md`.
 *
 * Usage (repository root, at the freeze tag):
 *   npx tsx scripts/v1.4/stage-c-rescore.ts --cell none@L2=<out-root> [--cell <cell>=<out-root> ...]
 *     --node-modules <skeleton install>/node_modules --out <dir> [--tag <instrument tag>]
 *
 * Zero model calls, no Neo4j, no network. Each scored turn's `snapshot.commit` is materialised from its run's
 * `snapshots.git` (`git archive`) into a temporary directory, the skeleton install is linked as `node_modules`, and the
 * snapshot is evaluated exactly as the loop evaluator does: `firewallEvaluator` (`evaluateProject`, symbolic-only,
 * scoring v1.3, the switch-aware tier resolver) on the `cypher-interp` engine (`engineDeps`, `engineEnv`,
 * `taggedEvaluator` of `scripts/lib/loop/engine-tee.ts`), with the harness tsconfig (`buildHarnessTsconfig`) and the
 * step's recorded `evaluatorSpec` (its sha256 checked). Every blocking finding of the re-score goes through
 * check-correct's checker (`checkFinding`, `scripts/v1.3/check-correct.ts`), on the same tree, with the ADR-032 tsconfig.
 *
 * D, Y1, Yk: `driftRun` (`scripts/lib/drift/study2-d.ts`) under `STUDY2_S2D01` (edge grain, kFrom 2, kTo 5, ρ from
 * `git diff -M50%` between consecutive step-final commits), counting only findings labelled `correct`, as
 * `scripts/v1.4/drift-existing.ts` does. Three readings per run: the registered one (freeze, `correct` only), the freeze
 * re-score without the label filter, and the pre-freeze step records as recorded (unfiltered).
 *
 * Reads (read-only): the out-roots (step records and `snapshots.git`), the specs, the skeleton install.
 * Writes <out>/snapshots.json (one row per scored snapshot), <out>/runs.json (one row per run), <out>/analysis.json
 * (cell summaries, ratios, the stop check, the semantic sample). Paths under the out-roots are written as
 * `<out-root:cell>`; nothing personal is written. Exit 0 ok, 1 an evaluation failed, 2 usage error.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../src/mcp-server/context.js';
import { renameMapBetween } from '../lib/drift/git-rename.js';
import { fromBlockingFinding } from '../lib/drift/identity.js';
import { driftRun, fromStepRecord, type StepInput } from '../lib/drift/study2-d.js';
import { STUDY2_S2D01, type DriftRun, type IdFinding } from '../lib/drift/types.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, taggedEvaluator } from '../lib/loop/engine-tee.js';
import { firewallEvaluator } from '../lib/loop/evaluator.js';
import type { BlockingFinding, StepEvaluation, StepRecord } from '../lib/loop/types.js';
import { checkFinding } from '../v1.3/lib/labelling/correctness.js';
import { findingsOfReport } from '../v1.3/lib/labelling/findings.js';
import { SourceFacts } from '../v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../v1.3/lib/labelling/spec-facts.js';
import { cellRatio, drawSemanticSample, edgeKind, stopCheck, summariseCell, y1ZeroShare, STAGE_C_SEED, type RunD } from './lib/stage-c.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

interface RunJson { runId: string; spec: { taskId: string; arm: string; runIndex: number }; sharedStart?: { sourceRunId: string; sourceCommit: string } }

function runDirs(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || ['snapshots.git', 'work', 'turns', 'steps', 'calls', 'node_modules', 'home'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
    else out.push(...runDirs(p));
  }
  return out;
}

function materialise(gitDir: string, commit: string, tree: string, nodeModules: string): string {
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['--git-dir', gitDir, 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  if (!fs.existsSync(path.join(tree, 'node_modules'))) fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  const tsconfig = `${tree}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  return tsconfig;
}

interface LabelledFinding { readonly b: BlockingFinding; readonly id: IdFinding; readonly verdict: string; readonly reason: string }
interface SnapRow {
  cell: string; task: string; rep: number; runId: string; step: number; turnId: string; commit: string; inheritedStep1: boolean;
  recorded: { blocking: number; byRule: Record<string, number>; edges: string[] };
  freeze: { blocking: number; byRule: Record<string, number>; advisory: number; verdict: string; findings: { ruleId: string; file: string; target: string | null; line: number | null; verdict: string; reason: string; edgeKind: string }[] };
  recordedMatch: boolean; edgeSetMatch: boolean;
}

const edgeKey = (rule: string, file: string, target: string | undefined | null): string => `${rule}|${file}|${target ?? ''}`;

async function main(): Promise<number> {
  const cells = args('cell').map((c) => {
    const i = c.indexOf('=');
    if (i <= 0) throw new Error(`--cell ${c}: expected <cell>=<out-root>`);
    return { cell: c.slice(0, i), root: path.resolve(c.slice(i + 1)) };
  });
  const nm = arg('node-modules');
  const out = arg('out');
  if (cells.length === 0 || nm === undefined || out === undefined) {
    process.stderr.write('usage: stage-c-rescore.ts --cell <cell>=<out-root> ... --node-modules <dir> --out <dir> [--tag <tag>]\n');
    return 2;
  }
  const nodeModules = path.resolve(nm);
  const tag = arg('tag') ?? null;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-c-rescore-'));
  const env = engineEnv(process.env, 'cypher-interp');
  const deps = engineDeps(buildContext({}, env).evaluateDeps, 'cypher-interp');
  const evaluators = new Map<string, ReturnType<typeof taggedEvaluator>>();
  const scrub = (s: string): string => cells.reduce((acc, c) => acc.split(c.root).join(`<out-root:${c.cell}>`), s.split(scratch).join('<scratch>').split(REPO).join('.'));

  const snapRows: SnapRow[] = [];
  const runRows: Record<string, unknown>[] = [];
  const runD: { registered: RunD; freezeAll: RunD; recorded: RunD }[] = [];
  const counted: { cell: string; block: string; step: number; ruleId: string; file: string; target: string | null; edgeKind: string }[] = [];
  let failures = 0;
  let n = 0;
  try {
    for (const { cell, root } of cells) {
      for (const runDir of runDirs(path.join(root, 'runs'))) {
        const run = readJson<RunJson>(path.join(runDir, 'run.json'));
        const rep = run.spec.runIndex + 1;
        const task = run.spec.taskId;
        const gitDir = path.join(runDir, 'snapshots.git');
        const recs = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort().map((f) => readJson<StepRecord & { evaluatorSpec?: { kind: string; path: string; sha256?: string }; inherited?: unknown }>(path.join(runDir, 'steps', f)));
        const freezeSteps: StepInput[] = [];
        const allSteps: StepInput[] = [];
        const recordedSteps: StepInput[] = [];
        const correctIds = new Set<IdFinding>();
        let prevCommit: string | null = null;
        for (const rec of recs) {
          const step = rec.stepIndex + 1;
          const es = rec.evaluatorSpec;
          if (es?.kind !== 'static') throw new Error(`${run.runId} step ${String(step)}: evaluatorSpec ${JSON.stringify(es)}, expected static`);
          const specPath = path.resolve(REPO, es.path);
          if (es.sha256 !== undefined && sha256(specPath) !== es.sha256) throw new Error(`${es.path}: sha256 differs from the step record`);
          let ev = evaluators.get(specPath);
          if (ev === undefined) {
            ev = taggedEvaluator(firewallEvaluator(specPath, env, deps, (dir) => `${dir}.tsconfig.json`), 'cypher-interp');
            evaluators.set(specPath, ev);
          }
          const spec = await loadSpecView(specPath);
          const turn = rec.turns.at(-1);
          const recEv = turn?.snapshot.evaluation ?? null;
          if (turn === undefined || recEv === null) {
            freezeSteps.push({ step, final: null });
            allSteps.push({ step, final: null });
            continue;
          }
          const commit = turn.snapshot.commit;
          const tree = path.join(scratch, `t${String(n++)}`);
          materialise(gitDir, commit, tree, nodeModules);
          const r = await ev.evaluate(tree, run.runId);
          if (!r.success) {
            failures++;
            process.stderr.write(`${cell} ${run.runId} step ${String(step)}: ${scrub(r.errors.map((e) => e.message).join('; '))}\n`);
            freezeSteps.push({ step, final: null });
            allSteps.push({ step, final: null });
            continue;
          }
          const e: StepEvaluation = r.data;
          const projectId = `${cell}/${task}/rep${String(rep)}/step-${String(step).padStart(2, '0')}`;
          const reportFindings = findingsOfReport({ violations: e.reportViolations ?? [] }, { projectId }, spec.style);
          const facts = new SourceFacts(tree, { tsconfig: 'adr-032' });
          const labelled: LabelledFinding[] = e.blockingFindings.map((b) => {
            const id = fromBlockingFinding(b, e.reportViolations);
            const match = reportFindings.find((x) => x.violationId === b.violationId);
            if (match === undefined) return { b, id, verdict: 'unmatched', reason: 'no report row with this violation id' };
            const c = checkFinding(match, spec, facts);
            return { b, id, verdict: c.verdict, reason: scrub(c.reason) };
          });
          for (const l of labelled) if (l.verdict === 'correct') correctIds.add(l.id);
          const rename = prevCommit === null ? undefined : renameMapBetween(gitDir, prevCommit, commit, '.', '');
          if (rename?.renameDetection === 'skipped') throw new Error(`${run.runId}: rename detection skipped between steps`);
          const contextId = JSON.stringify([es.path, es.sha256 ?? null, 'cypher-interp', 'v1.3', head]);
          const snap = { id: commit, contextId, ok: true, findings: labelled.map((l) => l.id), files: turn.snapshot.sourceFiles };
          const rho = step > 1 ? { rename: rename?.rename ?? new Map<string, string>() } : {};
          freezeSteps.push({ step, final: snap, ...rho });
          allSteps.push({ step, final: snap, ...rho });
          recordedSteps.push({ ...fromStepRecord(rec), ...rho });
          prevCommit = commit;
          const recEdges = recEv.blockingFindings.map((b) => edgeKey(b.ruleId, b.filePath, b.target)).sort();
          const freezeEdges = e.blockingFindings.map((b) => edgeKey(b.ruleId, b.filePath, b.target)).sort();
          const byRule = (x: Readonly<Record<string, number>>): Record<string, number> => Object.fromEntries(Object.entries(x).filter(([, v]) => v > 0).sort());
          snapRows.push({
            cell, task, rep, runId: run.runId, step, turnId: turn.turnId, commit, inheritedStep1: rec.inherited !== undefined,
            recorded: { blocking: recEv.blockingViolationCount, byRule: byRule(recEv.blockingByRule), edges: recEdges },
            freeze: {
              blocking: e.blockingViolationCount, byRule: byRule(e.blockingByRule), advisory: e.advisoryViolationCount, verdict: e.verdict,
              findings: labelled.map((l) => ({ ruleId: l.b.ruleId, file: l.b.filePath, target: l.b.target ?? null, line: l.b.line ?? null, verdict: l.verdict, reason: l.reason, edgeKind: edgeKind(l.id) })),
            },
            recordedMatch: JSON.stringify(byRule(recEv.blockingByRule)) === JSON.stringify(byRule(e.blockingByRule)),
            edgeSetMatch: JSON.stringify(recEdges) === JSON.stringify(freezeEdges),
          });
          process.stdout.write(`${cell.padEnd(8)} ${task}/rep${String(rep)} step ${String(step)}: recorded ${String(recEv.blockingViolationCount)} freeze ${String(e.blockingViolationCount)} (correct ${String(labelled.filter((l) => l.verdict === 'correct').length)})\n`);
          fs.rmSync(tree, { recursive: true, force: true });
          fs.rmSync(`${tree}.tsconfig.json`, { force: true });
        }
        const meta = { runId: run.runId, blockId: `${task}/rep${String(rep)}`, cell, groupBy: (f: IdFinding) => edgeKind(f) };
        const reg: DriftRun = driftRun(freezeSteps, STUDY2_S2D01, (f) => correctIds.has(f), meta);
        const all: DriftRun = driftRun(allSteps, STUDY2_S2D01, undefined, meta);
        const recd: DriftRun = driftRun(recordedSteps, STUDY2_S2D01, undefined, { ...meta, groupBy: undefined });
        const toD = (d: DriftRun): RunD => ({ cell, task, rep, D: d.D, Y1: d.Y1, Yk: d.Yk, inheritedRemoved: d.inheritedRemoved });
        runD.push({ registered: toD(reg), freezeAll: toD(all), recorded: toD(recd) });
        // Counted identities (SO5 material, estimand 9): the new ones of steps 2..5, in the step they first appear.
        const seen = new Set<string>();
        for (const s of [...freezeSteps].sort((a, b) => a.step - b.step)) {
          for (const f of s.final?.findings ?? []) {
            if (!correctIds.has(f)) continue;
            const k = edgeKey(f.functionId, f.filePath, f.target);
            if (!seen.has(k) && s.step >= 2) counted.push({ cell, block: meta.blockId, step: s.step, ruleId: f.functionId, file: f.filePath, target: f.target ?? null, edgeKind: edgeKind(f) });
            seen.add(k);
          }
        }
        const pick = (d: DriftRun): Record<string, unknown> => ({ D: d.D, Y1: d.Y1, Y1fine: d.Y1fine, Yk: d.Yk, perStepNew: d.perStep.map((p) => p.newCount), inheritedRemoved: d.inheritedRemoved, inheritedRemovedPerStep: d.inheritedRemovedPerStep.map((p) => p.removed), DnoInheritedRemoval: d.DnoInheritedRemoval, stepsToFirstNew: d.stepsToFirstNew, renameMapMissing: d.renameMapMissing, incomplete: d.incomplete, ...(d.byGroup !== undefined && { byEdgeKind: d.byGroup }) });
        runRows.push({ cell, task, rep, block: meta.blockId, runId: run.runId, sharedStartFrom: run.sharedStart?.sourceRunId ?? null, registered: pick(reg), freezeUnfiltered: pick(all), recordedPreFreeze: pick(recd) });
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // ── analysis ──
  const cellNames = [...new Set(cells.map((c) => c.cell))];
  const byCell = (k: 'registered' | 'freezeAll' | 'recorded', cell: string): RunD[] => runD.filter((r) => r.registered.cell === cell).map((r) => r[k]);
  const summaries = Object.fromEntries((['registered', 'freezeAll', 'recorded'] as const).map((k) => [k, cellNames.map((c) => summariseCell(c, byCell(k, c)))]));
  const ref = 'none@L2';
  const ratios = Object.fromEntries((['registered', 'freezeAll', 'recorded'] as const).map((k) => [k, cellNames.filter((c) => c !== ref).map((c) => ({ cell: c, reference: ref, ...cellRatio(byCell(k, c), byCell(k, ref)) }))]));
  const stageA = byCell('registered', ref).filter((r) => r.rep === 1);
  const stop = { registered: stopCheck(stageA), freezeUnfiltered: stopCheck(byCell('freezeAll', ref).filter((r) => r.rep === 1)), recordedPreFreeze: stopCheck(byCell('recorded', ref).filter((r) => r.rep === 1)) };
  const y1Blocks = byCell('registered', ref);
  const candidates = snapRows.filter((s) => s.step === 5).map((s) => ({ cell: s.cell, task: s.task, id: `${s.cell}/${s.task}/rep${String(s.rep)}/step-05`, commit: s.commit, rep: s.rep, blocking: s.freeze.blocking }));
  const semanticSample = drawSemanticSample(candidates, 4);
  const analysis = {
    params: { instrumentTag: tag, runCommit: head, engine: 'cypher-interp', scoringMode: 'v1.3', drift: STUDY2_S2D01, counted: 'check-correct verdict correct', seed: STAGE_C_SEED, resamples: 10_000, bootstrap: 'task-clustered percentile', cells: cells.map((c) => ({ cell: c.cell, outRoot: `<out-root:${c.cell}>` })) },
    snapshots: { scored: snapRows.length, inheritedStep1Copies: snapRows.filter((s) => s.inheritedStep1).length, distinctTrees: new Set(snapRows.map((s) => s.commit)).size, recordedCountMismatch: snapRows.filter((s) => !s.recordedMatch).length, recordedEdgeSetMismatch: snapRows.filter((s) => !s.edgeSetMatch).length, evaluationFailures: failures },
    findings: (() => {
      const fs_ = snapRows.flatMap((s) => s.freeze.findings);
      const verdicts: Record<string, number> = {};
      for (const f of fs_) verdicts[f.verdict] = (verdicts[f.verdict] ?? 0) + 1;
      const rules: Record<string, number> = {};
      for (const f of fs_) rules[f.ruleId] = (rules[f.ruleId] ?? 0) + 1;
      return { blockingRows: fs_.length, byVerdict: verdicts, byRule: rules };
    })(),
    summaries, ratios, stopCheck: stop, y1ZeroShare: y1ZeroShare(y1Blocks),
    countedIdentities: counted,
    semanticSample: { rule: 'per cell, 4 step-5 snapshots, at most 2 per task, seeded Fisher-Yates (seed + cell index, cells sorted)', m: 4, snapshots: semanticSample },
  };
  fs.mkdirSync(out, { recursive: true });
  const write = (f: string, v: unknown): void => { fs.writeFileSync(path.join(out, f), `${scrub(JSON.stringify(v, null, 1))}\n`); };
  write('snapshots.json', snapRows);
  write('runs.json', runRows);
  write('analysis.json', analysis);
  process.stdout.write(`scored snapshots ${String(snapRows.length)}, failures ${String(failures)}, recorded count mismatches ${String(analysis.snapshots.recordedCountMismatch)}\n`);
  for (const s of summaries.registered ?? []) process.stdout.write(`${s.cell}: D ${JSON.stringify(s.D.values)} mean ${s.D.mean.toFixed(3)} endStateZero ${String(s.endStateZero)}/${String(s.runs)}\n`);
  process.stdout.write(`stop check (registered): ${JSON.stringify(stop.registered)}\n`);
  return failures > 0 ? 1 : 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
