/**
 * CLI entry of `scripts/select-corpus.ts` (FR-36; ADR-017 item 1; BR-U5b-68, 73). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/select-corpus-cli.ts [--search [--out <file>]] | [--candidates <file>] [--corpus <file>] [--out <file>] | --append-entries [--selection <file>]
 */
import { main } from './select-corpus.js';

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
