/**
 * CLI entry of `scripts/e1-judge-volume.ts` (ADR-021 SO5-08). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/e1-judge-volume-cli.ts --spec <spec.yaml> --project <label>=<dir> ... [--out <file.md>] | --self-test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { main } from './e1-judge-volume.js';

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
