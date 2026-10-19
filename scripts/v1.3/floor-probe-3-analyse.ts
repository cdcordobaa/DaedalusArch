/**
 * v1.3 floor probe 3 (exploratory, not Study 2): per-step blocking and advisory findings of a loop-harness out-root.
 * A copy of the loop pilot's `loop-pilot-analyse.ts` (branch `v1.3-pilot-run`) with two changes: the firewall CLI runs
 * with `--engine cypher-interp` (no Neo4j), and the plan hashed in `summary.json` is `--plan`. Entry file: no exports.
 * Report: `Docs/DiagnosticRuns/v1.3-floor-probe-3-2026-10-16.md`.
 *
 * Usage (from the repository root): npx tsx scripts/v1.3/floor-probe-3-analyse.ts --out-root <out root> --work <scratch dir>
 *          --dest <analysis dir> --plan <plan.json>
 *
 * For each run and step it materialises the step's final snapshot (`finalCommit` of `steps/step-NN.json`) from the
 * run's `snapshots.git` into `<work>`, and re-evaluates it with the same evaluator the harness used (the firewall CLI,
 * symbolic-only, v1.3 scoring, the step's recorded spec, the pinned harness tsconfig of R01). The re-evaluation only
 * adds what the step record does not keep: per-rule advisory counts (for the FF-CV05 exclusion) and each violation's
 * type (its template, part of the memo §3 identity). Its blocking count is checked against the step record; a mismatch
 * is reported, and the step record stays the outcome of record.
 *
 * Outputs in `<dest>`: `reports/<run>/step-NN.json` (full reports), `steps.json` (per step), `new-blocking.json`
 * (memo §3 candidates), `check-correct-jobs.json` (input for `check-correct.ts`), `summary.json`.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildChildEnv } from '../../src/shared/process/node-process-runner.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { findingsOfReport } from './lib/labelling/findings.js';
import type { Finding } from './lib/labelling/findings.js';

const REPO = process.cwd();

/** The only parent variables the firewall child sees: what npx needs to start (the interpreter needs no Neo4j). */
const FIREWALL_ENV_ALLOW = ['PATH', 'HOME'] as const;

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) throw new Error(`--${name} is required`);
  return path.resolve(v);
}

interface Usage { costUsd?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; numTurns?: number; durationMs?: number }
interface Turn { turnId: string; kind: 'step' | 'repair'; result: { status: string; usage?: Usage; wallMs: number; interruptions?: unknown[]; attempts?: unknown[] }; snapshot?: { commit: string; loc: number; treeFileCount: number; typecheck?: { errors: number }; skeletonIntact?: boolean; evaluation?: { blockingViolationCount: number; advisoryViolationCount: number; blockingFindings: { ruleId: string; filePath: string; target?: string }[] }; evaluationError?: unknown } }
interface StepRec { runId: string; spec: { taskId: string; arm: string }; stepIndex: number; stepId: string; turns: Turn[]; repair: { attempted: boolean; blockingBefore: number | null; blockingAfter: number | null; cleared: boolean | null; skipped?: string } | null; repairOutcome?: { before: number; removed: number; remaining: number; introduced: number; introducedFindings: unknown[] }; evaluatorSpec?: { kind: string; path: string; sha256: string }; finalCommit: string; cost: { costUsd: number | null; inputTokens: number | null; outputTokens: number | null; wallMs: number } }

/** Memo §3 identity: rule id, template, file and target; for a cycle, the set of files. Lines are ignored. */
function identity(f: Finding): string {
  if (f.template === 'no-cyclic-deps') {
    const files = new Set<string>([f.file, ...(f.target !== undefined ? [f.target] : []), ...f.evidence.filter((e) => e.endsWith('.ts'))]);
    return JSON.stringify([f.ruleId, f.template, 'cycle', [...files].sort()]);
  }
  return JSON.stringify([f.ruleId, f.template, f.file, f.target ?? null]);
}

function nonBlankLoc(dir: string): number {
  let n = 0;
  const walk = (d: string): void => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) n += fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
    }
  };
  walk(path.join(dir, 'src'));
  return n;
}

function olsSlope(ys: readonly number[]): number | null {
  if (ys.length < 2) return null;
  const xs = ys.map((_, i) => i + 1);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += ((xs[i] ?? 0) - mx) * ((ys[i] ?? 0) - my);
    sxx += ((xs[i] ?? 0) - mx) ** 2;
  }
  return sxy / sxx;
}

const round = (x: number | null, d = 4): number | null => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

function main(): void {
  const outRoot = arg('out-root');
  const work = arg('work');
  const dest = arg('dest');
  fs.mkdirSync(dest, { recursive: true });
  const runDirs: string[] = [];
  const findRuns = (d: string): void => {
    if (fs.existsSync(path.join(d, 'run.json'))) runDirs.push(d);
    else for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) findRuns(path.join(d, e.name));
  };
  findRuns(path.join(outRoot, 'runs'));
  runDirs.sort();

  const stepRows: Record<string, unknown>[] = [];
  const newBlocking: Record<string, unknown>[] = [];
  const jobs: Record<string, unknown>[] = [];
  const runRows: Record<string, unknown>[] = [];
  for (const runDir of runDirs) {
    const runId = path.relative(path.join(outRoot, 'runs'), runDir);
    const stepFiles = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort();
    const seen = new Set<string>();
    const perKloc: number[] = [];
    const perKlocNoCv05: number[] = [];
    let runCost = 0;
    let runWall = 0;
    let unscored = 0;
    for (const sf of stepFiles) {
      const rec = JSON.parse(fs.readFileSync(path.join(runDir, 'steps', sf), 'utf8')) as StepRec;
      const stepNo = sf.slice(5, 7);
      const tree = path.join(work, runId, `step-${stepNo}`);
      fs.rmSync(tree, { recursive: true, force: true });
      fs.mkdirSync(tree, { recursive: true });
      const tar = execFileSync('git', ['--git-dir', path.join(runDir, 'snapshots.git'), 'archive', rec.finalCommit]);
      execFileSync('tar', ['-x', '-C', tree], { input: tar });
      fs.symlinkSync(path.join(runDir, 'work', 'node_modules'), path.join(tree, 'node_modules'));
      const tsconfig = path.join(work, runId, `tsconfig-${stepNo}.json`);
      fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
      // A static spec is repository-relative; a DDD spec frozen after step 1 is relative to its run directory.
      const specPath = path.resolve(rec.evaluatorSpec?.kind === 'frozen-after-step-1' ? runDir : REPO, rec.evaluatorSpec?.path ?? '');
      const reportPath = path.join(dest, 'reports', runId, `step-${stepNo}.json`);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      const finalTurn = rec.turns[rec.turns.length - 1];
      const loc = nonBlankLoc(tree);
      const kloc = loc / 1000;
      let out: Buffer;
      try {
        out = execFileSync('npx', ['tsx', path.join(REPO, 'bin/firewall.ts'), 'evaluate', '--post-seal', 'off', '--project', tree, '--spec', specPath, '--symbolic-only', '--engine', 'cypher-interp', '--scoring', 'v1.3', '--tsconfig', tsconfig, '--format', 'json'], { cwd: REPO, env: buildChildEnv(process.env, FIREWALL_ENV_ALLOW), maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        // Not scored (e.g. the frozen DDD spec is rejected by the pipeline): recorded, and left out of every slope.
        const stderr = (e as { stderr?: Buffer }).stderr?.toString('utf8') ?? String(e);
        stepRows.push({ runId, taskId: rec.spec.taskId, arm: rec.spec.arm, step: rec.stepIndex + 1, finalCommit: rec.finalCommit, loc, scored: false, reevalError: stderr.split('\n').filter((l) => l.trim() !== '').slice(-3).join(' | '), recordEvaluationError: finalTurn?.snapshot?.evaluationError ?? null, repair: rec.repair, typecheckErrors: finalTurn?.snapshot?.typecheck?.errors ?? null, files: finalTurn?.snapshot?.treeFileCount ?? null, cost: rec.cost, turns: rec.turns.map((t) => ({ kind: t.kind, ...t.result.usage, wallMs: t.result.wallMs })), specSha256: rec.evaluatorSpec?.sha256 ?? null });
        runCost += rec.cost.costUsd ?? 0;
        runWall += rec.cost.wallMs;
        unscored++;
        continue;
      }
      const report = JSON.parse(out.toString('utf8')) as { violations: unknown[]; tiers: { style: string; blocking: { violationCount: number; rules: { functionId: string }[] }; advisory: { violationCount: number; rules: { functionId: string; violationCount: number }[] } } };
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      const blockingIds = new Set(report.tiers.blocking.rules.map((r) => String(r.functionId)));
      const findings = findingsOfReport(report, { projectId: `${runId}/step-${stepNo}` }, report.tiers.style);
      // memo §3: FF-P06 FLOWS_TO rows are N/A, as in the tier table.
      const isNa = (f: Finding): boolean => f.ruleId === 'FF-P06' && f.discriminator.includes('FLOWS_TO');
      const blocking = findings.filter((f) => blockingIds.has(f.ruleId) && !isNa(f));
      const blockingNa = findings.filter((f) => blockingIds.has(f.ruleId) && isNa(f)).length;
      const advisoryByRule: Record<string, number> = {};
      for (const r of report.tiers.advisory.rules) if (r.violationCount > 0) advisoryByRule[String(r.functionId)] = r.violationCount;
      const advisory = report.tiers.advisory.violationCount;
      const cv05 = advisoryByRule['FF-CV05'] ?? 0;
      perKloc.push(kloc > 0 ? advisory / kloc : 0);
      perKlocNoCv05.push(kloc > 0 ? (advisory - cv05) / kloc : 0);
      const recordBlocking = finalTurn?.snapshot?.evaluation?.blockingViolationCount ?? null;
      // memo §3: new = no earlier step's final snapshot of the same run holds the same identity. (A gate step's
      // pre-repair snapshot is not re-evaluated here; the primary outcome uses the none arm, which has no repairs.)
      const ids = new Map<string, Finding>();
      for (const f of blocking) ids.set(identity(f), f);
      if (rec.stepIndex >= 1) {
        for (const [id, f] of ids) {
          if (seen.has(id)) continue;
          newBlocking.push({ runId, arm: rec.spec.arm, taskId: rec.spec.taskId, step: rec.stepIndex + 1, identity: JSON.parse(id), key: f.key, message: f.message });
        }
      }
      for (const id of ids.keys()) seen.add(id);
      jobs.push({ projectId: `${runId}/step-${stepNo}`, projectRoot: tree, spec: specPath, report: reportPath, style: report.tiers.style, tsconfig: 'adr-032' });
      const usage = rec.turns.map((t) => ({ kind: t.kind, ...t.result.usage, wallMs: t.result.wallMs, interruptions: (t.result.interruptions ?? []).length, attempts: (t.result.attempts ?? []).length }));
      runCost += rec.cost.costUsd ?? 0;
      runWall += rec.cost.wallMs;
      stepRows.push({
        runId, taskId: rec.spec.taskId, arm: rec.spec.arm, step: rec.stepIndex + 1, finalCommit: rec.finalCommit, scored: true,
        recordBlocking, reevalBlocking: report.tiers.blocking.violationCount, blockingFfp06FlowsToNa: blockingNa, blockingMatch: recordBlocking === report.tiers.blocking.violationCount,
        recordAdvisory: finalTurn?.snapshot?.evaluation?.advisoryViolationCount ?? null, advisory, advisoryCv05: cv05, advisoryByRule,
        loc, advisoryPerKloc: round(kloc > 0 ? advisory / kloc : 0), advisoryPerKlocNoCv05: round(kloc > 0 ? (advisory - cv05) / kloc : 0),
        blockingFindings: blocking.map((f) => ({ ruleId: f.ruleId, template: f.template, file: f.file, target: f.target ?? null })),
        stepBlockingBeforeRepair: rec.turns[0]?.snapshot?.evaluation?.blockingViolationCount ?? null,
        repair: rec.repair, repairOutcome: rec.repairOutcome ?? null,
        typecheckErrors: finalTurn?.snapshot?.typecheck?.errors ?? null, skeletonIntact: finalTurn?.snapshot?.skeletonIntact ?? null,
        files: finalTurn?.snapshot?.treeFileCount ?? null, evaluationError: finalTurn?.snapshot?.evaluationError ?? null,
        cost: rec.cost, turns: usage, specSha256: rec.evaluatorSpec?.sha256 ?? null,
      });
    }
    const scoredAll = unscored === 0;
    runRows.push({ runId, scoredSteps: stepFiles.length - unscored, slopePerKloc: scoredAll ? round(olsSlope(perKloc)) : null, slopePerKlocNoCv05: scoredAll ? round(olsSlope(perKlocNoCv05)) : null, perKloc: perKloc.map((x) => round(x)), perKlocNoCv05: perKlocNoCv05.map((x) => round(x)), costUsd: round(runCost, 2), wallMs: runWall });
  }
  const sha = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  fs.writeFileSync(path.join(dest, 'steps.json'), `${JSON.stringify(stepRows, null, 2)}\n`);
  fs.writeFileSync(path.join(dest, 'new-blocking.json'), `${JSON.stringify(newBlocking, null, 2)}\n`);
  fs.writeFileSync(path.join(dest, 'check-correct-jobs.json'), `${JSON.stringify({ schemaVersion: 1, kind: 'custom', jobs }, null, 2)}\n`);
  fs.writeFileSync(path.join(dest, 'summary.json'), `${JSON.stringify({ runs: runRows, newBlockingNoneArm: newBlocking.filter((n) => n.arm === 'none').length, plan: sha(arg('plan')) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(runRows, null, 2)}\nnew blocking (all arms): ${newBlocking.length}\n`);
}

main();
