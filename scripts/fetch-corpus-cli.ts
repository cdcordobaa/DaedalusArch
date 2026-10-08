/**
 * CLI entry of `scripts/fetch-corpus.ts` (FR-36; BR-U5b-66, 67, 73). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/fetch-corpus-cli.ts --dest <dir> [--corpus <file>] [--only a,b] [--check] [--no-install] [--out <file>] | --self-test
 */
import { main } from './fetch-corpus.js';

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
