/**
 * Study 2b evasion item 4, the literal view (pre-registration `Docs/v1.4/study2b-preregistration.md` §4 "Evasion",
 * item 4; addendum 4 row DA15). Post hoc, zero model calls, no Neo4j, no network. Entry file: no exports. Helpers and
 * the literal-view graph: `scripts/v1.4/lib/literal-view.ts`.
 *
 * Usage (repository root, at the freeze tag with this file and its lib copied in, as runbook §6 does for Stage C):
 *   npx tsx scripts/v1.4/study2b-literal-view.ts --cell none@L2=<out-root> [--cell <cell>=<out-root> ...]
 *     --node-modules <skeleton install>/node_modules --out <dir> [--check-runs <score/rescore/runs.json>]
 *
 * For every run under each out-root and every step's final snapshot (`git archive` from the run's `snapshots.git`),
 * the snapshot is evaluated twice, exactly as `scripts/v1.4/stage-c-rescore.ts` evaluates it (`firewallEvaluator`,
 * `evaluateProject`, scoring v1.3, `cypher-interp`, the harness tsconfig, the step's static `evaluatorSpec` with its
 * sha256 checked): once on the default graph (the registered re-score) and once on the literal-view graph
 * (`LiteralViewRepository`, injected as the pipeline's `graphRepository`). Every blocking finding of each goes through
 * check-correct (`checkFinding`), and D comes from `driftRun` under `STUDY2_S2D01` (edge grain, kFrom 2, kTo 5, ρ from
 * `git diff -M50%`), counting `correct` findings only: the same identity rule as D. Item 4 re-scores the step-5
 * snapshots; D needs every step, so steps 1–5 are re-scored and the step-5 count gap is reported beside the D gap.
 *
 * With `--check-runs`, the default D of every run is compared with the committed registered D (a reproduction check).
 * Writes <out>/snapshots.json, <out>/blocks.json and <out>/summary.json. Paths under the out-roots are written as
 * `<out-root:cell>`. Exit 0 ok, 1 an evaluation failed or the reproduction check failed, 2 usage error.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../src/mcp-server/context.js';
import type { EvaluateDeps } from '../../src/mcp-server/evaluate-project.js';
import { renameMapBetween } from '../lib/drift/git-rename.js';
import { fromBlockingFinding } from '../lib/drift/identity.js';
import { driftRun, type StepInput } from '../lib/drift/study2-d.js';
import { STUDY2_S2D01, type IdFinding } from '../lib/drift/types.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, taggedEvaluator } from '../lib/loop/engine-tee.js';
import { firewallEvaluator } from '../lib/loop/evaluator.js';
import type { StepEvaluation, StepRecord, StepEvaluator } from '../lib/loop/types.js';
import { checkFinding } from '../v1.3/lib/labelling/correctness.js';
import { findingsOfReport } from '../v1.3/lib/labelling/findings.js';
import { SourceFacts } from '../v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../v1.3/lib/labelling/spec-facts.js';
import { blockGap, cellGap, emptyStats, literalBar, literalDeps, LITERAL_BAR, LITERAL_REFERENCE, type BlockGap } from './lib/literal-view.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const edgeKey = (rule: string, file: string, target: string | undefined | null): string => `${rule}|${file}|${target ?? ''}`;

interface RunJson { runId: string; spec: { taskId: string; arm: string; runIndex: number } }
type View = 'default' | 'literal';
const VIEWS: readonly View[] = ['default', 'literal'];

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

function materialise(gitDir: string, commit: string, tree: string, nodeModules: string): void {
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['--git-dir', gitDir, 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  if (!fs.existsSync(path.join(tree, 'node_modules'))) fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  fs.writeFileSync(`${tree}.tsconfig.json`, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
}

async function main(): Promise<number> {
  const cells = args('cell').map((c) => {
    const i = c.indexOf('=');
    if (i <= 0) throw new Error(`--cell ${c}: expected <cell>=<out-root>`);
    return { cell: c.slice(0, i), root: path.resolve(c.slice(i + 1)) };
  });
  const nm = arg('node-modules');
  const out = arg('out');
  if (cells.length === 0 || nm === undefined || out === undefined) {
    process.stderr.write('usage: study2b-literal-view.ts --cell <cell>=<out-root> ... --node-modules <dir> --out <dir> [--check-runs <runs.json>]\n');
    return 2;
  }
  const checkRuns = arg('check-runs');
  const nodeModules = path.resolve(nm);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'study2b-literal-'));
  const env = engineEnv(process.env, 'cypher-interp');
  const base = buildContext({}, env).evaluateDeps;
  const sink = { current: emptyStats() };
  const depsOf: Record<View, EvaluateDeps> = { default: engineDeps(base, 'cypher-interp'), literal: literalDeps(base, sink) };
  const evaluators = new Map<string, StepEvaluator>();
  const scrub = (s: string): string => cells.reduce((acc, c) => acc.split(c.root).join(`<out-root:${c.cell}>`), s.split(scratch).join('<scratch>').split(REPO).join('.'));

  const snapRows: Record<string, unknown>[] = [];
  const gaps: BlockGap[] = [];
  const runRows: Record<string, unknown>[] = [];
  const totals = emptyStats();
  let failures = 0;
  let n = 0;
  try {
    for (const { cell, root } of cells) {
      for (const runDir of runDirs(path.join(root, 'runs'))) {
        const run = readJson<RunJson>(path.join(runDir, 'run.json'));
        const rep = run.spec.runIndex + 1;
        const task = run.spec.taskId;
        const block = `${task}/rep${String(rep)}`;
        const gitDir = path.join(runDir, 'snapshots.git');
        const recs = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort().map((f) => readJson<StepRecord & { evaluatorSpec?: { kind: string; path: string; sha256?: string } }>(path.join(runDir, 'steps', f)));
        const steps: Record<View, StepInput[]> = { default: [], literal: [] };
        const correct: Record<View, Set<IdFinding>> = { default: new Set(), literal: new Set() };
        const step5: Record<View, number | null> = { default: null, literal: null };
        let prevCommit: string | null = null;
        for (const rec of recs) {
          const step = rec.stepIndex + 1;
          const es = rec.evaluatorSpec;
          if (es?.kind !== 'static') throw new Error(`${run.runId} step ${String(step)}: evaluatorSpec ${JSON.stringify(es)}, expected static`);
          const specPath = path.resolve(REPO, es.path);
          if (es.sha256 !== undefined && sha256(specPath) !== es.sha256) throw new Error(`${es.path}: sha256 differs from the step record`);
          const spec = await loadSpecView(specPath);
          const turn = rec.turns.at(-1);
          if (turn === undefined || (turn.snapshot.evaluation ?? null) === null) {
            for (const v of VIEWS) steps[v].push({ step, final: null });
            continue;
          }
          const commit = turn.snapshot.commit;
          const tree = path.join(scratch, `t${String(n++)}`);
          materialise(gitDir, commit, tree, nodeModules);
          const rename = prevCommit === null ? undefined : renameMapBetween(gitDir, prevCommit, commit, '.', '');
          if (rename?.renameDetection === 'skipped') throw new Error(`${run.runId}: rename detection skipped between steps`);
          const rho = step > 1 ? { rename: rename?.rename ?? new Map<string, string>() } : {};
          const facts = new SourceFacts(tree, { tsconfig: 'adr-032' });
          const row: Record<string, unknown> = { cell, task, rep, step, commit };
          let ok = true;
          for (const v of VIEWS) {
            const key = `${v}|${specPath}`;
            let ev = evaluators.get(key);
            if (ev === undefined) {
              ev = taggedEvaluator(firewallEvaluator(specPath, env, depsOf[v], (dir) => `${dir}.tsconfig.json`), 'cypher-interp');
              evaluators.set(key, ev);
            }
            sink.current = emptyStats();
            const r = await ev.evaluate(tree, run.runId);
            const stats = sink.current;
            if (!r.success) {
              failures++; ok = false;
              process.stderr.write(`${cell} ${run.runId} step ${String(step)} ${v}: ${scrub(r.errors.map((e) => e.message).join('; '))}\n`);
              steps[v].push({ step, final: null });
              continue;
            }
            const e: StepEvaluation = r.data;
            const reportFindings = findingsOfReport({ violations: e.reportViolations ?? [] }, { projectId: `${cell}/${block}/step-${String(step).padStart(2, '0')}` }, spec.style);
            const ids: IdFinding[] = [];
            const counted = new Set<string>();
            let nCorrect = 0;
            for (const b of e.blockingFindings) {
              const id = fromBlockingFinding(b, e.reportViolations);
              ids.push(id);
              const match = reportFindings.find((x) => x.violationId === b.violationId);
              if (match !== undefined && checkFinding(match, spec, facts).verdict === 'correct') {
                correct[v].add(id); nCorrect++;
                counted.add(edgeKey(b.ruleId, b.filePath, b.target));
              }
            }
            const contextId = JSON.stringify([es.path, es.sha256 ?? null, 'cypher-interp', 'v1.3', head, v]);
            steps[v].push({ step, final: { id: commit, contextId, ok: true, findings: ids, files: turn.snapshot.sourceFiles }, ...rho });
            if (step === 5) step5[v] = counted.size;
            if (v === 'literal') { totals.droppedViaReExport += stats.droppedViaReExport; totals.clearedReExportHop += stats.clearedReExportHop; totals.importsIngested += stats.importsIngested; }
            row[v] = {
              blocking: e.blockingViolationCount, correct: nCorrect, countedEdges: counted.size,
              byRule: Object.fromEntries(Object.entries(e.blockingByRule).filter(([, x]) => x > 0).sort()),
              edges: e.blockingFindings.map((b) => edgeKey(b.ruleId, b.filePath, b.target)).sort(),
              ...(v === 'literal' && { graph: { ...stats } }),
            };
          }
          if (ok) {
            const d = row.default as { edges: string[] }; const l = row.literal as { edges: string[] };
            row.edgeSetEqual = JSON.stringify(d.edges) === JSON.stringify(l.edges);
          }
          snapRows.push(row);
          prevCommit = commit;
          fs.rmSync(tree, { recursive: true, force: true });
          fs.rmSync(`${tree}.tsconfig.json`, { force: true });
          process.stdout.write(`${cell.padEnd(8)} ${block} step ${String(step)}: default ${JSON.stringify((row.default as { blocking?: number } | undefined)?.blocking)} literal ${JSON.stringify((row.literal as { blocking?: number } | undefined)?.blocking)}\n`);
        }
        const meta = { runId: run.runId, blockId: block, cell };
        const dDef = driftRun(steps.default, STUDY2_S2D01, (f) => correct.default.has(f), meta);
        const dLit = driftRun(steps.literal, STUDY2_S2D01, (f) => correct.literal.has(f), meta);
        gaps.push(blockGap(cell, block, dDef.D, dLit.D, step5.default, step5.literal));
        runRows.push({ cell, block, default: { D: dDef.D, Y1: dDef.Y1, Yk: dDef.Yk, incomplete: dDef.incomplete }, literal: { D: dLit.D, Y1: dLit.Y1, Yk: dLit.Yk, incomplete: dLit.incomplete } });
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // Reproduction check: the default D against the committed registered D, per (cell, block).
  let reproduction: Record<string, unknown> | null = null;
  if (checkRuns !== undefined) {
    const committed = readJson<{ cell: string; block: string; registered: { D: number | null } }[]>(checkRuns);
    const want = new Map(committed.map((r) => [`${r.cell}|${r.block}`, r.registered.D]));
    const mismatches = gaps.filter((g) => want.get(`${g.cell}|${g.block}`) !== g.defaultD).map((g) => ({ cell: g.cell, block: g.block, committed: want.get(`${g.cell}|${g.block}`) ?? null, default: g.defaultD }));
    reproduction = { committedRuns: committed.length, recomputedRuns: gaps.length, mismatches };
  }

  const cellNames = [...new Set(cells.map((c) => c.cell))];
  const cellGaps = cellNames.map((c) => cellGap(c, gaps));
  const bar = literalBar(cellGaps);
  const summary = {
    schema: 'study2b-literal-view/v1',
    params: { runCommit: head, engine: 'cypher-interp', scoringMode: 'v1.3', drift: STUDY2_S2D01, counted: 'check-correct verdict correct', view: 'literal: IMPORTS without viaReExport, reExportHop cleared, plus RE_EXPORTS', reference: LITERAL_REFERENCE, bar: `flag if a treated cell's mean per-block gap exceeds ${LITERAL_REFERENCE}'s by more than ${String(LITERAL_BAR)} identity` },
    snapshots: { scored: snapRows.length, distinctTrees: new Set(snapRows.map((s) => s.commit)).size, evaluationFailures: failures, edgeSetDiffers: snapRows.filter((s) => s.edgeSetEqual === false).length },
    literalGraph: totals,
    cells: cellGaps,
    bar,
    evasionFlagged: bar.some((b) => b.flagged === true),
    reproduction,
  };
  fs.mkdirSync(out, { recursive: true });
  const write = (f: string, v: unknown): void => { fs.writeFileSync(path.join(out, f), `${scrub(JSON.stringify(v, null, 1))}\n`); };
  write('snapshots.json', snapRows);
  write('blocks.json', { gaps, runs: runRows });
  write('summary.json', summary);
  process.stdout.write(`${JSON.stringify({ snapshots: summary.snapshots, literalGraph: totals, cells: cellGaps, bar, reproduction: reproduction === null ? null : { mismatches: (reproduction.mismatches as unknown[]).length } }, null, 1)}\n`);
  const reproFailed = reproduction !== null && (reproduction.mismatches as unknown[]).length > 0;
  return failures > 0 || reproFailed ? 1 : 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
