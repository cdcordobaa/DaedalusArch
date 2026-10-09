/**
 * CLI entry of `scripts/generate-e7-specs.ts` (ADR-019 item 3; OI-12). No exports; D-U5a-13 (a) form
 * (`void Promise.resolve(...).then(...)`), because `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16).
 * Usage: npx tsx scripts/generate-e7-specs-cli.ts --clones <dir> [--out <dir>] [--report <file>] [--check]
 */
import { main } from './generate-e7-specs.js';

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
