/**
 * CLI entry of `scripts/compare-aggregations.ts` (ADR-028; `Docs/analysis-plan.md` §12.3). No exports.
 * Usage: npx tsx scripts/compare-aggregations-cli.ts --registered <run dir> --variant <run dir> --out <dir>
 *          [--reading post-hoc|pre-registered] | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './compare-aggregations.js';

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
