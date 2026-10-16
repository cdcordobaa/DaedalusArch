/**
 * U-E baseline live run: `validate-reference.ts` live mode with an evaluator that also keeps the tool's full
 * violation objects (message, discriminator, every column) as evidence for the adjudication sheet.
 * Entry file: no exports. It runs the same CLI command as `cliEvaluate` (scripts/lib/freeze-gate-main.ts), one
 * variant at a time, with the same explicit child environment (PATH, HOME and the Neo4j triple only).
 *
 * Usage (repository root, Neo4j env loaded):
 *   npx tsx scripts/v1.3/ue-baseline-live.ts --out results/v1.3-reference/baseline-pre-barrel
 * `--engine cypher-interp` (v1.3 spike, Docs/v1.3/cypher-interpreter.md) passes the same flag to every CLI child: the
 * Cypher templates run in process over an in-memory graph; no Neo4j server, credentials or Neo4j lock are needed.
 * Writes <out>/raw/<style>/<variant>.json (replayable with --from-raw), <out>/evidence/<style>/<variant>.json,
 * <out>/report.json and <out>/report.md.
 * `--keep-cli` also writes <out>/cli/<style>/<variant>.json: the CLI's whole JSON result (AHS, per-dimension scores,
 * universal metrics, tiers, function results, graph stats, violations) with the run-volatile fields removed (`runId`,
 * `durationMs`, `executionTimeMs`, `timings`) and the temporary project path replaced by `<project>`, so two runs (two
 * engines) can be compared field by field (`scripts/v1.3/cypher-interp-compare-runs.ts`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { CLI_ENTRY } from '../lib/freeze-gate-main.js';
import { normaliseFindingPath } from './lib/compare.js';
import type { ActualFinding } from './lib/compare.js';
import { main } from './lib/validate-reference-main.js';

const rawArgv = process.argv.slice(2);
const engineIdx = rawArgv.indexOf('--engine');
const engine = engineIdx >= 0 ? rawArgv[engineIdx + 1] ?? '' : 'neo4j';
if (engine !== 'neo4j' && engine !== 'cypher-interp') {
  process.stderr.write('--engine must be neo4j or cypher-interp\n');
  process.exit(2);
}
const keepCli = rawArgv.includes('--keep-cli');
const argv = (engineIdx >= 0 ? [...rawArgv.slice(0, engineIdx), ...rawArgv.slice(engineIdx + 2)] : rawArgv).filter((a) => a !== '--keep-cli');
const outIdx = argv.indexOf('--out');
const outDir = path.resolve(process.cwd(), outIdx >= 0 ? argv[outIdx + 1] ?? '' : 'results/v1.3-reference');
const env = process.env;
const secrets = [env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
const runner = new NodeProcessRunner();
const repoRoot = process.cwd();
const tsx = path.resolve(repoRoot, 'node_modules/.bin/tsx');
const childEnv: Record<string, string> = {};
for (const k of ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
  const v = env[k];
  if (v !== undefined) childEnv[k] = v;
}

async function evaluate(projectDir: string, specPath: string): Promise<readonly ActualFinding[]> {
  const args = [CLI_ENTRY, 'evaluate', '--project', projectDir, '--spec', specPath, '--format', 'json', '--symbolic-only', '--neo4j-uri', env.NEO4J_URI ?? '',
    '--engine', engine];
  const started = Date.now();
  const run = await runner.run(tsx, args, { cwd: repoRoot, env: childEnv, timeoutMs: 600_000 });
  if (!run.success) throw new Error(run.errors.map((e) => e.message).join('; '));
  if (run.data.timedOut) throw new Error(`evaluation of ${projectDir} timed out`);
  const stdout = run.data.stdout;
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error(`no JSON from evaluate: ${scrubSecrets(run.data.stderr.slice(0, 500), secrets)}`);
  const parsed = JSON.parse(stdout.slice(start)) as { violations?: Record<string, unknown>[] };
  if (!Array.isArray(parsed.violations)) throw new Error('evaluate output has no violations array');
  const style = path.basename(path.dirname(projectDir));
  const variant = path.basename(projectDir);
  if (keepCli) {
    const cliFile = path.join(outDir, 'cli', style, `${variant}.json`);
    fs.mkdirSync(path.dirname(cliFile), { recursive: true });
    fs.writeFileSync(cliFile, JSON.stringify(stableCliResult(JSON.parse(stdout.slice(start)), projectDir), null, 2) + '\n');
  }
  const full = parsed.violations.map((v) => {
    const o: Record<string, unknown> = { ...v };
    if (typeof o.filePath === 'string') o.filePath = normaliseFindingPath(o.filePath, projectDir);
    if (typeof o.target === 'string') o.target = normaliseFindingPath(o.target, projectDir);
    return o;
  });
  const evFile = path.join(outDir, 'evidence', style, `${variant}.json`);
  fs.mkdirSync(path.dirname(evFile), { recursive: true });
  fs.writeFileSync(evFile, JSON.stringify({ style, variant, elapsedMs: Date.now() - started, violations: full }, null, 2) + '\n');
  return parsed.violations
    .filter((v) => typeof v.functionId === 'string' && typeof v.filePath === 'string')
    .map((v) => {
      const target = normaliseFindingPath(typeof v.target === 'string' ? v.target : '', projectDir);
      return { ruleId: v.functionId as string, file: normaliseFindingPath(v.filePath as string, projectDir), ...(target !== '' ? { target } : {}) };
    });
}

const VOLATILE_KEYS = new Set(['runId', 'durationMs', 'executionTimeMs', 'timings']);

/** The CLI result without the fields that change run to run; the temporary project directory becomes `<project>`. */
function stableCliResult(v: unknown, projectDir: string): unknown {
  if (typeof v === 'string') return v.split(projectDir).join('<project>');
  if (Array.isArray(v)) return v.map((x) => stableCliResult(x, projectDir));
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !VOLATILE_KEYS.has(k)).map(([k, x]) => [k, stableCliResult(x, projectDir)]));
  }
  return v;
}

// The in-process engine touches no database: no cross-process Neo4j lock (validate-reference-main takes it from NEO4J_URI).
const mainEnv: NodeJS.ProcessEnv = engine === 'neo4j' ? env : { ...env, NEO4J_URI: '' };
void main(argv, repoRoot, { env: mainEnv, evaluate, out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(scrubSecrets(t, secrets)) }).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  },
);
