// HCAL-08 post-scoring diagnosis (2026-11-03, after result.json was committed): the R-MIRROR-SEM candidates of named
// trees, zero model calls, no judge, no rescoring. Each tree is the case overlaid on its base, with the base as the
// baseline, as the scorer builds it. PROBE_NM=1 also copies the in-tree vendor SDK to node_modules/ (a scratch copy
// only; no case file changes), to test whether the misses come from the vendor typings not resolving.
//   npx tsx experiments/hcal-08/post-score-census.mts <scoring copy> <domain>/<case> ...
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const { buildGraph } = await import(path.join(ROOT, 'src/v15-instrument/index.ts'));
const { structureHolds } = await import(path.join(ROOT, 'src/v15-instrument/mirror-sem.ts'));
const COPY = process.argv[2]!;
const cases = process.argv.slice(3);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hcal08-census-'));
for (const dc of cases) {
  const [domain, c] = dc.split('/') as [string, string];
  const tree = path.join(scratch, domain, c);
  fs.cpSync(path.join(COPY, domain, 'base'), tree, { recursive: true });
  fs.cpSync(path.join(COPY, domain, 'cases', c), tree, { recursive: true });
  if (process.env.PROBE_NM === "1") for (const v of fs.readdirSync(path.join(tree, "vendor"))) fs.cpSync(path.join(tree, "vendor", v), path.join(tree, "node_modules", v), { recursive: true });
  const { facts } = await buildGraph(tree, { spec: path.join(tree, 'spec.yaml'), withApg: false, scratch: path.join(scratch, '_s'), baseline: path.join(COPY, domain, 'base') });
  const cs = facts.mirrorCandidates as any[];
  console.log(`== ${dc}: ${cs.length} candidates`);
  for (const x of cs) console.log(`   ${x.file}#${x.coreSet} kind=${x.coreKind} side=${x.mapSide ?? 'adapter'} vendor=${x.vendorSet} members=${x.coreMembers.length} from=${x.mappedFrom} to=${x.mappedTo} branches=${x.branches.length} ownedBy='${x.ownedBy}' asked=${structureHolds(x)}`);
}
fs.rmSync(scratch, { recursive: true, force: true });
