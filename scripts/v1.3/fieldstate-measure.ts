/**
 * Field-level state facts (HOLDS_STATE_OF) on the v1.3 reference set, in memory (no Neo4j). DEVELOPMENT SET.
 * Entry file: no exports.
 *
 * For every reference variant (as `ue-graph.ts`): materialise, `extractAPG` with `V13_FIELD_STATE_OPTIONS` and the
 * spec's `default_exclude_paths`, annotate layers with the ingestion's annotator (`memGraph`), and report
 * - the HOLDS_STATE_OF edges (by source kind) and the FLOWS_TO edges;
 * - FF-P06 domain-state-purity rows under the frozen text (field half from FLOWS_TO) and under the field-state variant
 *   (field half from HOLDS_STATE_OF), with the constructor-injection half unchanged (`v13DomainStatePurity`);
 * - per variant kind, the field-half rows against the manifests' expected FF-P06 findings. A field-half row on a clean
 *   or near-miss variant, or on a violation variant at a file no FF-P06 finding names, is a false positive.
 * Also checks that the rest of the graph is unchanged by the option (every non-HOLDS_STATE_OF edge equal to the
 * `V13_DEFAULT_OPTIONS` extraction).
 *
 * Usage (repository root): npx tsx scripts/v1.3/fieldstate-measure.ts --out results/v1.3-fieldstate
 * Writes <out>/fieldstate.json and prints the markdown tables.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { V13_DEFAULT_OPTIONS, V13_FIELD_STATE_OPTIONS } from '../../src/apg-extractor/types.js';
import { memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { Row } from '../../src/fitness-compiler/apg2-in-memory.js';
import { bindLayerParams } from '../../src/fitness-compiler/layer-binding.js';
import { v13DomainStatePurity } from '../../src/fitness-compiler/v13-in-memory-baselines.js';
import { v13InapplicableReason } from '../../src/fitness-compiler/v13-applicability.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import { normaliseFindingPath } from './lib/compare.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';

interface VariantResult {
  readonly id: string;
  readonly style: string;
  readonly kind: string;
  readonly ffp06Enabled: boolean;
  readonly ffp06Applicable: boolean;
  readonly expectedFfp06Files: string[];
  readonly flowsToEdges: number;
  readonly holdsEdges: number;
  readonly holdsBySource: Record<string, number>;
  readonly holdsBySources: Record<string, number>;
  readonly otherEdgesUnchanged: boolean;
  readonly rowsFrozen: Row[];
  readonly rowsVariant: Row[];
}

const fieldRows = (rows: readonly Row[]): Row[] => rows.filter((r) => r.relType !== 'CONSTRUCTOR_INJECTS');

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const out = path.resolve(oi >= 0 ? argv[oi + 1] ?? '' : 'results/v1.3-fieldstate');
  const refs = loadAllReferences(process.cwd());
  const work = makeTempRoot('v13-fieldstate-');
  const results: VariantResult[] = [];
  try {
    for (const ref of refs) {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error(`${ref.style}: spec does not parse`);
      const spec = parsed.data;
      const model = spec.layerModel;
      const binding = bindLayerParams(model.layers);
      const ffp06 = spec.fitnessFunctions.find((f) => f.name === 'domain-state-purity' && f.enabled !== false);
      const style = spec.style ?? ref.style;
      const excludes = specExcludePathsFromYaml(fs.readFileSync(ref.specPath, 'utf8'));
      for (const v of ref.variants) {
        const m = materialiseVariant(ref, v, work);
        const root = fs.realpathSync(m.projectDir);
        const tsconfig = path.join(root, 'tsconfig.json');
        const on = await extractAPG(root, { ...V13_FIELD_STATE_OPTIONS, excludePatterns: excludes }, tsconfig);
        const off = await extractAPG(root, { ...V13_DEFAULT_OPTIONS, excludePatterns: excludes }, tsconfig);
        if (!on.success || !off.success) throw new Error(`${ref.style}/${v.manifest.variant}: extraction failed`);
        const rel = (p: unknown): unknown => (typeof p === 'string' ? normaliseFindingPath(normaliseFindingPath(p, root), m.projectDir) : p);
        const relRow = (r: Row): Row => ({ ...r, filePath: rel(r.filePath), target: rel(r.target) });
        const g = memGraph(on.data, model);
        const dl = binding.domainLayer;
        const il = binding.infraLayer;
        const frozen = dl !== undefined && il !== undefined ? v13DomainStatePurity(g, dl, il, 'FLOWS_TO').map(relRow) : [];
        const sourcesOf = (r: Row): string => {
          const e = on.data.edges.find((x) => x.type === 'HOLDS_STATE_OF' && g.node(x.sourceId).name === r.class && g.node(x.sourceId).filePath === r.filePath && g.node(x.targetId).filePath === r.target);
          return e === undefined ? '' : (e.properties.sources as string[]).join(', ');
        };
        const variant = dl !== undefined && il !== undefined
          ? v13DomainStatePurity(g, dl, il, 'HOLDS_STATE_OF').map((r) => ({ ...relRow(r), ...(r.relType === 'HOLDS_STATE_OF' ? { sources: sourcesOf(r) } : {}) }))
          : [];
        const holds = on.data.edges.filter((e) => e.type === 'HOLDS_STATE_OF');
        const bySource: Record<string, number> = {};
        const bySources: Record<string, number> = {};
        for (const e of holds) {
          const s = String(e.properties.source);
          bySource[s] = (bySource[s] ?? 0) + 1;
          for (const k of e.properties.sources as string[]) bySources[k] = (bySources[k] ?? 0) + 1;
        }
        const rest = on.data.edges.filter((e) => e.type !== 'HOLDS_STATE_OF');
        results.push({
          id: `${ref.style}/${v.manifest.variant}`, style: ref.style, kind: v.manifest.kind,
          ffp06Enabled: ffp06 !== undefined,
          ffp06Applicable: ffp06 !== undefined && v13InapplicableReason('domain-state-purity', style) === undefined,
          expectedFfp06Files: v.manifest.expectedFindings.filter((f) => f.ruleId === 'FF-P06').map((f) => f.file),
          flowsToEdges: on.data.edges.filter((e) => e.type === 'FLOWS_TO').length,
          holdsEdges: holds.length, holdsBySource: bySource, holdsBySources: bySources,
          otherEdgesUnchanged: JSON.stringify(rest) === JSON.stringify(off.data.edges) && JSON.stringify(on.data.nodes) === JSON.stringify(off.data.nodes),
          rowsFrozen: frozen, rowsVariant: variant,
        });
        process.stderr.write(`${ref.style}/${v.manifest.variant}: holds ${String(holds.length)}, flows ${String(results.at(-1)?.flowsToEdges)}\n`);
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'fieldstate.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), variants: results }, null, 1)}\n`);

  const p = (s: string): void => { process.stdout.write(`${s}\n`); };
  const sum = (xs: readonly VariantResult[], f: (x: VariantResult) => number): number => xs.reduce((a, x) => a + f(x), 0);
  const sources = ['declared-type', 'property-injection', 'initializer', 'constructor-new', 'constructor-param'];
  p('### Edges per style (all variants)');
  p(`| Style | Variants | FLOWS_TO | HOLDS_STATE_OF | ${sources.map((s) => `${s} (kept / any)`).join(' | ')} | Rest of graph unchanged |`);
  p(`|---|---|---|---|${sources.map(() => '---').join('|')}|---|`);
  for (const style of [...new Set(results.map((r) => r.style))]) {
    const xs = results.filter((r) => r.style === style);
    p(`| ${style} | ${String(xs.length)} | ${String(sum(xs, (x) => x.flowsToEdges))} | ${String(sum(xs, (x) => x.holdsEdges))} | ${sources.map((s) => `${String(sum(xs, (x) => x.holdsBySource[s] ?? 0))} / ${String(sum(xs, (x) => x.holdsBySources[s] ?? 0))}`).join(' | ')} | ${String(xs.filter((x) => x.otherEdgesUnchanged).length)}/${String(xs.length)} |`);
  }
  p('');
  p('### FF-P06 field half: FLOWS_TO (frozen) vs HOLDS_STATE_OF (variant), styles where FF-P06 is enabled');
  p('| Style | Kind | Variants | Field rows FLOWS_TO | Field rows HOLDS_STATE_OF | CI rows | Expected FF-P06 variants | Caught FLOWS_TO | Caught HOLDS_STATE_OF | FP variants FLOWS_TO | FP variants HOLDS_STATE_OF |');
  p('|---|---|---|---|---|---|---|---|---|---|---|');
  const caught = (x: VariantResult, rows: readonly Row[]): boolean => x.expectedFfp06Files.length > 0 && x.expectedFfp06Files.every((f) => fieldRows(rows).some((r) => r.filePath === f) || rows.some((r) => r.filePath === f));
  const fp = (x: VariantResult, rows: readonly Row[]): boolean => fieldRows(rows).some((r) => !x.expectedFfp06Files.includes(String(r.filePath)));
  for (const style of [...new Set(results.filter((r) => r.ffp06Enabled).map((r) => r.style))]) {
    for (const kind of ['clean', 'near-miss', 'violation']) {
      const xs = results.filter((r) => r.style === style && r.kind === kind && r.ffp06Enabled);
      if (xs.length === 0) continue;
      const exp = xs.filter((x) => x.expectedFfp06Files.length > 0);
      p(`| ${style}${xs[0]?.ffp06Applicable === true ? '' : ' (v1.3 N/A style)'} | ${kind} | ${String(xs.length)} | ${String(sum(xs, (x) => fieldRows(x.rowsFrozen).length))} | ${String(sum(xs, (x) => fieldRows(x.rowsVariant).length))} | ${String(sum(xs, (x) => x.rowsVariant.length - fieldRows(x.rowsVariant).length))} | ${String(exp.length)} | ${String(exp.filter((x) => caught(x, x.rowsFrozen)).length)} | ${String(exp.filter((x) => caught(x, x.rowsVariant)).length)} | ${String(xs.filter((x) => fp(x, x.rowsFrozen)).length)} | ${String(xs.filter((x) => fp(x, x.rowsVariant)).length)} |`);
    }
  }
  p('');
  p('### Every FF-P06 field row (either text)');
  p('| Variant | Kind | Expected | Class | Target | Edge | Field | Source kind(s) |');
  p('|---|---|---|---|---|---|---|---|');
  for (const x of results) {
    const rows = [...fieldRows(x.rowsFrozen), ...fieldRows(x.rowsVariant)];
    for (const r of rows) {
      const e = x.rowsVariant.includes(r) ? 'HOLDS_STATE_OF' : 'FLOWS_TO';
      p(`| ${x.id} | ${x.kind} | ${x.expectedFfp06Files.includes(String(r.filePath)) ? 'yes' : 'no'} | ${String(r.class)} | ${String(r.targetName)} | ${e} | ${String(r.field)} | ${typeof r.sources === 'string' ? r.sources : '(FLOWS_TO)'} |`);
    }
  }
}

void run();
