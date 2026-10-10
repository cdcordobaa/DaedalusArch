/**
 * CLI entry of `scripts/tool-comparison.ts` (ADR-030). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/tool-comparison-cli.ts translate|run <plan.json> | score-comparison | score-pairs
 */
import { main } from './tool-comparison.js';

void main(process.argv.slice(2), process.cwd()).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
