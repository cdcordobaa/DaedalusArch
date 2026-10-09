/**
 * CLI entry of `scripts/figures.ts` (ADR-021 X-5; FR-36). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16). Run with `npx tsx` (ESM), the route the vega /
 * vega-lite renderer needs (OI-U5b-P2-2).
 * Usage: npx tsx scripts/figures-cli.ts --csv-dir <dir> [--out <dir>] [--split <split>] [--only <id>] | --list | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './figures.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, t);
  },
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
