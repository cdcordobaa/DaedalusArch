/**
 * CLI entry of `scripts/store-baseline-selection.ts` (OI-11; BR-U5b-76). No exports; D-U5a-13 (a) form
 * (`void Promise.resolve(...).then(...)`), because `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16).
 * Usage: npx tsx scripts/store-baseline-selection-cli.ts --report <full-mode report.json> --project <id> [--out <file>] | --self-test
 */
import { main } from './store-baseline-selection.js';

void Promise.resolve()
  .then(() => main(process.argv.slice(2), {
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
