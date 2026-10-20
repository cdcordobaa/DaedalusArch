/**
 * Re-scores a saved live S4 run with the current scorer (`agy-gen-rescore.ts`). ZERO model calls, no agy process.
 * Entry file: no exports.
 * Usage (repository root):
 *   npx tsx scripts/generator/probes/agy-gen-rescore-cli.ts --probe-dir <out-root>/probes/agy-s4-<stamp> \
 *     --harness-root <H> --home-none <home> --home-mcp <home> [--out <file>]
 * Prints the re-scored JSON (or writes it to --out) and exits 0 when both arms pass, 1 otherwise, 2 on a usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rescoreS4Run } from './agy-gen-rescore.js';

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const need = ['--probe-dir', '--harness-root', '--home-none', '--home-mcp'];
const missing = need.filter((n) => flag(n) === undefined || !path.isAbsolute(flag(n) ?? ''));
if (missing.length > 0) {
  process.stderr.write(`agy-gen-rescore: absolute ${missing.join(', ')} required\n`);
  process.exitCode = 2;
} else {
  const r = rescoreS4Run({
    probeDir: flag('--probe-dir') ?? '',
    harnessRoot: flag('--harness-root') ?? '',
    homes: { none: flag('--home-none') ?? '', 'daedalus-mcp': flag('--home-mcp') ?? '' },
  });
  const text = `${JSON.stringify(r, null, 2)}\n`;
  const out = flag('--out');
  if (out !== undefined) fs.writeFileSync(out, text);
  else process.stdout.write(text);
  process.exitCode = r.arms.none === 'pass' && r.arms['daedalus-mcp'] === 'pass' ? 0 : 1;
}
