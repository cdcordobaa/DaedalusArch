/**
 * CLI entry of `scripts/build-label-plan.ts` (ADR-021 SO3-2, SO4-02, SO3-3; BR-U5b-73). No exports; D-U5a-13 (a)
 * form (`void main(...).then(...)`), because `tsconfig.scripts.json` compiles CommonJS (OI-U5a-16).
 * Usage: npx tsx scripts/build-label-plan-cli.ts --out <dir> [inputs] | --self-test | --help
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './build-label-plan.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, t);
  },
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
