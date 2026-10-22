// REPO-SCOUT: the tsc-scoped coverage / confirmation per extractor view from a graph-fidelity aggregate.json.
// Usage: node experiments/repo-scout/fidelity-summary.mjs <aggregate.json>
import fs from 'node:fs';
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = {};
for (const [v, r] of Object.entries(a.variants)) {
  const m = r.agreement['tsc.scoped'].micro;
  out[v] = { tscEdges: m.refEdges, apgEdges: m.apgEdges, both: m.both, coverage: m.refCoveredByApg, confirmation: m.apgConfirmedByRef };
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
