/**
 * v1.3 loop pilot, tool defect T1: offline re-score of the kept DDD snapshots under each construct option
 * (`Docs/DiagnosticRuns/v1.3-pilot-t1-options-2026-10-16.md`). Entry file: no exports.
 *
 * Usage (from the repository root):
 *   npx tsx scripts/v1.3/loop-pilot-t1-rescore.ts --out-root <pilot out root> --work <scratch dir> --dest <analysis dir>
 *     --node-modules <skeleton node_modules> [--engine-check]
 *
 * No model call, no agent re-run, no Neo4j: every evaluation is the firewall CLI with `--engine cypher-interp`,
 * symbolic-only, v1.3 scoring, against the run's frozen spec as recorded (`steps/step-NN.json` `evaluatorSpec`), on the
 * step's final snapshot (`finalCommit`) taken from the run's `snapshots.git`. The frozen spec and the snapshots are
 * read, never written. `--node-modules` is a reinstall of the pinned generator skeleton
 * (`scripts/generator/skeleton/`, `npm ci --ignore-scripts`), because each run's `work/node_modules` links into the
 * pilot machine's harness root, which was not kept.
 *
 * Options (each OFF by default in the tool):
 * - `fail`: the status quo (`--empty-aggregates fail`); expected to reproduce BR-SPEC-10 on every DDD snapshot;
 * - `a` not-applicable, `c` exclude, `d` vacuous: `--empty-aggregates <policy>`;
 * - `b`: the validator with `rejectEmptyAggregates` on the frozen spec and the step-1 tree, as the freezer would have
 *   run it; a rejected spec means no snapshot of that run is scored.
 *
 * Memo §3 (`Docs/v1.3/pilot-outcome-memo.md`) is applied per option exactly as `loop-pilot-analyse.ts` applies it:
 * blocking findings of the step's final snapshot, FF-P06 FLOWS_TO rows N/A, a finding is new at step s ≥ 2 when no
 * earlier step of the same run holds its identity (rule, template, file, target; a cycle by its file set).
 * `check-correct-jobs.json` lists the snapshots with a new `none`-arm blocking finding, for `check-correct.ts`.
 *
 * `--engine-check` also re-evaluates the scored (non-DDD) snapshots with the in-process engine and compares the
 * blocking count with the step record (which came from Neo4j), as a parity check of the engine on these trees.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildChildEnv } from '../../src/shared/process/node-process-runner.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { validateSpecAgainstProject } from '../../src/spec-parser/spec-validator.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { findingsOfReport } from './lib/labelling/findings.js';
import type { Finding } from './lib/labelling/findings.js';

const REPO = process.cwd();
const FIREWALL_ENV_ALLOW = ['PATH', 'HOME'] as const;
const POLICIES = [
  { option: 'status-quo', policy: 'fail' },
  { option: 'a', policy: 'not-applicable' },
  { option: 'c', policy: 'exclude' },
  { option: 'd', policy: 'vacuous' },
] as const;

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) throw new Error(`--${name} is required`);
  return path.resolve(v);
}

interface StepRec {
  stepIndex: number;
  spec: { taskId: string; arm: string };
  finalCommit: string;
  evaluatorSpec?: { kind: string; path: string; sha256: string };
  turns: { snapshot?: { evaluation?: { blockingViolationCount: number }; evaluationError?: unknown } }[];
}
interface Report { violations: unknown[]; warnings?: { code: string; message: string }[]; tiers: { style: string; blocking: { violationCount: number; rules: { functionId: string }[] }; advisory: { violationCount: number; rules: { functionId: string; violationCount: number }[] } } }

/** Memo §3 identity, as in `loop-pilot-analyse.ts`. */
function identity(f: Finding): string {
  if (f.template === 'no-cyclic-deps') {
    const files = new Set<string>([f.file, ...(f.target !== undefined ? [f.target] : []), ...f.evidence.filter((e) => e.endsWith('.ts'))]);
    return JSON.stringify([f.ruleId, f.template, 'cycle', [...files].sort()]);
  }
  return JSON.stringify([f.ruleId, f.template, f.file, f.target ?? null]);
}

function findRuns(d: string, out: string[]): string[] {
  if (fs.existsSync(path.join(d, 'run.json'))) out.push(d);
  else for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) findRuns(path.join(d, e.name), out);
  return out;
}

function materialise(runDir: string, commit: string, tree: string, nodeModules: string): string {
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['--git-dir', path.join(runDir, 'snapshots.git'), 'archive', commit]);
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  const tsconfig = `${tree}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  return tsconfig;
}

function evaluate(tree: string, spec: string, tsconfig: string, policy: string): { report?: Report; error?: string } {
  try {
    const out = execFileSync('npx', ['tsx', path.join(REPO, 'bin/firewall.ts'), 'evaluate', '--post-seal', 'off', '--project', tree, '--spec', spec, '--symbolic-only',
      '--scoring', 'v1.3', '--tsconfig', tsconfig, '--format', 'json', '--engine', 'cypher-interp', '--empty-aggregates', policy],
    { cwd: REPO, env: buildChildEnv(process.env, FIREWALL_ENV_ALLOW), maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    return { report: JSON.parse(out.toString('utf8')) as Report };
  } catch (e) {
    // The CLI exits 1 on a hard-block verdict with the report on stdout; only an empty stdout is a failure.
    const stdout = (e as { stdout?: Buffer }).stdout?.toString('utf8') ?? '';
    if (stdout.trim().startsWith('{')) return { report: JSON.parse(stdout) as Report };
    const stderr = (e as { stderr?: Buffer }).stderr?.toString('utf8') ?? String(e);
    return { error: stderr.split('\n').filter((l) => l.trim() !== '').slice(-1).join(' ') };
  }
}

function summarise(report: Report, projectId: string): { blocking: Finding[]; advisory: number; cv05: number; blockingRules: string[]; recordWarnings: string[] } {
  const blockingIds = new Set(report.tiers.blocking.rules.map((r) => String(r.functionId)));
  const findings = findingsOfReport(report, { projectId }, report.tiers.style);
  const isNa = (f: Finding): boolean => f.ruleId === 'FF-P06' && f.discriminator.includes('FLOWS_TO');
  const cv05 = report.tiers.advisory.rules.find((r) => String(r.functionId) === 'FF-CV05')?.violationCount ?? 0;
  return {
    blocking: findings.filter((f) => blockingIds.has(f.ruleId) && !isNa(f)),
    advisory: report.tiers.advisory.violationCount,
    cv05,
    blockingRules: [...blockingIds].sort(),
    recordWarnings: (report.warnings ?? []).filter((w) => w.code === 'COMPILER_004' || w.code === 'COMPILER_006').map((w) => `${w.code}: ${w.message}`),
  };
}

async function optionB(spec: string, step1Tree: string): Promise<{ rejected: boolean; errors: string[] }> {
  const parsed = await parseSpec({ specFilePath: spec });
  if (!parsed.success) return { rejected: true, errors: parsed.errors.map((e) => e.message) };
  const report = validateSpecAgainstProject(parsed.data, step1Tree, { rules: 'v1.3', rejectEmptyAggregates: true });
  // As the freezer reads it (`freezeCheck`): LAYER_DIR_NOT_FOUND is a warning there, every other error rejects.
  const errors = report.errors.filter((e) => e.code !== 'LAYER_DIR_NOT_FOUND').map((e) => `${e.code}: ${e.message}`);
  return { rejected: errors.length > 0, errors };
}

async function main(): Promise<void> {
  const outRoot = arg('out-root');
  const work = arg('work');
  const dest = arg('dest');
  const nodeModules = arg('node-modules');
  const engineCheck = process.argv.includes('--engine-check');
  fs.mkdirSync(dest, { recursive: true });
  const runDirs = findRuns(path.join(outRoot, 'runs'), []).sort();

  const rows: Record<string, unknown>[] = [];
  const newBlocking: Record<string, unknown>[] = [];
  const jobs: Record<string, unknown>[] = [];
  const optionBRows: Record<string, unknown>[] = [];
  const parity: Record<string, unknown>[] = [];
  for (const runDir of runDirs) {
    const runId = path.relative(path.join(outRoot, 'runs'), runDir);
    const stepFiles = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort();
    const recs = stepFiles.map((sf) => JSON.parse(fs.readFileSync(path.join(runDir, 'steps', sf), 'utf8')) as StepRec);
    const frozen = recs[0]?.evaluatorSpec?.kind === 'frozen-after-step-1';
    if (!frozen) {
      if (!engineCheck) continue;
      for (const rec of recs) {
        const stepNo = String(rec.stepIndex + 1).padStart(2, '0');
        const tree = path.join(work, runId, `step-${stepNo}`);
        const tsconfig = materialise(runDir, rec.finalCommit, tree, nodeModules);
        const { report, error } = evaluate(tree, path.resolve(REPO, rec.evaluatorSpec?.path ?? ''), tsconfig, 'fail');
        const recordBlocking = rec.turns[rec.turns.length - 1]?.snapshot?.evaluation?.blockingViolationCount ?? null;
        parity.push({ runId, step: rec.stepIndex + 1, recordBlocking, interpBlocking: report?.tiers.blocking.violationCount ?? null, match: report?.tiers.blocking.violationCount === recordBlocking, error: error ?? null });
      }
      continue;
    }
    const specPath = path.resolve(runDir, recs[0]?.evaluatorSpec?.path ?? '');
    const seen = new Map<string, Set<string>>(POLICIES.map((p) => [p.option, new Set<string>()]));
    for (const rec of recs) {
      const stepNo = String(rec.stepIndex + 1).padStart(2, '0');
      const tree = path.join(work, runId, `step-${stepNo}`);
      const tsconfig = materialise(runDir, rec.finalCommit, tree, nodeModules);
      if (rec.stepIndex === 0) optionBRows.push({ runId, arm: rec.spec.arm, ...(await optionB(specPath, tree)) });
      for (const { option, policy } of POLICIES) {
        const { report, error } = evaluate(tree, specPath, tsconfig, policy);
        const base = { option, policy, runId, taskId: rec.spec.taskId, arm: rec.spec.arm, step: rec.stepIndex + 1, finalCommit: rec.finalCommit };
        if (report === undefined) {
          rows.push({ ...base, scored: false, error });
          continue;
        }
        const reportPath = path.join(dest, 'reports', option, runId, `step-${stepNo}.json`);
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        // The scratch work directory is machine-specific; it is written as `<work>`.
        fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2).split(work).join('<work>')}\n`);
        const s = summarise(report, `${runId}/step-${stepNo}`);
        const ids = new Map(s.blocking.map((f) => [identity(f), f]));
        const prior = seen.get(option) ?? new Set<string>();
        const fresh = rec.stepIndex >= 1 ? [...ids].filter(([id]) => !prior.has(id)) : [];
        for (const [id, f] of fresh) newBlocking.push({ option, runId, arm: rec.spec.arm, step: rec.stepIndex + 1, identity: JSON.parse(id) as unknown, key: f.key, message: f.message });
        if (fresh.length > 0 && rec.spec.arm === 'none') jobs.push({ projectId: `${option}/${runId}/step-${stepNo}`, projectRoot: tree, spec: specPath, report: reportPath, style: report.tiers.style, tsconfig: 'adr-032' });
        for (const id of ids.keys()) prior.add(id);
        rows.push({
          ...base, scored: true, blocking: s.blocking.length, blockingRules: s.blockingRules, newBlocking: fresh.length,
          blockingFindings: s.blocking.map((f) => ({ ruleId: f.ruleId, template: f.template, file: f.file, target: f.target ?? null })),
          advisory: s.advisory, advisoryCv05: s.cv05, recordWarnings: s.recordWarnings,
        });
      }
    }
  }
  fs.writeFileSync(path.join(dest, 'steps.json'), `${JSON.stringify(rows, null, 2)}\n`);
  fs.writeFileSync(path.join(dest, 'new-blocking.json'), `${JSON.stringify(newBlocking, null, 2)}\n`);
  fs.writeFileSync(path.join(dest, 'option-b.json'), `${JSON.stringify(optionBRows, null, 2)}\n`);
  fs.writeFileSync(path.join(dest, 'check-correct-jobs.json'), `${JSON.stringify({ schemaVersion: 1, kind: 'custom', jobs }, null, 2)}\n`);
  if (engineCheck) fs.writeFileSync(path.join(dest, 'engine-check.json'), `${JSON.stringify(parity, null, 2)}\n`);
  const table = rows.map((r) => `${String(r.option)}\t${String(r.runId)}\tstep ${String(r.step)}\t${r.scored === true ? `blocking ${String(r.blocking)} new ${String(r.newBlocking)}` : `unscored: ${String(r.error)}`}`);
  process.stdout.write(`${table.join('\n')}\noption b: ${JSON.stringify(optionBRows)}\n${engineCheck ? `engine check: ${parity.filter((p) => p.match === true).length}/${parity.length} match\n` : ''}`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
