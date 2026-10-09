/**
 * CLI entry of `scripts/so1-layered-acceptance.ts` (ADR-021 SO1-B; FR-v1.2E-20). No exports; `main` is synchronous,
 * so `process.exitCode = main(...)` needs no top-level `await` (CommonJS TS1378, OI-U5a-16).
 * Usage: npx tsx scripts/so1-layered-acceptance-cli.ts --report <file> --project <corpus name> [--out-dir <dir>] | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './so1-layered-acceptance.js';

process.exitCode = main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, t);
  },
  env: process.env,
});
