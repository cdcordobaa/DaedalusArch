/**
 * CLI entry of `scripts/so4-plan-entries.ts` (ADR-021 item 9, SO4-04). No exports; D-U5a-13 (a) form, because
 * `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16).
 * Usage: npx tsx scripts/so4-plan-entries-cli.ts --plan <file> --manifest <file> --copies <dir> --out <file> | --self-test | --help
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './so4-plan-entries.js';

void Promise.resolve()
  .then(() => main(process.argv.slice(2), process.cwd(), {
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
    writeFile: (p, t) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, t);
    },
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
