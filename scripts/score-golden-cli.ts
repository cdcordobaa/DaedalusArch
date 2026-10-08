/**
 * CLI entry of `scripts/score-golden.ts` (FR-25; BR-U5b-73). No exports; D-U5a-13 (a) form (`void main(...).then(...)`),
 * because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/score-golden-cli.ts --case <dir> [--labels <file>] [--out <file>] | --self-test | --help
 */
import { writeFileSync } from 'node:fs';
import { loadMatchingRule } from './lib/matching-rule.js';
import { main } from './score-golden.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    writeFileSync(f, t);
  },
}, (root) => loadMatchingRule(root)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
