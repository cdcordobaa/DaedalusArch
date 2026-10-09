/**
 * CLI entry of `scripts/so1-metrics.ts` (ADR-021 SO1-E, X-7). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/so1-metrics-cli.ts [--out <file>] | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './so1-metrics.js';

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
