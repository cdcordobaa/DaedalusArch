/**
 * Study 2b D†: the registered sensitivity primary with no composition-root exemption (pre-registration
 * `Docs/v1.4/study2b-preregistration.md` §1 and §4; Fable review 2026-10-20 finding 2). Entry file: no exports.
 * Helpers: `scripts/v1.4/lib/d-dagger.ts`. Additive: it changes no frozen path and no scorer.
 *
 * Usage (repository root; for 2b, at the freeze tag with this file copied in, as runbook §6 does for Stage C):
 *   npx tsx scripts/v1.4/d-dagger.ts --cell none@L2=<out-root> [--cell <cell>=<out-root> ...]
 *     --node-modules <skeleton install>/node_modules --out <dir>
 *
 * For every run under each out-root and every step's final snapshot (`git archive` from the run's `snapshots.git`),
 * the snapshot is evaluated as `scripts/v1.4/exposure-count.ts` does (`evaluateProject`, scoring v1.3, cypher-interp,
 * the harness tsconfig, the step's static `evaluatorSpec` with its sha256 checked), keeping the evaluated graph. On it,
 * the FF-S03 opportunity query (`opportunityQuery`, the compiled no-layer-skip Cypher without its violation
 * predicate) runs with `excludePatterns` emptied, so a Q25 = B composition root (`main.ts`, `*.module.ts`,
 * `*Container.ts`, `*container.ts`, `composition-root/`) is not exempt. The presentation → persistence edges are the
 * D† identities; D†, Y₁† and Yₖ† come from `driftRun` under `STUDY2_S2D01` with ρ from `git diff -M50%`, exactly as D.
 * The patterns removed are written per snapshot, so a reader can check that only the composition-root globs went.
 *
 * Writes <out>/runs.json (per run: D†, Y₁†, Yₖ†, new edges per step with the exempt flag, renames to exempt names),
 * <out>/summary.json (per cell: D† values, the evasion bar's shares). Paths under the out-roots become
 * `<out-root:cell>`. Zero model calls, no Neo4j, no network. Exit 0 ok, 1 an evaluation failed, 2 usage error.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { renameMapBetween } from '../lib/drift/git-rename.js';
import { driftRun, type StepInput } from '../lib/drift/study2-d.js';
import { STUDY2_S2D01 } from '../lib/drift/types.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { createPipeline, postSealRulesOf } from '../../src/pipeline/pipeline-factory.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { createInterpEvaluator } from '../../src/mcp-server/interp-evaluator.js';
import { evaluateProject } from '../../src/mcp-server/evaluate-project.js';
import { CONSTRUCT_COMPOSITION_ROOT_GLOBS, globMatcher } from '../../src/construct-switches/overlays.js';
import type { FirewallContext } from '../../src/shared/context/firewall-context.js';
import { opportunityQuery } from './lib/exposure.js';
import { cellEvasion, daggerEdges, daggerFindings, newEdgesByStep, renamesToExempt, type DaggerEdge, type OpportunityRow, type RunEvasion } from './lib/d-dagger.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const isExempt = globMatcher(CONSTRUCT_COMPOSITION_ROOT_GLOBS);

interface RunJson { runId: string; spec: { taskId: string; arm: string; runIndex: number } }
interface StepRec {
  stepIndex: number;
  evaluatorSpec?: { kind: string; path: string; sha256?: string };
  turns: { turnId: string; snapshot: { commit: string; evaluation?: unknown | null; sourceFiles?: string[] } }[];
}

function runDirs(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || ['snapshots.git', 'work', 'turns', 'steps', 'calls', 'node_modules', 'home'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
    else out.push(...runDirs(p));
  }
  return out;
}

function materialise(gitDir: string, commit: string, tree: string, nodeModules: string): string {
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['--git-dir', gitDir, 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  if (!fs.existsSync(path.join(tree, 'node_modules'))) fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  const tsconfig = `${tree}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  return tsconfig;
}

/** Evaluates one tree and returns the FF-S03 opportunity rows with the exclusion patterns emptied. */
async function opportunityRows(tree: string, specPath: string, tsconfig: string): Promise<{ rows: OpportunityRow[]; removedPatterns: string[] }> {
  const repo = new MemoryGraphRepository();
  let context: FirewallContext | undefined;
  const interp = createInterpEvaluator({
    makePipeline: (config) => {
      const bundle = createPipeline({ ...config, postSealRules: postSealRulesOf(config), graphRepository: repo });
      context = bundle.context;
      return bundle;
    },
  });
  const r = await evaluateProject(
    { projectPath: tree, specPath, scoringMode: 'v1.3', includeViolations: true, tsconfigPath: tsconfig },
    {},
    { makeGraph: () => { throw new Error('d-dagger: Neo4j is never used'); }, makePipeline: createPipeline, graphEngine: 'cypher-interp', interp },
  );
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  if (context === undefined) throw new Error('no pipeline context');
  const q = context.getCompiledFunctions().symbolicQueries.find((x) => String(x.functionId) === 'FF-S03');
  if (q === undefined) throw new Error('FF-S03 is not compiled for this spec');
  const o = opportunityQuery({ functionId: 'FF-S03', name: q.name, cypher: q.cypher, params: q.params });
  if (o === null) throw new Error('FF-S03 has no opportunity query');
  const removed = Array.isArray(q.params.excludePatterns) ? (q.params.excludePatterns as unknown[]).map(String) : [];
  const res = await repo.executeQuery(o.cypher, { ...o.params, excludePatterns: [] });
  if (!res.success) throw new Error(res.errors.map((e) => e.message).join('; '));
  const rows = res.data.records.map((x) => ({ source: String(x.source), target: String(x.target), srcLayer: x.srcLayer, tgtLayer: x.tgtLayer, relType: x.relType }));
  return { rows, removedPatterns: removed };
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
    process.stderr.write('usage: d-dagger.ts --cell <cell>=<out-root> ... --node-modules <dir> --out <dir>\n');
    return 2;
  }
  const nodeModules = path.resolve(nm);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'd-dagger-'));
  const scrub = (s: string): string => cells.reduce((acc, c) => acc.split(c.root).join(`<out-root:${c.cell}>`), s.split(scratch).join('<scratch>').split(REPO).join('.'));
  const runRows: Record<string, unknown>[] = [];
  const evasion = new Map<string, RunEvasion[]>();
  const removedSeen = new Set<string>();
  let failures = 0;
  try {
    for (const { cell, root } of cells) {
      for (const runDir of runDirs(path.join(root, 'runs'))) {
        const run = readJson<RunJson>(path.join(runDir, 'run.json'));
        const rep = run.spec.runIndex + 1;
        const task = run.spec.taskId;
        const gitDir = path.join(runDir, 'snapshots.git');
        const recs = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort().map((f) => readJson<StepRec>(path.join(runDir, 'steps', f)));
        const steps: StepInput[] = [];
        const perStep: { step: number; edges: DaggerEdge[] }[] = [];
        const renames: { step: number; from: string; to: string }[] = [];
        let prev: string | null = null;
        let failed = false;
        for (const rec of recs) {
          const step = rec.stepIndex + 1;
          const es = rec.evaluatorSpec;
          const turn = rec.turns.at(-1);
          if (es?.kind !== 'static' || turn === undefined || turn.snapshot.evaluation === null || turn.snapshot.evaluation === undefined) {
            steps.push({ step, final: null });
            continue;
          }
          const specPath = path.resolve(REPO, es.path);
          if (es.sha256 !== undefined && sha256(specPath) !== es.sha256) throw new Error(`${es.path}: sha256 differs from the step record`);
          const commit = turn.snapshot.commit;
          const tree = path.join(scratch, 'tree');
          try {
            const tsconfig = materialise(gitDir, commit, tree, nodeModules);
            const { rows, removedPatterns } = await opportunityRows(tree, specPath, tsconfig);
            for (const p of removedPatterns) removedSeen.add(p);
            const edges = daggerEdges(rows, isExempt);
            perStep.push({ step, edges });
            const rename = prev === null ? undefined : renameMapBetween(gitDir, prev, commit, '.', '');
            if (rename?.renameDetection === 'skipped') throw new Error('rename detection skipped between steps');
            for (const r of renamesToExempt(rename?.rename, isExempt)) renames.push({ step, ...r });
            steps.push({ step, final: { id: commit, contextId: 'd-dagger', ok: true, findings: daggerFindings(edges), files: turn.snapshot.sourceFiles }, ...(step > 1 ? { rename: rename?.rename ?? new Map<string, string>() } : {}) });
            prev = commit;
          } catch (e) {
            failures++;
            failed = true;
            process.stderr.write(`${cell} ${task}/rep${String(rep)} step ${String(step)}: ${scrub(e instanceof Error ? e.message : String(e))}\n`);
            steps.push({ step, final: null });
          }
          fs.rmSync(tree, { recursive: true, force: true });
          fs.rmSync(`${tree}.tsconfig.json`, { force: true });
        }
        const d = driftRun(steps, STUDY2_S2D01, undefined, { runId: run.runId, blockId: `${task}/rep${String(rep)}`, cell });
        const last = perStep.at(-1)?.edges ?? [];
        const ev: RunEvasion = { lastStepEdges: last.length, lastStepExempt: last.filter((e) => e.exemptSource).length, renamesToExempt: renames.length };
        evasion.set(cell, [...(evasion.get(cell) ?? []), ev]);
        const fresh = newEdgesByStep(perStep);
        runRows.push({
          cell, task, rep, block: `${task}/rep${String(rep)}`, runId: run.runId, failed,
          dagger: { D: d.D, Y1: d.Y1, Yk: d.Yk, perStepNew: d.perStep.map((p) => p.newCount), inheritedRemoved: d.inheritedRemoved, incomplete: d.incomplete, renameMapMissing: d.renameMapMissing },
          edgesPerStep: perStep.map((s) => ({ step: s.step, edges: s.edges.length, exempt: s.edges.filter((e) => e.exemptSource).length })),
          newEdges: fresh.map((x) => ({ step: x.step, source: x.edge.source, target: x.edge.target, exemptSource: x.edge.exemptSource })),
          renamesToExempt: renames,
          evasion: ev,
        });
        process.stdout.write(`${cell.padEnd(8)} ${task}/rep${String(rep)}: D† ${String(d.D)} Y1† ${String(d.Y1)} Yk† ${String(d.Yk)}; last-step edges ${String(ev.lastStepEdges)} (exempt ${String(ev.lastStepExempt)}); renames to exempt ${String(ev.renamesToExempt)}\n`);
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const cellNames = [...new Set(cells.map((c) => c.cell))];
  const summary = {
    params: { definition: 'new distinct presentation -> persistence import edges at steps 2..5, from any file, no composition-root exemption; FF-S03 opportunity query with excludePatterns emptied; driftRun STUDY2_S2D01', engine: 'cypher-interp', scoringMode: 'v1.3', removedPatterns: [...removedSeen].sort(), exemptGlobs: CONSTRUCT_COMPOSITION_ROOT_GLOBS },
    cells: cellNames.map((c) => ({
      cell: c,
      Ddagger: runRows.filter((r) => r.cell === c).map((r) => ({ block: r.block, D: (r.dagger as { D: number | null }).D })),
      evasion: cellEvasion(c, evasion.get(c) ?? []),
    })),
    failures,
  };
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'runs.json'), `${scrub(JSON.stringify(runRows, null, 1))}\n`);
  fs.writeFileSync(path.join(out, 'summary.json'), `${scrub(JSON.stringify(summary, null, 1))}\n`);
  process.stdout.write(`removed patterns: ${JSON.stringify(summary.params.removedPatterns)}; failures ${String(failures)}\n`);
  return failures > 0 ? 1 : 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
