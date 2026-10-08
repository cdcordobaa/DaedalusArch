/**
 * CLI entry of `scripts/aggregate.ts` (FR-36; BR-U5b-72, 73). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16). Run with `npx tsx`
 * (ESM), which is the route the figure renderer needs for vega / vega-lite (OI-U5b-P2-2).
 * Usage: npx tsx scripts/aggregate-cli.ts --runs <dir> --out <dir> [--plan <file>] [--score <file>] ... | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './aggregate.js';

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
