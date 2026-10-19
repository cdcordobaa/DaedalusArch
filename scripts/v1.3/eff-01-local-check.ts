/**
 * EFF-01 optional local check (AI-DLC v1.4 U8; design §6). Entry file; zero model calls, no database, no network.
 * It needs the two clones at their pins (`experiments/eff-01/repos.json`), outside the repository.
 *
 *   npx tsx scripts/v1.3/eff-01-local-check.ts --clones <abs dir> --harness <abs dir> --out <run dir>
 *
 * Exports each tree as the driver does (git archive -o, then tar -xf), runs evaluate_project in process with
 * `--engine cypher-interp`, and requires 23 and 102 violations. Writes `<run dir>/local-check.json`.
 * Exit codes: 0 pass, 1 a count differs, 2 setup error.
 */
import * as path from 'node:path';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { runLocalCheck } from './lib/eff01/local-check.js';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv: readonly string[]): Promise<number> {
  const repoRoot = process.cwd();
  const clones = arg(argv, '--clones');
  const harness = arg(argv, '--harness');
  const out = arg(argv, '--out');
  if (clones === undefined || harness === undefined || out === undefined || !path.isAbsolute(clones) || !path.isAbsolute(harness)) {
    process.stderr.write('usage: eff-01-local-check --clones <abs dir> --harness <abs dir> --out <run dir>\n');
    return 2;
  }
  const r = await runLocalCheck({ repoRoot, clones, harness, out: path.resolve(repoRoot, out), runner: new NodeProcessRunner() });
  if (!r.success) {
    process.stderr.write(`eff-01-local-check: ${r.errors.map((e) => e.message).join('; ')}\n`);
    return 2;
  }
  for (const [id, t] of Object.entries(r.data.trees)) {
    process.stdout.write(`${id}: ${String(t.violationCount)} violations (expected ${String(t.expected)}) ${t.ok ? 'ok' : 'DIFFERS'}${t.error !== undefined ? ` (${t.error})` : ''}\n`);
  }
  process.stdout.write(`eff-01-local-check: ${r.data.pass ? 'pass' : 'FAIL'}\n`);
  return r.data.pass ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`eff-01-local-check: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
