/**
 * Prints the R-MIRROR-SEM prompt of every asked candidate of the dev trees whose id contains the argument (zero calls).
 *
 *   npx tsx experiments/sem-mirror-dev/show-prompt.ts <substring>
 */
import { buildGraph } from '../../src/v15-instrument/index.js';
import { mirrorPrompt, structureHolds } from '../../src/v15-instrument/mirror-sem.js';
import { devTrees } from './trees.js';

async function main(): Promise<void> {
  for (const t of devTrees().filter((x) => x.id.includes(process.argv[2] ?? ''))) {
    const { facts } = await buildGraph(t.tree, { spec: t.spec, withApg: false, ...(t.baseline !== undefined ? { baseline: t.baseline } : {}) });
    for (const c of facts.mirrorCandidates.filter(structureHolds)) process.stdout.write(`===== ${t.id} ${c.coreSet}\n${mirrorPrompt(c)}\n`);
  }
}
void main();
