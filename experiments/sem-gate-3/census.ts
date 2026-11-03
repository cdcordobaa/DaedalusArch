/**
 * SEM-GATE-3 census (zero model calls): the R-MIRROR-SEM candidates of every gate tree (`trees.ts`), with the asked
 * state and the question key, and for every form-C candidate (coreKind 'keys') the label-sheet numbers of GATE.md §3C:
 * distinct keys, vendor values the keys name, and keys the domain's own text names (spec and ARCHITECTURE / glossary,
 * as the prompt shows it; a key counts when it occurs as a word, case- and separator-insensitively).
 *
 *   npx tsx experiments/sem-gate-3/census.ts --out <file.json>
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph } from '../../src/v15-instrument/index.js';
import { mirrorKeyOf, structureHolds } from '../../src/v15-instrument/mirror-sem.js';
import { gateCases } from './trees.js';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const wordsOf = (t: string): Set<string> => {
  const out = new Set<string>();
  const toks = t.split(/[^A-Za-z0-9_-]+/).filter((x) => x !== '');
  // single words and runs of up to 3 words (`out for delivery` names `out_for_delivery`)
  const ws = t.split(/[^A-Za-z0-9]+/).filter((x) => x !== '');
  for (const x of toks) out.add(norm(x));
  for (let i = 0; i < ws.length; i++) for (let n = 1; n <= 3 && i + n <= ws.length; n++) out.add(norm(ws.slice(i, i + n).join('')));
  return out;
};

async function main(): Promise<void> {
  const out = argOf('--out');
  if (out === undefined) throw new Error('--out <file> is required');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-gate-3-census-'));
  const cases = gateCases(scratch);
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const g of cases) {
    if (seen.has(g.tree)) continue;
    seen.add(g.tree);
    const { facts } = await buildGraph(g.tree, { spec: g.c.spec, withApg: false, scratch, ...(g.baseline !== undefined ? { baseline: g.baseline } : {}) });
    for (const c of facts.mirrorCandidates) {
      const keys = c.coreKind === 'keys';
      const dw = keys ? wordsOf(c.domainText) : null;
      rows.push({
        set: g.set, case: g.c.id, label: g.c.label, form: g.c.form, file: c.file, coreSet: c.coreSet, coreKind: c.coreKind, vendor: `${c.vendorSet} of ${c.module}`,
        mapSide: c.mapSide ?? 'adapter', isTarget: g.c.target !== null && g.c.target.file === c.file && g.c.target.coreSet === c.coreSet,
        coreMembers: c.coreMembers, vendorMembers: c.vendorMembers.length, mappedFrom: c.mappedFrom, mappedTo: c.mappedTo, oneToOne: c.oneToOne,
        branches: c.branches.length, ownedBy: c.ownedBy, asked: structureHolds(c), key: structureHolds(c) ? mirrorKeyOf(c).slice(0, 24) : null,
        ...(keys ? { sheet: { keys: c.coreMembers.length, vendorNamed: c.mappedFrom, vendorSize: c.vendorMembers.length, keysInDomainText: c.coreMembers.filter((k) => dw!.has(norm(k))) } } : {}),
      });
    }
    process.stderr.write(`${g.set} ${g.c.id} ${String(facts.mirrorCandidates.length)}\n`);
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.writeFileSync(out, `${JSON.stringify({ trees: seen.size, candidates: rows.length, asked: rows.filter((r) => r['asked']).length, formC: rows.filter((r) => r['coreKind'] === 'keys').length, rows }, null, 1)}\n`);
}
void main();
