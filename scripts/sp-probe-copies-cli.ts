/**
 * CLI entry of `scripts/sp-probe-copies.ts` (Build and Test Step 28). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/sp-probe-copies-cli.ts --out ../daedalus-sp-probes [--cycle-strategy simple-cycles|scc]
 */
import { main } from './sp-probe-copies.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
