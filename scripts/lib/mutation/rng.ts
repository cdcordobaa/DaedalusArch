/**
 * Seeded RNG and seed derivation (FR-v1.2E-24 "seeded RNG"; BR-U5a-15, 16; domain-entities.md §1).
 *
 * No dependency (SECURITY-10): mulberry32 is inline and sha256 comes from `node:crypto`.
 * - `mulberry32(seed)` returns a `SeededRng` whose `next()` yields [0, 1).
 * - `pickDistinct(items, n)` is a partial Fisher–Yates over a copy of `items`; the result is in draw order and
 *   never repeats an index; `n > items.length` returns every item (in draw order).
 * - `deriveSeed(masterSeed, { projectId, operatorId, k })` =
 *   `uint32BE(sha256(utf8(`${masterSeed}|${projectId}|${operatorId}|${k}`))[0..3])`; ids must be non-empty and
 *   contain no `|`, `k` is a non-negative integer or one of the labels `'select'` / `'subsample'`.
 */
import { createHash } from 'node:crypto';

export interface SeededRng {
  readonly seed: number;
  next(): number;
  pickDistinct<T>(items: readonly T[], n: number): readonly T[];
  pick<T>(items: readonly T[]): T;
}

export interface SeedDerivation {
  readonly projectId: string;
  readonly operatorId: string;
  readonly k: number | 'select' | 'subsample';
}

const UINT32_MAX = 0xffffffff;
const K_LABELS: readonly string[] = ['select', 'subsample'];

function assertUint32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${name} must be a uint32, got ${String(value)}`);
  }
}

export function mulberry32(seed: number): SeededRng {
  assertUint32(seed, 'seed');
  let state = seed | 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pickDistinct = <T>(items: readonly T[], n: number): readonly T[] => {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`n must be a non-negative integer, got ${String(n)}`);
    const pool = [...items];
    const take = Math.min(n, pool.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(next() * (pool.length - i));
      const picked = pool[j] as T;
      pool[j] = pool[i] as T;
      pool[i] = picked;
    }
    return pool.slice(0, take);
  };
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick from an empty list');
    return pickDistinct(items, 1)[0] as T;
  };
  return { seed, next, pickDistinct, pick };
}

function assertId(value: string, name: string): void {
  if (value.length === 0 || value.includes('|')) {
    throw new RangeError(`${name} must be non-empty and contain no '|', got ${JSON.stringify(value)}`);
  }
}

export function deriveSeed(masterSeed: number, d: SeedDerivation): number {
  assertUint32(masterSeed, 'masterSeed');
  assertId(d.projectId, 'projectId');
  assertId(d.operatorId, 'operatorId');
  if (typeof d.k === 'number') {
    if (!Number.isInteger(d.k) || d.k < 0) throw new RangeError(`k must be a non-negative integer, got ${String(d.k)}`);
  } else if (!K_LABELS.includes(d.k)) {
    throw new RangeError(`k label must be 'select' or 'subsample', got ${JSON.stringify(d.k)}`);
  }
  const input = `${String(masterSeed)}|${d.projectId}|${d.operatorId}|${String(d.k)}`;
  return createHash('sha256').update(input, 'utf8').digest().readUInt32BE(0);
}
