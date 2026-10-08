/**
 * CLI entry of `scripts/export-frozen-instrument.ts` (ADR-015 item 2; BR-U5b-52, 73). No exports; `main` is
 * synchronous, so `process.exitCode = main(...)` needs no top-level `await` (CommonJS TS1378, OI-U5a-16).
 * Usage: npx tsx scripts/export-frozen-instrument-cli.ts [--out <file>] [--final] | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './export-frozen-instrument.js';

process.exitCode = main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, t);
  },
});
