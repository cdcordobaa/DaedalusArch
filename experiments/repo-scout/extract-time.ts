/**
 * REPO-SCOUT (v1.5-exp): time the DaedalusArch extractor (`extractAPG`, the v1.3 defaults `evaluate` uses; imported
 * read-only) on one large tree, no Neo4j. Coverage against tsc is measured separately by the unchanged
 * `scripts/v1.3/graph-fidelity.ts project --views`.
 *
 * Usage: npx tsx experiments/repo-scout/extract-time.ts <root> <tsconfig> <out.json>
 */
import * as fs from 'node:fs';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';

const [root, tsconfig, out] = process.argv.slice(2);
if (!root || !tsconfig || !out) { process.stderr.write('usage: extract-time.ts <root> <tsconfig> <out.json>\n'); process.exit(2); }
const t0 = Date.now();
const res = await extractAPG(root, { ...V13_DEFAULT_OPTIONS }, tsconfig);
const ms = Date.now() - t0;
const data = res.data;
const byLabel = (xs: readonly { type?: string; label?: string; kind?: string }[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const x of xs) { const k = String(x.type ?? x.label ?? x.kind ?? '?'); m[k] = (m[k] ?? 0) + 1; }
  return m;
};
const rec = {
  success: res.success, ms, rssMB: Math.round(process.memoryUsage().rss / 1e6),
  nodes: data?.nodes.length ?? 0, edges: data?.edges.length ?? 0,
  nodeTypes: data ? byLabel(data.nodes as never) : {}, edgeTypes: data ? byLabel(data.edges as never) : {},
  errors: (res.errors ?? []).slice(0, 5).map((e) => e.message),
};
fs.writeFileSync(out, `${JSON.stringify(rec, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ success: rec.success, ms, nodes: rec.nodes, edges: rec.edges, rssMB: rec.rssMB })}\n`);
