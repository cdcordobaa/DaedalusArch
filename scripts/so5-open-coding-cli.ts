/**
 * CLI entry of `scripts/so5-open-coding.ts` (ADR-021 SO5-07). No exports; D-U5a-13 (a) form, because
 * `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16).
 * Usage: npx tsx scripts/so5-open-coding-cli.ts --labels <reconciled.json> --runs <e1 run dir> --out <dir> | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './so5-open-coding.js';

try {
  process.exitCode = main(process.argv.slice(2), process.cwd(), {
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
    writeFile: (f, t) => {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, t);
    },
  });
} catch (e: unknown) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
