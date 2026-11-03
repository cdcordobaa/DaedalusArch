/**
 * SEM-GATE-3 census diff (zero model calls): v1.5.9 against v1.5.10 on
 *   - the gate trees (`results/census-v1.5.9.json`, `results/census-v1.5.10.json`, from `census.ts`), and
 *   - the 220 kept Hexagonal study trees with the SEM-GATE and SEM-GATE-2 built trees (`results/census-kept-v1.5.9.json`,
 *     `results/census-kept-v1.5.10.json`, from `experiments/sem-gate-2/census-all.ts`).
 * Every earlier candidate must keep its asked state and question key; every added candidate must be form C.
 *
 *   npx tsx experiments/sem-gate-3/compare-census.ts --out experiments/sem-gate-3/results/census-diff.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const R = path.join('experiments', 'sem-gate-3', 'results');
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
type Row = Record<string, unknown>;
const rowsOf = (f: string): Row[] => (JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')) as { rows: Row[] }).rows;

function diff(before: Row[], after: Row[], tree: string, keysOnly: (r: Row) => boolean): Record<string, unknown> {
  const id = (r: Row): string => `${String(r[tree])}|${String(r['file'])}|${String(r['coreSet'])}|${String(r['vendor'])}`;
  const b = new Map(before.map((r) => [id(r), r])); const a = new Map(after.map((r) => [id(r), r]));
  const removed = [...b.keys()].filter((k) => !a.has(k));
  const changed = [...b.keys()].filter((k) => a.has(k) && (b.get(k)!['asked'] !== a.get(k)!['asked'] || b.get(k)!['key'] !== a.get(k)!['key']));
  const added = [...a.keys()].filter((k) => !b.has(k));
  const addedNotC = added.filter((k) => !keysOnly(a.get(k)!));
  const byTree = new Map<string, number>();
  for (const k of added) { const t = String(a.get(k)![tree]); byTree.set(t, (byTree.get(t) ?? 0) + 1); }
  return { before: before.length, after: after.length, kept: before.length - removed.length, removed, changed, added: added.length, addedNotFormC: addedNotC, addedByTree: Object.fromEntries([...byTree].sort()) };
}

const gate = diff(rowsOf('census-v1.5.9.json'), rowsOf('census-v1.5.10.json'), 'case', (r) => r['coreKind'] === 'keys');
// census-all rows carry no coreKind: a form-C row is core-side and its members are its own pairs' targets (`v -> key`)
const kept = diff(rowsOf('census-kept-v1.5.9.json'), rowsOf('census-kept-v1.5.10.json'), 'tree', (r) => r['mapSide'] === 'core' && (r['pairs'] as string[]).every((p) => (r['coreMembers'] as string[]).includes(p.split('->')[1]!.replace(/ \(.*$/, ''))));
const keptStudyAdded = Object.keys(kept['addedByTree'] as Record<string, number>).filter((t) => t.startsWith('kept/'));
const out = { gate, keptAndBuilt: { ...kept, studyTreesWithAddedCandidates: keptStudyAdded } };
process.stdout.write(`${JSON.stringify({ gate: { removed: (gate['removed'] as unknown[]).length, changed: (gate['changed'] as unknown[]).length, added: gate['added'], addedNotFormC: (gate['addedNotFormC'] as unknown[]).length }, kept: { removed: (kept['removed'] as unknown[]).length, changed: (kept['changed'] as unknown[]).length, added: kept['added'], addedNotFormC: (kept['addedNotFormC'] as unknown[]).length, studyTreesWithAddedCandidates: keptStudyAdded.length } })}\n`);
const f = argOf('--out');
if (f !== undefined) fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`);
