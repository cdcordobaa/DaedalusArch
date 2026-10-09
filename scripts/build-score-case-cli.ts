/**
 * CLI entry of `scripts/build-score-case.ts` (ADR-021 SO4-04). No exports; D-U5a-13 (a) form, because
 * `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16).
 * Usage: npx tsx scripts/build-score-case-cli.ts --runs <dir> --out <case dir> [--manifest <file>] | --self-test | --help
 */
import { main } from './build-score-case.js';

void Promise.resolve()
  .then(() => main(process.argv.slice(2), process.cwd(), {
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
  }))
  .then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
    },
  );
