/**
 * CLI entry of `scripts/remap-domain-layer.ts` (ADR-017 item 4; BR-U5b-73, 77). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/remap-domain-layer-cli.ts <spec.yaml>... | --self-test
 */
import { main } from './remap-domain-layer.js';

void main(process.argv.slice(2), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  },
);
