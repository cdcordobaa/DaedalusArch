/**
 * CLI entry of `scripts/run-experiment.ts` (FR-36; BR-U5b-73). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/run-experiment-cli.ts <plan.json> [--out-dir <dir>] [--neo4j-container <name>]
 *        | --check-prereg <plan> | --dry-run <plan> | --self-test
 */
import { execFileSync } from 'node:child_process';
import { NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import { recordEnvironment } from './record-env.js';
import { defaultDeps, main } from './run-experiment.js';

const repoRoot = process.cwd();

void main(process.argv.slice(2), repoRoot, {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
}, (opts) => defaultDeps(
  repoRoot,
  async () => {
    const r = await recordEnvironment({
      repoRoot, runner: new NodeProcessRunner(), parentEnv: process.env, now: () => new Date(),
      ...(opts.neo4jContainer !== undefined && { neo4jContainer: opts.neo4jContainer }),
    });
    if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
    return { id: r.record.id, record: r.record };
  },
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
