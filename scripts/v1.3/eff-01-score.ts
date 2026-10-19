/**
 * EFF-01 scorer (AI-DLC v1.4 U8; design SC-1 to SC-12, A1 DR-A1-5). Entry file; zero calls.
 *
 *   npx tsx scripts/v1.3/eff-01-score.ts --self-test
 *   npx tsx scripts/v1.3/eff-01-score.ts --run <run dir> [--rescore-with-current-key]
 *
 * `--run` writes scores.json, items.json, items.csv and pilot-scores.json into the run dir (with
 * `--rescore-with-current-key`: scores-key-<hash8>.json, items-key-<hash8>.json and the csv beside the originals).
 * `--self-test` scores the key against itself and exits non-zero unless every question scores 1.0.
 */
import * as path from 'node:path';
import { loadEff01Inputs } from './lib/eff01/inputs.js';
import { scoreRun, selfTest } from './lib/eff01/score.js';

function main(argv: readonly string[]): number {
  const repoRoot = process.cwd();
  if (argv.includes('--self-test')) {
    const inputs = loadEff01Inputs(repoRoot);
    if (!inputs.success) {
      process.stderr.write(`eff-01-score: ${inputs.errors.map((e) => e.message).join('; ')}\n`);
      return 2;
    }
    const r = selfTest(inputs.data);
    process.stdout.write(`eff-01-score self-test: ${String(r.perfect)} of ${String(r.total)} key answers score 1.0${r.failures.length > 0 ? `; failing: ${r.failures.join(', ')}` : ''}\n`);
    return r.perfect === r.total && r.total > 0 ? 0 : 1;
  }
  const at = argv.indexOf('--run');
  const runDir = at >= 0 ? argv[at + 1] : undefined;
  if (runDir === undefined) {
    process.stderr.write('usage: eff-01-score --run <run dir> [--rescore-with-current-key] | --self-test\n');
    return 2;
  }
  const res = scoreRun({ runDir: path.resolve(repoRoot, runDir), repoRoot, rescoreWithCurrentKey: argv.includes('--rescore-with-current-key') });
  if (!res.success) {
    process.stderr.write(`eff-01-score: ${res.errors.map((e) => e.message).join('; ')}\n`);
    return 2;
  }
  const accs = res.data.items.map((r) => r.acc).filter((a): a is number => a !== null);
  process.stdout.write(
    `eff-01-score: ${String(res.data.sessions)} sessions scored, ${String(res.data.excluded.length)} excluded, ${String(res.data.missing.length)} missing; ${String(res.data.items.length)} item rows, mean acc ${accs.length > 0 ? (accs.reduce((a, b) => a + b, 0) / accs.length).toFixed(3) : 'n/a'}\n`,
  );
  for (const f of res.data.written) process.stdout.write(`  wrote ${path.relative(repoRoot, f)}\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
