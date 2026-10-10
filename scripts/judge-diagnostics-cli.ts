/**
 * CLI entry of `scripts/judge-diagnostics.ts` (ADR-028 item 4; `Docs/analysis-plan.md` §12.4). No exports.
 * Usage: npx tsx scripts/judge-diagnostics-cli.ts --runs <run dir> --cassettes <cassette dir> --out <dir> | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './judge-diagnostics.js';

try {
  process.exitCode = main(process.argv.slice(2), process.cwd(), {
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
    writeFile: (f, t) => {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, t);
    },
  });
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
