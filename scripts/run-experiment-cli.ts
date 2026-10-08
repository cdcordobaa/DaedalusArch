/**
 * CLI entry of `scripts/run-experiment.ts` (FR-36; BR-U5b-73). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/run-experiment-cli.ts <plan.json> [--out-dir <dir>] | --check-prereg <plan> | --dry-run <plan> | --self-test
 */
import { execFileSync } from 'node:child_process';
import { defaultDeps, main } from './run-experiment.js';

const repoRoot = process.cwd();

void main(process.argv.slice(2), repoRoot, {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
}, () => defaultDeps(
  repoRoot,
  () => Promise.reject(new Error('environment recorder not wired yet (record-env.ts, U5b Step 15)')),
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
