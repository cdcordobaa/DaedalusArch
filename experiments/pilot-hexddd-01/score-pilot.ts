/**
 * HEXDDD-01 pilot scorer (zero calls: no model, no Neo4j, no network). Design §4 (D_seed), §5.2 (pass bar),
 * `pass-bar.md` (the operational reading fixed before any call).
 *
 * Usage (repository root):
 *   npx tsx experiments/pilot-hexddd-01/score-pilot.ts --out-root <O> --node-modules <H>/skeleton-install/node_modules
 *     --results results/v1.4-pilot-hexddd-01
 *
 * For each pilot run under `<O>/runs/`: the seed tree (the run's base commit) and every step-final commit are taken
 * from the run's `snapshots.git` (`git archive`), linked to the skeleton install, and evaluated as
 * `scripts/v1.4/stage-c-rescore.ts` does: `firewallEvaluator` (scoring v1.3, the switch-aware tier resolver) on the
 * `cypher-interp` engine, the harness tsconfig, the step's recorded spec (sha256 checked); the instrument is the code
 * at the current checkout (main). Every blocking finding goes through check-correct (`checkFinding`, ADR-032 tsconfig).
 *
 * Outputs (blind-read split, `results/.../README.md`):
 * - `diffs/<task>/step-NN.diff`: `git diff` of the step-final tree against the previous one (step 1 against the seed),
 *   plain text, every agent-written file;
 * - `scores/<task>/step-00-seed.json`, `scores/<task>/step-NN.json`: every finding, blocking (with the check-correct
 *   verdict) and advisory;
 * - `scores/summary.json`: D_seed per run (the pass-bar reading and a secondary file-level-inclusive reading), the
 *   advisory candidates for pass-bar (b), and the pass-bar evaluation;
 * - `counts.json`: counts only (no finding), for the top-level run report.
 * Absolute paths under the out-root and the scratch directory are replaced by `<out-root>` and `<scratch>`.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../src/mcp-server/context.js';
import { renameMapBetween } from '../../scripts/lib/drift/git-rename.js';
import { fromBlockingFinding } from '../../scripts/lib/drift/identity.js';
import { driftRun, type StepInput } from '../../scripts/lib/drift/study2-d.js';
import { STUDY2_S2D01, type DriftParams, type DriftRun, type IdFinding } from '../../scripts/lib/drift/types.js';
import { buildHarnessTsconfig } from '../../scripts/lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, taggedEvaluator } from '../../scripts/lib/loop/engine-tee.js';
import { firewallEvaluator } from '../../scripts/lib/loop/evaluator.js';
import type { BlockingFinding, RunRecord, StepEvaluation, StepRecord } from '../../scripts/lib/loop/types.js';
import { checkFinding } from '../../scripts/v1.3/lib/labelling/correctness.js';
import { findingsOfReport, templateOf } from '../../scripts/v1.3/lib/labelling/findings.js';
import { SourceFacts } from '../../scripts/v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../../scripts/v1.3/lib/labelling/spec-facts.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Pass-bar (b) rules (design §5.2). */
export const ADVISORY_B_RULES: readonly string[] = ['FF-S03', 'FF-P02', 'FF-DT05', 'FF-DT06'];
/** D_seed as fixed in `pass-bar.md`: STUDY2_S2D01, seed = step 1, agent steps 2..6. */
export const D_SEED: DriftParams = { ...STUDY2_S2D01, kFrom: 2, kTo: 6 };
/** Secondary reading (reported, not the pass bar): file-level findings keep their fine key. */
export const D_SEED_FILE_LEVEL: DriftParams = { ...D_SEED, edgeOnly: false };

interface ReportRow { readonly id?: string; readonly functionId?: unknown; readonly filePath?: unknown; readonly target?: unknown; readonly line?: unknown; readonly message?: unknown; readonly type?: unknown; readonly discriminator?: unknown }

interface ScoredFinding {
  readonly tier: 'blocking' | 'advisory';
  readonly ruleId: string;
  readonly file: string;
  readonly line: number | null;
  readonly target: string | null;
  readonly message: string;
  readonly checkCorrect?: { readonly verdict: string; readonly reason: string };
}

function materialise(gitDir: string, commit: string, tree: string, nodeModules: string): void {
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['--git-dir', gitDir, 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  if (!fs.existsSync(path.join(tree, 'node_modules'))) fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  fs.writeFileSync(`${tree}.tsconfig.json`, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
}

function runDirs(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || ['snapshots.git', 'work', 'turns', 'steps'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
    else out.push(...runDirs(p));
  }
  return out;
}

/** `src/**\/*.ts` of a tree, POSIX, sorted (the skeleton's `node_modules` link is never entered). */
function srcFiles(tree: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const abs = path.join(tree, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.ts')) out.push(r);
    }
  };
  walk('src');
  return out.sort();
}

/** An advisory report row as an identity (the loop's `BlockingFinding` shape, so `fromBlockingFinding` keys it alike). */
function advisoryAsFinding(v: ReportRow): BlockingFinding {
  const ruleId = String(v.functionId);
  return {
    ruleId,
    ruleName: ruleId,
    template: templateOf(String(v.type ?? ''), ruleId),
    ...(typeof v.id === 'string' ? { violationId: v.id } : {}),
    filePath: String(v.filePath ?? ''),
    ...(typeof v.line === 'number' ? { line: v.line } : {}),
    ...(typeof v.target === 'string' ? { target: v.target } : {}),
    message: String(v.message ?? ''),
  };
}

async function main(): Promise<number> {
  const outRoot = arg('out-root');
  const nm = arg('node-modules');
  const results = arg('results');
  if (outRoot === undefined || nm === undefined || results === undefined) {
    process.stderr.write('usage: score-pilot.ts --out-root <O> --node-modules <dir> --results <dir>\n');
    return 2;
  }
  const root = path.resolve(outRoot);
  const nodeModules = path.resolve(nm);
  const resultsDir = path.resolve(REPO, results);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hexddd-01-score-'));
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(root).join('<out-root>').split(REPO).join('.');
  const env = engineEnv(process.env, 'cypher-interp');
  const deps = engineDeps(buildContext({}, env).evaluateDeps, 'cypher-interp');
  const write = (rel: string, v: unknown): void => {
    const f = path.join(resultsDir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof v === 'string' ? v : `${scrub(JSON.stringify(v, null, 1))}\n`);
  };
  fs.rmSync(path.join(resultsDir, 'diffs'), { recursive: true, force: true });
  fs.rmSync(path.join(resultsDir, 'scores'), { recursive: true, force: true });

  const summaryRuns: Record<string, unknown>[] = [];
  const countRuns: Record<string, unknown>[] = [];
  let failures = 0;
  let n = 0;
  try {
    for (const runDir of runDirs(path.join(root, 'runs'))) {
      const run = readJson<RunRecord>(path.join(runDir, 'run.json'));
      const task = run.spec.taskId;
      const gitDir = path.join(runDir, 'snapshots.git');
      const recs = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort().map((f) => readJson<StepRecord>(path.join(runDir, 'steps', f)));
      const es = recs[0]?.evaluatorSpec;
      if (es?.kind !== 'static') throw new Error(`${run.runId}: expected a static evaluator spec`);
      const specPath = path.resolve(REPO, es.path);
      if (es.sha256 !== null && sha256(specPath) !== es.sha256) throw new Error(`${es.path}: sha256 differs from the step record`);
      const ev = taggedEvaluator(firewallEvaluator(specPath, env, deps, (dir) => `${dir}.tsconfig.json`), 'cypher-interp');
      const spec = await loadSpecView(specPath);
      const contextId = JSON.stringify([es.path, es.sha256, 'cypher-interp', 'v1.3', head]);

      // Step 0 = the seed (the base commit), then the step-final commits.
      const points: { step: number; commit: string; label: string; status: string | null; typecheckErrors: number | null }[] = [
        { step: 0, commit: run.baseCommit, label: 'step-00-seed', status: null, typecheckErrors: null },
        ...recs.map((r) => {
          const t = r.turns.at(-1);
          return { step: r.stepIndex + 1, commit: r.finalCommit, label: `step-${String(r.stepIndex + 1).padStart(2, '0')}`, status: t?.result.status ?? null, typecheckErrors: t?.snapshot.typecheck?.errors ?? null };
        }),
      ];
      const blockingSteps: StepInput[] = [];
      const advisorySteps: StepInput[] = [];
      const correctIds = new Set<IdFinding>();
      const perStepCounts: Record<string, unknown>[] = [];
      let prev: string | null = null;
      for (const p of points) {
        if (prev !== null) {
          const diff = execFileSync('git', ['--git-dir', gitDir, 'diff', '-M50%', '--no-color', prev, p.commit, '--', '.', ':(exclude)node_modules'], { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
          const stat = execFileSync('git', ['--git-dir', gitDir, 'diff', '-M50%', '--shortstat', prev, p.commit, '--', '.', ':(exclude)node_modules'], { encoding: 'utf8' }).trim();
          write(`diffs/${task}/${p.label}.diff`, `# ${task} ${p.label}: tree after the step against the tree before it (${stat || 'no change'})\n${diff}`);
        }
        const tree = path.join(scratch, `t${String(n++)}`);
        materialise(gitDir, p.commit, tree, nodeModules);
        const r = await ev.evaluate(tree, run.runId);
        if (!r.success) {
          failures++;
          process.stderr.write(`${task} ${p.label}: ${scrub(r.errors.map((e) => e.message).join('; '))}\n`);
          if (p.step > 0) {
            blockingSteps.push({ step: p.step + 1, final: null });
            advisorySteps.push({ step: p.step + 1, final: null });
          }
          prev = p.commit;
          continue;
        }
        const e: StepEvaluation = r.data;
        const reportFindings = findingsOfReport({ violations: e.reportViolations ?? [] }, { projectId: `${task}/${p.label}` }, spec.style);
        const facts = new SourceFacts(tree, { tsconfig: 'adr-032' });
        const blockingIds: IdFinding[] = [];
        const scored: ScoredFinding[] = [];
        for (const b of e.blockingFindings) {
          const id = fromBlockingFinding(b, e.reportViolations);
          blockingIds.push(id);
          const match = reportFindings.find((x) => x.violationId === b.violationId);
          const c = match === undefined ? { verdict: 'unmatched', reason: 'no report row with this violation id' } : checkFinding(match, spec, facts);
          if (c.verdict === 'correct') correctIds.add(id);
          scored.push({ tier: 'blocking', ruleId: b.ruleId, file: b.filePath, line: b.line ?? null, target: b.target ?? null, message: b.message, checkCorrect: { verdict: c.verdict, reason: scrub(c.reason) } });
        }
        const blockingVids = new Set(e.blockingFindings.map((b) => b.violationId));
        const advisoryRows = ((e.reportViolations ?? []) as ReportRow[]).filter((v) => typeof v.id === 'string' && !blockingVids.has(v.id) && (e.advisoryByRule?.[String(v.functionId)] ?? 0) > 0);
        const advisoryIds: IdFinding[] = [];
        for (const v of advisoryRows) {
          const b = advisoryAsFinding(v);
          if (ADVISORY_B_RULES.includes(b.ruleId)) advisoryIds.push(fromBlockingFinding(b, e.reportViolations));
          scored.push({ tier: 'advisory', ruleId: b.ruleId, file: b.filePath, line: b.line ?? null, target: b.target ?? null, message: b.message });
        }
        const advisoryCountByRule: Record<string, number> = {};
        for (const s of scored) if (s.tier === 'advisory') advisoryCountByRule[s.ruleId] = (advisoryCountByRule[s.ruleId] ?? 0) + 1;
        write(`scores/${task}/${p.label}.json`, {
          task, step: p.step, label: p.label, commit: p.commit, turnStatus: p.status, typecheckErrors: p.typecheckErrors,
          verdict: e.verdict, blockingByRule: e.blockingByRule, advisoryByRule: e.advisoryByRule ?? {}, advisoryRowsListed: advisoryCountByRule,
          findings: scored,
        });
        const files = srcFiles(tree);
        const rename = prev === null ? undefined : renameMapBetween(gitDir, prev, p.commit, '.', '');
        const rho = p.step > 0 ? { rename: rename?.rename ?? new Map<string, string>() } : {};
        blockingSteps.push({ step: p.step + 1, final: { id: p.commit, contextId, ok: true, findings: blockingIds, files }, ...rho });
        advisorySteps.push({ step: p.step + 1, final: { id: p.commit, contextId, ok: true, findings: advisoryIds, files }, ...rho });
        perStepCounts.push({
          step: p.step, turnStatus: p.status, typecheckErrors: p.typecheckErrors,
          blocking: e.blockingViolationCount, blockingCorrect: scored.filter((s) => s.checkCorrect?.verdict === 'correct').length,
          advisory: e.advisoryViolationCount, advisoryBRules: advisoryIds.length,
        });
        fs.rmSync(tree, { recursive: true, force: true });
        fs.rmSync(`${tree}.tsconfig.json`, { force: true });
        prev = p.commit;
      }
      const meta = { runId: run.runId, blockId: task, cell: 'none@brownfield' };
      const dSeed: DriftRun = driftRun(blockingSteps, D_SEED, (f) => correctIds.has(f), meta);
      const dSeedFile: DriftRun = driftRun(blockingSteps, D_SEED_FILE_LEVEL, (f) => correctIds.has(f), meta);
      const dSeedUnlabelled: DriftRun = driftRun(blockingSteps, D_SEED, undefined, meta);
      const advB: DriftRun = driftRun(advisorySteps, D_SEED_FILE_LEVEL, undefined, meta);
      // The new advisory (b) identities, in the step they first appear (candidates for the hand read).
      const candidates: { step: number; ruleId: string; file: string; target: string | null }[] = [];
      const seen = new Set<string>();
      for (const s of advisorySteps) {
        for (const f of s.final?.findings ?? []) {
          const k = `${f.functionId}|${f.filePath}|${f.target ?? ''}`;
          if (!seen.has(k) && s.step >= 2) candidates.push({ step: s.step - 1, ruleId: f.functionId, file: f.filePath, target: f.target ?? null });
          seen.add(k);
        }
      }
      const pick = (d: DriftRun): Record<string, unknown> => ({ D: d.D, Yseed: d.Y1, Yk: d.Yk, perAgentStepNew: d.perStep.map((p) => p.newCount), renameMapMissing: d.renameMapMissing, incomplete: d.incomplete });
      summaryRuns.push({
        task, runId: run.runId,
        D_seed: pick(dSeed), D_seed_fileLevelIncluded: pick(dSeedFile), D_seed_unlabelled: pick(dSeedUnlabelled),
        advisoryB: { newIdentities: advB.D, perAgentStepNew: advB.perStep.map((p) => p.newCount), candidates },
        steps: perStepCounts,
      });
      countRuns.push({ task, D_seed: dSeed.D, D_seed_fileLevelIncluded: dSeedFile.D, advisoryBNew: advB.D, steps: perStepCounts });
      process.stdout.write(`${task}: D_seed ${String(dSeed.D)} (file-level included ${String(dSeedFile.D)}, unlabelled ${String(dSeedUnlabelled.D)}), advisory (b) new ${String(advB.D)}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const a = summaryRuns.some((r) => ((r.D_seed as { D: number | null }).D ?? 0) >= 1);
  const bCandidates = summaryRuns.length === 2 && summaryRuns.every((r) => ((r.advisoryB as { newIdentities: number | null }).newIdentities ?? 0) >= 1);
  const passBar = {
    a: { holds: a, rule: 'D_seed >= 1 in at least 1 of the 2 runs' },
    b: { candidatesInBothRuns: bCandidates, holds: bCandidates ? 'pending hand read' : false, rule: 'in both runs, >= 1 new advisory identity in FF-S03, FF-P02, FF-DT05 or FF-DT06 that the hand read confirms as a P1-P4 violation' },
    verdict: summaryRuns.length !== 2 || failures > 0 ? 'INCOMPLETE' : a ? 'PASS' : bCandidates ? 'PENDING (hand read)' : 'FAIL',
  };
  const params = { instrumentCommit: head, engine: 'cypher-interp', scoringMode: 'v1.3', dSeed: D_SEED, secondary: D_SEED_FILE_LEVEL, counted: 'check-correct verdict correct', advisoryBRules: ADVISORY_B_RULES, evaluationFailures: failures };
  write('scores/summary.json', { schema: 'hexddd-01-scores/v1', params, runs: summaryRuns, passBar });
  write('counts.json', { schema: 'hexddd-01-counts/v1', params, runs: countRuns, passBar });
  process.stdout.write(`pass bar: ${passBar.verdict}\n`);
  return failures > 0 ? 1 : 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
