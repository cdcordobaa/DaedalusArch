/**
 * v1.5 spec pre-flight CLI: the frozen schema, the frozen DDD binder and the v1.5 reader on each spec. Zero model calls.
 * Usage: npx tsx scripts/v15-preflight.ts <spec.yaml>...   (one line per spec; exit 1 on any failure)
 */
import { formatPreflight, preflightSpec } from '../src/v15-instrument/preflight.js';

async function main(specs: readonly string[]): Promise<number> {
  if (specs.length === 0) {
    process.stderr.write('usage: v15-preflight <spec.yaml>...\n');
    return 2;
  }
  let failed = 0;
  for (const s of specs) {
    const r = await preflightSpec(s);
    if (!r.ok) failed += 1;
    process.stdout.write(`${formatPreflight(s, r)}\n`);
  }
  return failed > 0 ? 1 : 0;
}

void main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e: unknown) => { process.stderr.write(`v15-preflight: ${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 1; },
);
