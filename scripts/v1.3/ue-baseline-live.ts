/**
 * U-E baseline live run: `validate-reference.ts` live mode with an evaluator that also keeps the tool's full
 * violation objects (message, discriminator, every column) as evidence for the adjudication sheet.
 * Entry file: no exports. It runs the same CLI command as `cliEvaluate` (scripts/lib/freeze-gate-main.ts), one
 * variant at a time, with the same explicit child environment (PATH, HOME and the Neo4j triple only).
 *
 * Usage (repository root, Neo4j env loaded):
 *   npx tsx scripts/v1.3/ue-baseline-live.ts --out results/v1.3-reference/baseline-pre-barrel
 * Writes <out>/raw/<style>/<variant>.json (replayable with --from-raw), <out>/evidence/<style>/<variant>.json,
 * <out>/report.json and <out>/report.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { CLI_ENTRY } from '../lib/freeze-gate-main.js';
import { normaliseFindingPath } from './lib/compare.js';
import type { ActualFinding } from './lib/compare.js';
import { main } from './lib/validate-reference-main.js';

const argv = process.argv.slice(2);
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
  const args = [CLI_ENTRY, 'evaluate', '--project', projectDir, '--spec', specPath, '--format', 'json', '--symbolic-only', '--neo4j-uri', env.NEO4J_URI ?? ''];
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

void main(argv, repoRoot, { env, evaluate, out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(scrubSecrets(t, secrets)) }).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  },
);
