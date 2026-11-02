/**
 * SEM-GATE-2: compares two `census-all.ts` files (zero model calls). Every candidate is keyed by tree, file and core
 * set; the report lists candidates only in the old or the new file, and candidates in both whose asked state or
 * question key changed.
 *
 *   npx tsx experiments/sem-gate-2/compare-census.ts <before.json> <after.json> [--out <file.json>]
 */
import * as fs from 'node:fs';

interface Row { tree: string; file: string; coreSet: string; vendor: string; mapSide: string; asked: boolean; key: string | null; coreMembers: string[]; pairs: string[]; mappedFrom: number; mappedTo: number; oneToOne: boolean; branches: number; ownedBy: string }
const load = (f: string): Row[] => (JSON.parse(fs.readFileSync(f, 'utf8')) as { rows: Row[] }).rows;
const idOf = (r: Row): string => `${r.tree}|${r.file}|${r.coreSet}`;

const [bf, af] = [process.argv[2], process.argv[3]];
if (bf === undefined || af === undefined) throw new Error('usage: compare-census.ts <before> <after> [--out f]');
const before = new Map(load(bf).map((r) => [idOf(r), r]));
const after = new Map(load(af).map((r) => [idOf(r), r]));
const added = [...after.values()].filter((r) => !before.has(idOf(r)));
const removed = [...before.values()].filter((r) => !after.has(idOf(r)));
const changed = [...after.values()].filter((r) => before.has(idOf(r)) && (before.get(idOf(r))!.asked !== r.asked || before.get(idOf(r))!.key !== r.key));
const brief = (r: Row): Record<string, unknown> => ({ tree: r.tree, file: r.file, coreSet: r.coreSet, vendor: r.vendor, mapSide: r.mapSide, asked: r.asked, key: r.key, coreMembers: r.coreMembers, pairs: r.pairs, mappedFrom: r.mappedFrom, mappedTo: r.mappedTo, oneToOne: r.oneToOne, branches: r.branches, ownedBy: r.ownedBy });
const out = {
  before: { candidates: before.size, asked: [...before.values()].filter((r) => r.asked).length },
  after: { candidates: after.size, asked: [...after.values()].filter((r) => r.asked).length },
  unchanged: [...after.values()].filter((r) => before.has(idOf(r)) && !changed.includes(r)).length,
  added: added.map(brief), removed: removed.map(brief), changed: changed.map((r) => ({ ...brief(r), beforeAsked: before.get(idOf(r))!.asked, beforeKey: before.get(idOf(r))!.key })),
};
process.stdout.write(`before ${String(out.before.candidates)} (${String(out.before.asked)} asked), after ${String(out.after.candidates)} (${String(out.after.asked)} asked); unchanged ${String(out.unchanged)}, added ${String(added.length)}, removed ${String(removed.length)}, changed ${String(changed.length)}\n`);
for (const r of added) process.stdout.write(`  + ${r.tree} ${r.file} ${r.coreSet} [${r.coreMembers.join('|')}] <- ${r.vendor} ${r.mapSide} from ${String(r.mappedFrom)} to ${String(r.mappedTo)} 1:1 ${String(r.oneToOne)} branches ${String(r.branches)} asked ${String(r.asked)}\n`);
for (const r of removed) process.stdout.write(`  - ${r.tree} ${r.file} ${r.coreSet}\n`);
for (const r of changed) process.stdout.write(`  ~ ${r.tree} ${r.file} ${r.coreSet} asked ${String(before.get(idOf(r))!.asked)}->${String(r.asked)} key ${String(before.get(idOf(r))!.key)}->${String(r.key)}\n`);
const oi = process.argv.indexOf('--out');
if (oi >= 0 && process.argv[oi + 1] !== undefined) fs.writeFileSync(process.argv[oi + 1]!, `${JSON.stringify(out, null, 1)}\n`);
