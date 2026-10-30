/**
 * R-MIRROR-SEM candidate census on the dev trees (zero model calls): every candidate, whether its structure holds
 * (the model would be asked), and whether the baseline owns it.
 *
 *   npx tsx experiments/sem-mirror-dev/census.ts [substring of a tree id]
 */
import { buildGraph } from '../../src/v15-instrument/index.js';
import { structureHolds } from '../../src/v15-instrument/mirror-sem.js';
import { devTrees } from './trees.js';

async function main(): Promise<void> {
  const only = process.argv[2];
  for (const t of devTrees()) {
    if (only !== undefined && !t.id.includes(only)) continue;
    const { facts } = await buildGraph(t.tree, { spec: t.spec, withApg: false, ...(t.baseline !== undefined ? { baseline: t.baseline } : {}) });
    const cs = facts.mirrorCandidates;
    process.stdout.write(`${t.id.padEnd(52)} oracle ${t.oracle.padEnd(9)} candidates ${String(cs.length)} asked ${String(cs.filter(structureHolds).length)}\n`);
    for (const c of cs) {
      process.stdout.write(`    ${structureHolds(c) ? 'ASK ' : '    '}${c.file} ${c.coreSet} [${c.coreMembers.join('|')}] <- ${c.vendorSet} of ${c.module} [${c.vendorMembers.join('|')}] from ${String(c.mappedFrom)} to ${String(c.mappedTo)} 1:1 ${String(c.oneToOne)} branches ${String(c.branches.length)} owned '${c.ownedBy}'\n`);
    }
  }
}
void main();
