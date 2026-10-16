/**
 * Seeded selection of the team-declared-rules corpus (v1.3 brownfield ground truth). No pre-registration.
 *
 * Usage: npx tsx scripts/v1.3/declared-rules-select.ts [--pool results/v1.3-declared-rules/selection/pool.json] [--seed 20261016]
 *
 * Reads the screened pool, orders each tool family (depcruise, boundaries, nx) by a seeded shuffle and writes the
 * order to `selection.json` next to the pool. The first QUOTA[family] entries are the primary draw; when the team's
 * own tool cannot be run on a primary entry, the next entry of the same family in seeded order replaces it, and the
 * replacement is recorded in the run results (not here), so the draw itself never changes after the fact.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { mulberry32, seededSample } from './lib/graph-fidelity.js';

export const QUOTA: Readonly<Record<string, number>> = Object.freeze({ depcruise: 4, boundaries: 4, nx: 3 });

interface PoolEntry { readonly family: string; readonly repo: string }

export function seededOrder<T extends PoolEntry>(pool: readonly T[], seed: number): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const family of Object.keys(QUOTA)) {
    const items = pool.filter((p) => p.family === family).sort((a, b) => (a.repo < b.repo ? -1 : 1));
    out[family] = seededSample(items, items.length, mulberry32(seed));
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const val = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const poolPath = resolve(val('pool') ?? 'results/v1.3-declared-rules/selection/pool.json');
  const seed = Number(val('seed') ?? 20261016);
  const pool = (JSON.parse(readFileSync(poolPath, 'utf8')) as { pool: PoolEntry[] }).pool;
  const order = seededOrder(pool, seed);
  const selection = Object.fromEntries(Object.entries(order).map(([f, items]) => [f, {
    quota: QUOTA[f], primary: items.slice(0, QUOTA[f]).map((i) => i.repo), reserveInOrder: items.slice(QUOTA[f]).map((i) => i.repo),
  }]));
  writeFileSync(join(dirname(poolPath), 'selection.json'), JSON.stringify({ seed, selection }, null, 1) + '\n');
  process.stdout.write(JSON.stringify(selection, null, 1) + '\n');
}

if (process.argv[1]?.endsWith('declared-rules-select.ts') === true) main();
