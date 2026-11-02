/**
 * SEM-GATE label sheet (zero model calls): for every tree of a JSON list (`[{ id, tree, spec, baseline? }]`), every
 * R-MIRROR-SEM candidate whose structure holds, with what the written labelling rule of GATE.md (§3) reads: the
 * mapping pairs, the per-vendor-value fan-out, the core members outside the mapping, and which core members the
 * domain's own text names. Distinct questions (content-hash keys) are listed once, with every tree that asks them.
 *
 *   npx tsx experiments/sem-gate/label-sheet.ts --list <file> [--json <out>]
 */
import * as fs from 'node:fs';
import { buildGraph } from '../../src/v15-instrument/index.js';
import { mirrorKeyOf, structureHolds, type MirrorCandidateFact } from '../../src/v15-instrument/mirror-sem.js';

interface T { id: string; tree: string; spec: string; baseline?: string }
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function sheetOf(c: MirrorCandidateFact): Record<string, unknown> {
  const to = (p: { to: string }): string => p.to.replace(/^lit:/, '').replace(/^ref:[^.]*\./, '');
  const fan = new Map<string, Set<string>>();
  for (const p of c.pairs) fan.set(p.from, (fan.get(p.from) ?? new Set()).add(to(p)));
  const into = new Map<string, Set<string>>();
  for (const p of c.pairs) into.set(to(p), (into.get(to(p)) ?? new Set()).add(p.from));
  const text = norm(c.domainText);
  return {
    coreSet: c.coreSet, file: c.file, coreMembers: c.coreMembers, vendor: `${c.vendorSet} of ${c.module}`, vendorMembers: c.vendorMembers,
    pairs: c.pairs.map((p) => `${p.from}->${to(p)}`),
    vendorUnmapped: c.vendorMembers.filter((v) => !fan.has(v)),
    coreMembersReachedByTwoOrMore: [...into.entries()].filter(([, s]) => s.size >= 2).map(([k]) => k),
    sameWordModuloCase: c.coreMembers.filter((m) => c.vendorMembers.some((v) => norm(v) === norm(m))),
    namedInDomainText: c.coreMembers.filter((m) => norm(m).length >= 3 && text.includes(norm(m))),
    branches: c.branches.length,
  };
}

async function main(): Promise<void> {
  const lf = argOf('--list');
  if (lf === undefined) throw new Error('--list <file> is required');
  const byKey = new Map<string, { trees: string[]; sheet: Record<string, unknown> }>();
  for (const t of JSON.parse(fs.readFileSync(lf, 'utf8')) as T[]) {
    const { facts } = await buildGraph(t.tree, { spec: t.spec, withApg: false, ...(t.baseline !== undefined ? { baseline: t.baseline } : {}) });
    for (const c of facts.mirrorCandidates.filter(structureHolds)) {
      const k = mirrorKeyOf(c).slice(0, 24);
      const e = byKey.get(k) ?? { trees: [], sheet: sheetOf(c) };
      e.trees.push(t.id);
      byKey.set(k, e);
    }
  }
  const out = [...byKey.entries()].map(([key, e]) => ({ key, ...e }));
  for (const e of out) process.stdout.write(`${JSON.stringify(e)}\n`);
  const j = argOf('--json');
  if (j !== undefined) fs.writeFileSync(j, `${JSON.stringify(out, null, 1)}\n`);
}
if (process.argv[1]?.endsWith('label-sheet.ts')) void main();
