/**
 * CLI entry of `scripts/antipattern-sites.ts` (v1.3 DRAFT; label-free site count). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/antipattern-sites-cli.ts [--clones <dir>] [--only a,b] [--no-fixtures] [--out <json>] [--md <file>] [--smoke <n>]
 */
import { main } from './antipattern-sites.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
