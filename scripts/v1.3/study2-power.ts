/**
 * Study 2 power simulation: an INFORMAL DESIGN AID, NOT A PRE-REGISTRATION. Entry file: no exports.
 * Model and analysis: scripts/v1.3/lib/study2-power.ts; reading: Docs/v1.3/study2-power-notes.md.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-power.ts [--sims 400] [--flips 999] [--seed 20261015] [--out <power.json>] [--md-out <power.md>]
 * Prints the Markdown tables. Uses no model, no sealed task and no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_ASSUMPTIONS, powerGrid, renderPowerMarkdown } from './lib/study2-power.js';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};
const int = (name: string, def: number): number => {
  const v = Number(opt(name, String(def)));
  if (!Number.isSafeInteger(v) || v <= 0) throw new Error(`${name} must be a positive integer`);
  return v;
};

try {
  const grid = powerGrid(DEFAULT_ASSUMPTIONS, { sims: int('--sims', 400), flips: int('--flips', 999), seed: int('--seed', 20261015) });
  const md = renderPowerMarkdown(grid);
  const write = (file: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const out = opt('--out', '');
  if (out !== '') write(out, JSON.stringify(grid, null, 1) + '\n');
  const mdOut = opt('--md-out', '');
  if (mdOut !== '') write(mdOut, md);
  process.stdout.write(md);
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
