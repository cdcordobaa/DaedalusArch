/**
 * CLI entry of `scripts/provenance.ts` (reproduction audit 2026-10-10 issue 4). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/provenance-cli.ts guard-case | v1-sensitivity | external (see --help in provenance.ts)
 */
import { main } from './provenance.js';

void Promise.resolve()
  .then(() => main(process.argv.slice(2), process.cwd(), {
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
  }))
  .then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
    },
  );
