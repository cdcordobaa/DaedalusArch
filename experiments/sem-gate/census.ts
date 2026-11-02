/**
 * SEM-GATE census (zero model calls): the R-MIRROR-SEM candidates of the trees of a JSON list
 * (`[{ id, tree, spec, baseline? }]`). Prints one line per tree and one per candidate (ASK when the structure holds, so
 * the judge would be asked).
 *
 *   npx tsx experiments/sem-gate/census.ts --list <file> [--json <out>]
 */
import * as fs from 'node:fs';
import { buildGraph } from '../../src/v15-instrument/index.js';
import { structureHolds } from '../../src/v15-instrument/mirror-sem.js';

interface T { id: string; tree: string; spec: string; baseline?: string }
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main(): Promise<void> {
  const lf = argOf('--list');
  if (lf === undefined) throw new Error('--list <file> is required');
  const list = JSON.parse(fs.readFileSync(lf, 'utf8')) as T[];
  const out: Record<string, unknown>[] = [];
  for (const t of list) {
    const { facts } = await buildGraph(t.tree, { spec: t.spec, withApg: false, ...(t.baseline !== undefined ? { baseline: t.baseline } : {}) });
    const cs = facts.mirrorCandidates;
    process.stdout.write(`${t.id.padEnd(40)} candidates ${String(cs.length)} asked ${String(cs.filter(structureHolds).length)}\n`);
    for (const c of cs) {
      process.stdout.write(`    ${structureHolds(c) ? 'ASK ' : '    '}${c.file} ${c.coreSet} [${c.coreMembers.join('|')}] <- ${c.vendorSet} of ${c.module} [${c.vendorMembers.join('|')}] from ${String(c.mappedFrom)} to ${String(c.mappedTo)} 1:1 ${String(c.oneToOne)} branches ${String(c.branches.length)} owned '${c.ownedBy}'\n`);
    }
    out.push({ id: t.id, candidates: cs.map((c) => ({ id: c.id, coreSet: c.coreSet, coreMembers: c.coreMembers, vendorSet: `${c.vendorSet} of ${c.module}`, vendorMembers: c.vendorMembers, mappedFrom: c.mappedFrom, mappedTo: c.mappedTo, oneToOne: c.oneToOne, branches: c.branches.length, ownedBy: c.ownedBy, asked: structureHolds(c) })) });
  }
  const j = argOf('--json');
  if (j !== undefined) fs.writeFileSync(j, `${JSON.stringify(out, null, 1)}\n`);
}
void main();
