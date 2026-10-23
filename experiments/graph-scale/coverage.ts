/**
 * GRAPH-SCALE (v1.5-exp, U1 groundwork, fix (e)): extraction coverage against tsc, before and after adding the inline
 * `import('…')` type edges. Zero model calls.
 *
 * Before = the frozen extractor (`extractAPG`, v1.3 defaults) in its literal view (no `viaReExport` edges), as the
 * scout's `apg-v13-literal` variant of `scripts/v1.3/graph-fidelity.ts project --views`. After = the same edge set plus
 * the edges of `experiments/detect-02/lib/import-types.ts` between APG files. The reference is the compiler
 * (`tscReference`), scoped to edges whose two ends are APG files, exactly as the fidelity harness scopes it. The
 * extractor and the fidelity library are imported read-only.
 *
 * Usage: npx tsx experiments/graph-scale/coverage.ts <root> <tsconfig> <out.json>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';
import { agreement, edgeKey, occurrencesByEdge, projectApg, scopeOf, splitKey, tscReference } from '../../scripts/v1.3/lib/graph-fidelity.js';
import type { ApgLike, EdgeKey } from '../../scripts/v1.3/lib/graph-fidelity.js';
import { importTypeEdges } from '../detect-02/lib/import-types.js';

const [rootArg, tsconfigArg, out] = process.argv.slice(2);
if (!rootArg || !tsconfigArg || !out) { process.stderr.write('usage: coverage.ts <root> <tsconfig> <out.json>\n'); process.exit(2); }
const root = path.resolve(rootArg);
const tsconfig = path.resolve(tsconfigArg);

const t0 = Date.now();
const res = await extractAPG(root, { ...V13_DEFAULT_OPTIONS }, tsconfig);
const extractMs = Date.now() - t0;
if (!res.success || !res.data) throw new Error(`extraction failed: ${(res.errors ?? []).map((e) => e.message).join('; ')}`);
const data = res.data as unknown as ApgLike;
const literal = { ...data, edges: data.edges.filter((e) => !(e.type === 'IMPORTS' && (e.properties as Record<string, unknown>).viaReExport === true)) };
const apg = projectApg(literal);
const apgFiles = new Set(apg.files);

const t1 = Date.now();
const extra = importTypeEdges(root, tsconfig);
const addOnMs = Date.now() - t1;
const extraKeys = new Set<EdgeKey>(extra.filter((e) => apgFiles.has(e.source) && apgFiles.has(e.target)).map((e) => edgeKey(e.source, e.target)));

const tsc = tscReference(root, tsconfig);
const inScope = (k: EdgeKey): boolean => { const [s, t] = splitKey(k); return scopeOf(s, apgFiles) === 'in-scope' && scopeOf(t, apgFiles) === 'in-scope'; };
const ref = new Set([...occurrencesByEdge(tsc.occurrences).keys()].filter(inScope));
const before = new Set([...apg.edges.keys()].filter(inScope));
const after = new Set([...before, ...[...extraKeys].filter(inScope)]);
const missedBefore = [...ref].filter((k) => !before.has(k));
const missedAfter = [...ref].filter((k) => !after.has(k));
const rec = {
  tree: path.basename(root), modelCalls: 0, extractMs, addOnMs, rssMB: Math.round(process.memoryUsage().rss / 1e6),
  apgFiles: apgFiles.size, importTypeEdges: extra.length, importTypeEdgesNew: [...extraKeys].filter((k) => !before.has(k)).length,
  before: agreement(before, ref), after: agreement(after, ref),
  missedBefore: missedBefore.length, missedAfter: missedAfter.length,
  missedAfterSample: missedAfter.slice(0, 20).map((k) => splitKey(k).join(' -> ')),
  fixedSample: missedBefore.filter((k) => after.has(k)).slice(0, 10).map((k) => splitKey(k).join(' -> ')),
};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(rec, null, 1)}\n`);
process.stdout.write(`${rec.tree}: extract ${extractMs} ms, add-on ${addOnMs} ms; tsc coverage ${rec.before.refCoveredByApg.toFixed(4)} -> ${rec.after.refCoveredByApg.toFixed(4)}, confirmation ${rec.before.apgConfirmedByRef.toFixed(4)} -> ${rec.after.apgConfirmedByRef.toFixed(4)}; missed ${rec.missedBefore} -> ${rec.missedAfter}\n`);
