/**
 * Judge v2 development: the TUNE / CHECK split of the judge-catch items. DEVELOPMENT SET ONLY.
 *
 * Written and committed BEFORE any judge v2 call. The v2 rubric is iterated on TUNE only; CHECK is judged once.
 *
 * Items: every judged (target, function, unit) of the three judge-catch runs, read from their committed plans:
 *   r1  = results/v1.3-judge-catch/plan.json             (round 1)
 *   r2  = results/v1.3-judge-catch/round2/plan.json      (round 2)
 *   dv2 = results/v1.3-judge-catch/duprule-v2/plan.json  (AP-DUP-RULE v2)
 * Each item is a seed, twin or clean-control unit; its base comes from the round's rows.csv.
 *
 * Leakage control: items are split by cluster, not one by one. Two items share a cluster when
 *   (a) they judge the same unit id on the same base (identical or near-identical code: round 2's DUP-RULE seeds and
 *       the DUP v2 seeds are byte-identical edits; a seed, its same-site twin and the base unit's clean control), or
 *   (b) they belong to the same seed or twin target (a target's catch is decided over all its units).
 * Clusters are the connected components of these links (union-find).
 *
 * Assignment: clusters are ordered by sha256(`${SPLIT_SEED}|${clusterKey}`) (the cluster key is its smallest
 * `base::unit` key); walking that order, a cluster goes to TUNE while TUNE holds fewer than 60% of all items,
 * otherwise to CHECK. No verdict, v1 or v2, is read.
 *
 * Usage (repository root): npx tsx scripts/v1.3/judge-v2-split.ts [--out results/v1.3-judge-v2/split.json]
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const SPLIT_SEED = 'daedalus-v1.3-judge-v2-split-20261016';
export const TUNE_SHARE = 0.6;

export const ROUNDS: Readonly<Record<string, string>> = {
  r1: 'results/v1.3-judge-catch',
  r2: 'results/v1.3-judge-catch/round2',
  dv2: 'results/v1.3-judge-catch/duprule-v2',
};

export interface SplitItem {
  /** `${round}|${targetId}|${functionId}|${unitId}` */
  readonly itemId: string;
  readonly round: string;
  readonly targetId: string;
  readonly kind: 'seed' | 'twin' | 'clean';
  readonly functionId: string;
  readonly unitId: string;
  readonly baseId: string;
  /** Operator of the row (`''` for a clean control). */
  readonly operatorId: string;
  readonly cluster: string;
  readonly split: 'TUNE' | 'CHECK';
}

export interface SplitFile {
  readonly seed: string;
  readonly tuneShare: number;
  readonly method: string;
  readonly writtenAt: string;
  readonly counts: Record<string, Record<string, number>>;
  readonly clusters: readonly { readonly cluster: string; readonly order: string; readonly size: number; readonly split: 'TUNE' | 'CHECK' }[];
  readonly items: readonly SplitItem[];
}

interface PlanTarget { readonly id: string; readonly kind: 'seed' | 'twin' | 'clean'; readonly units: Readonly<Record<string, readonly string[]>> }

function csvRows(file: string): Record<string, string>[] {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const head = (lines[0] ?? '').split(',');
  return lines.slice(1).map((l) => {
    const cells = l.split(',');
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

export function buildSplit(repo: string = process.cwd()): SplitFile {
  const raw: Omit<SplitItem, 'cluster' | 'split'>[] = [];
  for (const [round, dir] of Object.entries(ROUNDS)) {
    const plan = JSON.parse(fs.readFileSync(path.join(repo, dir, 'plan.json'), 'utf8')) as { targets: PlanTarget[] };
    const rows = new Map(csvRows(path.join(repo, dir, 'rows.csv')).map((r) => [r.rowId ?? '', r]));
    for (const t of plan.targets) {
      const row = rows.get(t.id);
      const baseId = t.kind === 'clean' ? t.id.slice('base:'.length) : (row?.baseId ?? '');
      if (baseId === '') throw new Error(`${round} ${t.id}: no base`);
      for (const [fn, units] of Object.entries(t.units)) {
        for (const u of units) {
          raw.push({
            itemId: `${round}|${t.id}|${fn}|${u}`, round, targetId: t.id, kind: t.kind, functionId: fn, unitId: u, baseId,
            operatorId: t.kind === 'clean' ? '' : (row?.operatorId ?? ''),
          });
        }
      }
    }
  }
  // Union-find over `U:base::unit` and `T:round:target` nodes.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = parent.get(x) ?? x;
    if (r !== x) { r = find(r); parent.set(x, r); }
    if (!parent.has(x)) parent.set(x, x);
    return r;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };
  const unitKey = (i: { baseId: string; unitId: string }): string => `U:${i.baseId}::${i.unitId}`;
  for (const i of raw) {
    find(unitKey(i));
    if (i.kind !== 'clean') union(`T:${i.round}:${i.targetId}`, unitKey(i));
  }
  const members = new Map<string, typeof raw>();
  for (const i of raw) {
    const root = find(unitKey(i));
    members.set(root, [...(members.get(root) ?? []), i]);
  }
  const clusters = [...members.entries()].map(([root, its]) => {
    const key = [...new Set(its.map((i) => unitKey(i).slice(2)))].sort()[0] ?? root;
    return { key, its, order: sha(`${SPLIT_SEED}|${key}`) };
  }).sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const total = raw.length;
  let tune = 0;
  const assigned: { cluster: string; order: string; size: number; split: 'TUNE' | 'CHECK' }[] = [];
  const items: SplitItem[] = [];
  for (const c of clusters) {
    const split: 'TUNE' | 'CHECK' = tune < TUNE_SHARE * total ? 'TUNE' : 'CHECK';
    if (split === 'TUNE') tune += c.its.length;
    assigned.push({ cluster: c.key, order: c.order, size: c.its.length, split });
    for (const i of c.its) items.push({ ...i, cluster: c.key, split });
  }
  items.sort((a, b) => (a.itemId < b.itemId ? -1 : 1));
  const counts: Record<string, Record<string, number>> = {};
  for (const i of items) {
    const k = `${i.split}`;
    counts[k] ??= {};
    const c = counts[k];
    c.items = (c.items ?? 0) + 1;
    c[i.kind] = (c[i.kind] ?? 0) + 1;
    c[`${i.kind}:${i.functionId}`] = (c[`${i.kind}:${i.functionId}`] ?? 0) + 1;
  }
  for (const k of Object.keys(counts)) {
    const targets = new Set(items.filter((i) => i.split === k).map((i) => `${i.round}|${i.targetId}`));
    const c = counts[k];
    if (c !== undefined) c.targets = targets.size;
  }
  return {
    seed: SPLIT_SEED,
    tuneShare: TUNE_SHARE,
    method: 'clusters = connected components of (same base and unit id) and (same seed or twin target); ordered by sha256(seed|clusterKey); TUNE while TUNE < 60% of items',
    writtenAt: new Date().toISOString(),
    counts,
    clusters: assigned,
    items,
  };
}

export function readSplit(file: string): SplitFile {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SplitFile;
}

function main(argv: readonly string[]): number {
  const i = argv.indexOf('--out');
  const out = i >= 0 ? (argv[i + 1] ?? '') : 'results/v1.3-judge-v2/split.json';
  if (fs.existsSync(out)) {
    process.stderr.write(`${out} exists: the split is written once, before any v2 call\n`);
    return 1;
  }
  const split = buildSplit();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(split, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(split.counts, null, 2)}\n${String(split.clusters.length)} clusters\n`);
  return 0;
}

if (process.argv[1]?.endsWith('judge-v2-split.ts') === true) process.exitCode = main(process.argv.slice(2));
