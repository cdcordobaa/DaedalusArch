/**
 * CLI entry of `scripts/e1-size-analysis.ts` (E1 size analysis, 2026-10-10). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/e1-size-analysis-cli.ts --agg results/e1-grid/agg --plan experiments/e1-grid/plan.json
 *          --out results/e1-grid/agg-size
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './e1-size-analysis.js';

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
