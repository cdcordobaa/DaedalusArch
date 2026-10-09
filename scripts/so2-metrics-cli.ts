/**
 * CLI entry of `scripts/so2-metrics.ts` (ADR-021 SO2; BR-U5b-73). No exports; D-U5a-13 (a) form
 * (`void main(...).then(...)`), because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is
 * TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/so2-metrics-cli.ts tables|ablation|flows-to|profile ... | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultSo2Deps, main, neo4jProfileBackend } from './so2-metrics.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, t);
  },
}, { ...defaultSo2Deps, profileBackend: () => neo4jProfileBackend(process.env) }).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
