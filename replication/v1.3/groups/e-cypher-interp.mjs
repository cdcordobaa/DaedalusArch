// Cypher interpreter spike (Docs/v1.3/cypher-interpreter.md): the no-Neo4j reference run, the mirror comparison, the
// unit tests and interpreter semantics regenerated offline; the Neo4j parity table and the timings re-derived from the
// committed outputs in results/v1.3-cypher-interp/ (the Neo4j side of the parity run is not committed as raw rows).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOC = 'Docs/v1.3/cypher-interpreter.md';
const REF = 'results/v1.3-reference/after-member-facts';
const CI = 'results/v1.3-cypher-interp';
const n = (id, line, what, stated, extra = {}) => ({ id, doc: DOC, line, what, stated, ...extra });
const comma = (x) => x.toLocaleString('en-US');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** Run a small module with tsx from the repository root (imports read the repository, write nothing into it). */
function tsx(ctx, name, code) {
  const f = join(ctx.out(name), `${name}.mjs`);
  writeFileSync(f, code);
  return JSON.parse(ctx.sh(`node --import tsx ${f}`).trim().split('\n').pop());
}

// ── §4 parity table as the doc writes it (lines 179-242), one number per cell ─────────────────────────────────────
const PARITY_COLS = ['statements', 'projects', 'equal', 'order', 'content', 'error', 'unsupported', 'both-error', 'rowsNeo4j'];
const PARITY_DOC = [
  "abstraction-ratio | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 486",
  "aggregate-boundary | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 302",
  "application-service-thin | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 2068",
  "boundary-type-leak | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 132",
  "bounded-context-modules | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 176",
  "component-adp-cycle | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 42",
  "component-instability | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 17028",
  "component-main-sequence-distance | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 102",
  "component-sdp-violation | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 82",
  "context-isolation | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 35028",
  "controller-no-entity | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 1632",
  "core-isolation | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 3118",
  "deep-import-declared-api | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 26",
  "deep-import-inferred-api | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 6",
  "dependency-direction | 1598 | 79 | 1598 | 0 | 0 | 0 | 0 | 0 | 394",
  "dependency-direction-graph | 1576 | 79 | 1576 | 0 | 0 | 0 | 0 | 0 | 292",
  "dependency-inversion | 814 | 79 | 814 | 0 | 0 | 0 | 0 | 0 | 582",
  "domain-event-placement | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 14",
  "domain-purity | 1658 | 79 | 1658 | 0 | 0 | 0 | 0 | 0 | 200",
  "domain-stability | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 5214",
  "domain-state-purity | 844 | 79 | 844 | 0 | 0 | 0 | 0 | 0 | 578",
  "ingest | 4146 | 79 | 4146 | 0 | 0 | 0 | 0 | 0 | 0",
  "ingest-verify | 884 | 79 | 632 | 252 | 0 | 0 | 0 | 0 | 3704",
  "inheritance-depth | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 26",
  "interface-segregation-proxy | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 1312",
  "io-outside-adapters | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 18",
  "judge-graph:classes | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 7380",
  "judge-graph:edges | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 33113",
  "judge-graph:files | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 10691",
  "judge-graph:interfaces | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 3685",
  "layer-skip-graph | 1576 | 79 | 1576 | 0 | 0 | 0 | 0 | 0 | 8268",
  "max-fan-in | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 29382",
  "module-domain-imports-infrastructure | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 6",
  "module-fan-out | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 25512",
  "naming-controllers | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 4",
  "naming-conventions | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 5562",
  "naming-repos | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 1518",
  "naming-services | 844 | 79 | 844 | 0 | 0 | 0 | 0 | 0 | 580",
  "no-cyclic-deps | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 166",
  "no-domain-outward-dep | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 3122",
  "no-index-logic | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 6",
  "no-layer-skip | 1542 | 79 | 1542 | 0 | 0 | 0 | 0 | 0 | 19462",
  "no-orphan-files | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 114",
  "nondeterminism-in-core | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 308",
  "port-adapter-pattern | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 1346",
  "port-dependency-inversion | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 578",
  "repository-aggregate-root | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 34",
  "repository-pattern | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 66",
  "single-responsibility-proxy | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 4988",
  "test-file-pairing | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 23212",
  "undeclared-async-coupling | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 30",
  "universal-literal:averageInstability | 450 | 79 | 203 | 247 | 0 | 0 | 0 | 0 | 450",
  "universal-literal:cyclicDependencyCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal-literal:maxFanIn | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal-literal:maxFanOut | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal-literal:orphanFileCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal:abstractionRatio | 900 | 79 | 900 | 0 | 0 | 0 | 0 | 0 | 900",
  "universal:averageInstability | 450 | 79 | 186 | 264 | 0 | 0 | 0 | 0 | 450",
  "universal:cyclicDependencyCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal:maxFanIn | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal:maxFanOut | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "universal:orphanFileCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450",
  "use-case-isolation | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 76",
  "value-object-immutability | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 2220",
];
const slug = (t) => t.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
const parityCells = PARITY_DOC.flatMap((row, i) => {
  const [tpl, ...cells] = row.split(' | ');
  return cells.map((v, j) => n(`e-ci-par-${slug(tpl)}-${PARITY_COLS[j] === 'rowsNeo4j' ? 'rows' : PARITY_COLS[j]}`, 179 + i,
    `parity table: ${tpl}, ${PARITY_COLS[j] === 'rowsNeo4j' ? 'Neo4j rows' : PARITY_COLS[j]}`, v));
});

export default [
  {
    id: 'e-ci-ubl',
    title: 'ue-baseline-live --engine cypher-interp (no Neo4j) vs the committed after-member-facts reference',
    needs: 'offline', basis: 'regenerated', slow: true,
    how: 'node --import tsx scripts/v1.3/ue-baseline-live.ts --engine cypher-interp --out <scratch>  (NEO4J_* unset; in a HEAD export)',
    numbers: [
      n('e-ci-ubl-variants', 14, 'reference variants run with --engine cypher-interp', '71'),
      n('e-ci-ubl-raw', 14, 'raw/ files byte-identical to after-member-facts', '71'),
      n('e-ci-ubl-evidence', 14, 'evidence violations identical (elapsedMs ignored)', '71/71'),
      n('e-ci-ubl-raw-s4', 251, 'raw/ byte-identical to after-member-facts (section 4)', '71/71'),
      n('e-ci-ubl-variants-s6', 285, 'reference-set CLI run, variants', '71'),
    ],
    async run(ctx) {
      const out = ctx.out('e-ci-ubl');
      ctx.sh(`node --import tsx scripts/v1.3/ue-baseline-live.ts --engine cypher-interp --out ${out}`, { cwd: ctx.tree() });
      const raws = walk(ctx.p(`${REF}/raw`)).map((f) => f.slice(ctx.p(REF).length + 1));
      const same = raws.filter((r) => { try { return readFileSync(join(out, r)).equals(readFileSync(ctx.p(`${REF}/${r}`))); } catch { return false; } }).length;
      const regen = walk(join(out, 'raw')).length;
      const ev = walk(ctx.p(`${REF}/evidence`)).map((f) => f.slice(ctx.p(REF).length + 1));
      const evSame = ev.filter((r) => JSON.stringify(JSON.parse(readFileSync(join(out, r), 'utf8')).violations) === JSON.stringify(ctx.json(`${REF}/${r}`).violations)).length;
      return {
        'e-ci-ubl-variants': String(regen), 'e-ci-ubl-raw': String(same), 'e-ci-ubl-evidence': `${evSame}/${ev.length}`,
        'e-ci-ubl-raw-s4': `${same}/${raws.length}`, 'e-ci-ubl-variants-s6': String(regen),
      };
    },
  },
  {
    id: 'e-ci-mirrors',
    title: 'APG v2 hand mirrors vs the interpreter on the same graphs (no Neo4j)',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'node --import tsx scripts/v1.3/cypher-interp-mirrors.ts --out <scratch>',
    numbers: [
      n('e-ci-mir-grid', 17, 'templates x projects with rows and row order identical', '9 templates × 78 projects'),
      n('e-ci-mir-grid-s7', 309, 'templates x projects with rows and order identical (recommendation)', '9 templates × 78 projects'),
      n('e-ci-mir-projects-s6', 291, 'cypher-interp-mirrors.ts projects', '78'),
    ],
    async run(ctx) {
      const out = ctx.out('e-ci-mirrors');
      ctx.sh(`node --import tsx scripts/v1.3/cypher-interp-mirrors.ts --out ${out}`);
      const m = JSON.parse(readFileSync(join(out, 'mirrors.json'), 'utf8'));
      const ok = m.byTemplate.filter((t) => t.multisetEqual === t.projects && t.orderEqual === t.projects && m.differences.length === 0);
      const grid = `${ok.length} templates × ${Math.min(...m.byTemplate.map((t) => t.projects))} projects`;
      return { 'e-ci-mir-grid': grid, 'e-ci-mir-grid-s7': grid, 'e-ci-mir-projects-s6': String(m.byTemplate[0].projects) };
    },
  },
  {
    id: 'e-ci-unit',
    title: 'interpreter unit tests (tests/unit/cypher-interp)',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'npx jest tests/unit/cypher-interp --maxWorkers=2',
    numbers: [n('e-ci-unit-tests', 18, 'unit tests passed / total', '29/29')],
    async run(ctx) {
      let txt;
      try { txt = ctx.sh('npx jest tests/unit/cypher-interp --maxWorkers=2 2>&1'); } catch (e) { txt = String(e.stdout ?? '') + String(e.stderr ?? ''); }
      const m = /Tests:\s+(?:(\d+) failed, )?(\d+) passed, (\d+) total/.exec(txt);
      return { 'e-ci-unit-tests': m ? `${m[2]}/${m[3]}` : 'no jest summary' };
    },
  },
  {
    id: 'e-ci-traps',
    title: 'interpreter answers for the semantic traps of section 5 (interpreter column; the Neo4j column needs Neo4j)',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'MemoryGraphRepository.executeQuery on the T5, T6, T7, T13, T14, T16 example queries (node --import tsx)',
    numbers: [
      n('e-ci-t5', 263, 'T5: UNWIND [1.0, 1, 2] AS x RETURN x, count(*)', '1.0, 2 then 2, 1'),
      n('e-ci-t6', 264, 'T6: apoc.coll.indexOf([1, 2], 2.0)', '1'),
      n('e-ci-t7', 265, 'T7: apoc.coll.indexOf(null, x)', '-1'),
      n('e-ci-t13', 271, "T13: size('😀')", '1'),
      n('e-ci-t14', 272, "T14: toString(1.0), 'x' + 1.0, toString(1e20)", '1.0, x1.0, 1.0E20'),
      n('e-ci-t16', 274, 'T16: 7 / 2, -7 / 2, -7 % 2, 2 ^ 2', '3, -3, -1, 4.0'),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-ci-traps', `
const R = process.cwd();
const { MemoryGraphRepository } = await import(R + '/src/cypher-interp/repository.ts');
const { javaDoubleToString } = await import(R + '/src/cypher-interp/values.ts');
const { createRequire } = await import('node:module');
const neo4j = createRequire(R + '/package.json')('neo4j-driver');
const repo = new MemoryGraphRepository();
const s = (v) => neo4j.isInt(v) ? v.toString() : typeof v === 'number' ? javaDoubleToString(v) : String(v);
async function q(c) { const r = await repo.executeQuery(c, {}); if (!r.success) throw new Error(r.errors[0].code); return r.data.records; }
const o = {};
o.t5 = (await q('UNWIND [1.0, 1, 2] AS x RETURN x, count(*) AS c')).map((r) => s(r.x) + ', ' + s(r.c)).join(' then ');
o.t6 = s((await q('RETURN apoc.coll.indexOf([1, 2], 2.0) AS a'))[0].a);
o.t7 = s((await q('RETURN apoc.coll.indexOf(null, 1) AS a'))[0].a);
o.t13 = s((await q("RETURN size('\\u{1F600}') AS a"))[0].a);
const t14 = (await q("RETURN toString(1.0) AS a, 'x' + 1.0 AS b, toString(1e20) AS c"))[0];
o.t14 = [t14.a, t14.b, t14.c].join(', ');
const t16 = (await q('RETURN 7 / 2 AS a, -7 / 2 AS b, -7 % 2 AS c, 2 ^ 2 AS d'))[0];
o.t16 = [t16.a, t16.b, t16.c, t16.d].map(s).join(', ');
console.log(JSON.stringify(o));
`);
      return { 'e-ci-t5': r.t5, 'e-ci-t6': r.t6, 'e-ci-t7': r.t7, 'e-ci-t13': r.t13, 'e-ci-t14': r.t14, 'e-ci-t16': r.t16 };
    },
  },
  {
    id: 'e-ci-code',
    title: 'repository facts the interpreter doc states (catalogue census, generated parser, file sizes, CLI)',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'catalogue sizes from CYPHER_TEMPLATES / V13_EXTENSION_TEMPLATE_CATALOGUES / UNIVERSAL_METRIC_QUERIES* / JUDGE_GRAPH_QUERIES / verifyIngestion; wc and grep on the named files',
    numbers: [
      n('e-ci-census-all', 116, 'catalogue templates in the census', '47'),
      n('e-ci-census-frozen', 116, 'frozen CYPHER_TEMPLATES', '25'),
      n('e-ci-census-hex', 116, 'hexagonal templates', '5'),
      n('e-ci-census-mw', 117, 'module-wiring templates', '1'),
      n('e-ci-census-ddd', 117, 'DDD templates', '7'),
      n('e-ci-census-apg2', 117, 'APG v2 templates', '9'),
      n('e-ci-census-univ', 117, 'distinct universal-metric texts', '11'),
      n('e-ci-census-judge', 118, 'judge graph-view queries', '4'),
      n('e-ci-census-verify', 118, 'ingestion verification counts (verifyIngestion queries)', '4'),
      n('e-ci-baselines', 32, 'ablation baselines from v13-in-memory-baselines.ts (imported by scripts/apg2-ablation.ts)', '3'),
      n('e-ci-gen-size', 59, 'generated parser size (Cypher25Lexer.ts + Cypher25Parser.ts)', '2 MB'),
      n('e-ci-gen-size-s8', 344, 'generated parser size (packaging)', '2 MB'),
      n('e-ci-mirror-lines', 309, 'apg2-in-memory.ts line count', '271 lines'),
      n('e-ci-cli-pw', 336, "unconditional requireEnvForCli('NEO4J_PASSWORD') calls left in src/cli/cli.ts", 'two'),
      n('e-ci-apg2-per-project', 290, 'APG v2 templates per project', '9'),
      n('e-ci-mir-templates-s6', 291, 'templates in the mirror comparison', '9'),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-ci-code', `
const R = process.cwd();
const { CYPHER_TEMPLATES } = await import(R + '/src/fitness-compiler/cypher-templates.ts');
const { V13_EXTENSION_TEMPLATE_CATALOGUES: C } = await import(R + '/src/fitness-compiler/extension-templates.ts');
const { UNIVERSAL_METRIC_QUERIES: U, UNIVERSAL_METRIC_QUERIES_LITERAL: L } = await import(R + '/src/scoring-engine/universal-metrics.ts');
const { JUDGE_GRAPH_QUERIES } = await import(R + '/src/llm-critic/judge-graph.ts');
const { APG2_TEMPLATES } = await import(R + '/src/fitness-compiler/apg2-templates.ts');
const sz = (k) => C.get(k).size;
console.log(JSON.stringify({ frozen: CYPHER_TEMPLATES.size, hex: sz('hexagonal'), mw: sz('module-wiring'), ddd: sz('ddd'), apg2: sz('apg2'),
  univ: new Set([...Object.values(U), ...Object.values(L)]).size, judge: Object.keys(JUDGE_GRAPH_QUERIES).length, apg2t: APG2_TEMPLATES.size ?? Object.keys(APG2_TEMPLATES).length }));
`);
      const all = r.frozen + r.hex + r.mw + r.ddd + r.apg2;
      const ing = ctx.read('src/neo4j-ingestion/graph-ingester.ts');
      const vi = ing.slice(ing.indexOf('export async function verifyIngestion'));
      const verify = (vi.slice(0, vi.indexOf('\n}\n')).match(/graphRepo\.executeQuery\(/g) ?? []).length;
      const abl = /import \{([^}]*)\} from '\.\.\/src\/fitness-compiler\/v13-in-memory-baselines\.js'/.exec(ctx.read('scripts/apg2-ablation.ts'));
      const baselines = abl ? abl[1].split(',').map((x) => x.trim()).filter((x) => /^v13/.test(x)).length : 0;
      const gen = ['Cypher25Lexer.ts', 'Cypher25Parser.ts'].reduce((s, f) => s + statSync(ctx.p(`src/cypher-interp/generated/${f}`)).size, 0);
      const mb = `${(gen / 1e6).toFixed(0)} MB`;
      const lines = ctx.read('src/fitness-compiler/apg2-in-memory.ts').split('\n').length - 1;
      const cli = ctx.read('src/cli/cli.ts').split('\n').filter((l) => l.includes("requireEnvForCli('NEO4J_PASSWORD')") && !l.includes('cypher-interp')).length;
      const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
      return {
        'e-ci-census-all': String(all), 'e-ci-census-frozen': String(r.frozen), 'e-ci-census-hex': String(r.hex), 'e-ci-census-mw': String(r.mw),
        'e-ci-census-ddd': String(r.ddd), 'e-ci-census-apg2': String(r.apg2), 'e-ci-census-univ': String(r.univ), 'e-ci-census-judge': String(r.judge),
        'e-ci-census-verify': String(verify), 'e-ci-baselines': String(baselines), 'e-ci-gen-size': mb, 'e-ci-gen-size-s8': mb,
        'e-ci-mirror-lines': `${lines} lines`, 'e-ci-cli-pw': words[cli] ?? String(cli), 'e-ci-apg2-per-project': String(r.apg2t), 'e-ci-mir-templates-s6': String(r.apg2t),
      };
    },
  },
  {
    id: 'e-ci-parity',
    title: 'differential parity vs Neo4j 5.26.24 (section 4): re-derived from the committed parity outputs',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out <dir> (needs live Neo4j); here: sums over results/v1.3-cypher-interp/parity/{parity-by-template,parity-nonequal}.json',
    numbers: [
      n('e-ci-par-summary', 16, 'parity summary (statements, projects, content/error/unsupported)', '65,254 statements, 79 projects: 0 content, 0 error, 0 unsupported'),
      n('e-ci-par-order', 16, 'statements classed order', '763'),
      n('e-ci-par-result', 173, 'parity result line', '65,254 statements: equal 64,491, order 763, content 0, error 0, unsupported 0, both-error 0'),
      n('e-ci-par-order-s4', 245, 'order statements (explanation)', '763'),
      n('e-ci-par-order-t1', 246, 'order statements from the ingestion verification n.type, count(*) (T1)', '252'),
      n('e-ci-par-order-t2', 247, 'order statements from averageInstability in both universal-metric sets (T2)', '511'),
      n('e-ci-par-projects', 157, 'projects in the parity run', '79'),
      n('e-ci-par-judge', 341, 'judge-graph:* statements equal', '1,516'),
      n('e-ci-par-earlier', 174, 'order count of an earlier full run', '816', { needs: 'not-checkable', note: 'the earlier run is not committed' }),
      ...parityCells,
    ],
    async run(ctx) {
      const by = ctx.json(`${CI}/parity/parity-by-template.json`);
      const ne = ctx.json(`${CI}/parity/parity-nonequal.json`);
      const timings = by.timings.filter((t) => !t.phase.startsWith('apg2-templates'));
      const total = timings.reduce((s, t) => s + t.statements, 0);
      const projects = new Set(by.timings.map((t) => t.project)).size;
      const k = (c) => ne.filter((e) => e.klass === c).length;
      const order = k('order');
      const res = {
        'e-ci-par-summary': `${comma(total)} statements, ${projects} projects: ${k('content')} content, ${k('error')} error, ${k('unsupported')} unsupported`,
        'e-ci-par-order': String(order),
        'e-ci-par-result': `${comma(total)} statements: equal ${comma(total - ne.length)}, order ${order}, content ${k('content')}, error ${k('error')}, unsupported ${k('unsupported')}, both-error ${k('both-error')}`,
        'e-ci-par-order-s4': String(order),
        'e-ci-par-order-t1': String(ne.filter((e) => e.klass === 'order' && e.label === 'ingest-verify').length),
        'e-ci-par-order-t2': String(ne.filter((e) => e.klass === 'order' && /averageInstability/.test(e.label)).length),
        'e-ci-par-projects': String(projects),
        'e-ci-par-judge': comma(by.rows.filter((r) => r.template.startsWith('judge-graph:')).reduce((s, r) => s + r.equal, 0)),
      };
      for (const r of by.rows) {
        for (const c of PARITY_COLS) res[`e-ci-par-${slug(r.template)}-${c === 'rowsNeo4j' ? 'rows' : c}`] = String(r[c]);
      }
      return res;
    },
  },
  {
    id: 'e-ci-timing',
    title: 'performance figures (section 6) re-derived from the committed timing records (timings are machine-dependent)',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'results/v1.3-cypher-interp/{bench.md, ue-baseline-live/run-provenance.json, parity/parity-by-template.json timings, mirrors/mirrors.json}; regenerating them needs Neo4j for the Neo4j column and gives machine-dependent times',
    numbers: [
      n('e-ci-tm-warm', 19, 'warm in-process evaluation, one variant (summary)', '149 ms (interp) vs 728 ms (Neo4j)'),
      n('e-ci-tm-stages', 19, 'graph stages (summary)', '≈20 ms vs ≈600 ms'),
      n('e-ci-tm-cli-neo4j', 285, 'reference-set CLI run, Neo4j', '3m26.8s (median 2,710 ms per variant)'),
      n('e-ci-tm-cli-interp', 285, 'reference-set CLI run, cypher-interp', '2m49.9s (median about 2,330 ms)'),
      n('e-ci-tm-clean-neo4j', 286, 'warm evaluation clean-architecture/clean, Neo4j', '728 ms'),
      n('e-ci-tm-clean-interp', 286, 'warm evaluation clean-architecture/clean, interp', '149 ms'),
      n('e-ci-tm-ddd-neo4j', 287, 'warm evaluation ddd/clean, Neo4j', '866 ms'),
      n('e-ci-tm-ddd-interp', 287, 'warm evaluation ddd/clean, interp', '321 ms'),
      n('e-ci-tm-stages-neo4j', 288, 'graph stages, Neo4j', '≈ 600 ms'),
      n('e-ci-tm-stages-interp', 288, 'graph stages, interp', '≈ 20 ms'),
      n('e-ci-tm-arm-n', 289, 'projects in the arm v1.3 median', '71'),
      n('e-ci-tm-arm-neo4j', 289, 'arm v1.3 graph statements per project, median, Neo4j', '505 ms'),
      n('e-ci-tm-arm-interp', 289, 'arm v1.3 graph statements per project, median, interp', '14 ms'),
      n('e-ci-tm-apg2-projects', 290, 'APG v2 template timing, projects', '78'),
      n('e-ci-tm-apg2-neo4j', 290, 'APG v2 templates total, Neo4j', '1,747 ms'),
      n('e-ci-tm-apg2-interp', 290, 'APG v2 templates total, interp', '103 ms'),
      n('e-ci-tm-apg2-mirror', 290, 'APG v2 templates total, hand mirrors', '43 ms'),
      n('e-ci-tm-mir-interp', 291, 'cypher-interp-mirrors.ts, interp', '833 ms'),
      n('e-ci-tm-mir-mirror', 291, 'cypher-interp-mirrors.ts, mirrors', '67 ms'),
      n('e-ci-tm-ph-v13', 293, 'phase total arm v1.3', '3,159: 36.4 s / 1.3 s'),
      n('e-ci-tm-ph-v12e', 294, 'phase total arm v1.2e', '3,159: 35.6 s / 1.0 s'),
      n('e-ci-tm-ph-sw13', 294, 'phase total sweep on the v1.3 graphs', '31,950: 44.6 s / 12.9 s'),
      n('e-ci-tm-ph-swapg', 294, 'phase total sweep on the APG v2 graphs', '26,513: 81.4 s / 9.4 s'),
      n('e-ci-tm-ingest', 298, 'ingest-apg stage, Neo4j vs interp', '≈ 510 ms on Neo4j, ≈ 6 ms'),
      n('e-ci-tm-ratio-lo', 300, 'hand mirrors faster than the interpreter, per template run', '2.4x'),
      n('e-ci-tm-ratio-hi', 301, 'hand mirrors faster than the interpreter, with ingestion', '12x'),
      n('e-ci-tm-perproj', 312, 'per project, mirrors vs interpreter', '≈ 1 ms vs ≈ 11 ms'),
      n('e-ci-tm-mcp', 339, 'warm evaluation range in a long-lived server', '≈ 150-320 ms'),
      n('e-ci-tm-tsmorph', 300, 'tsx start-up and ts-morph extraction per variant', '≈ 2.2 s', { needs: 'not-checkable', note: 'no committed record splits the per-variant CLI time' }),
      n('e-ci-tm-warmup', 302, 'ANTLR prediction warm-up of the first query', '≈ 300-600 ms', { needs: 'not-checkable', note: 'not in a committed record; machine-dependent' }),
      n('e-ci-tm-lint', 69, 'lintCypherQuery time per query', '200-400 ms', { needs: 'not-checkable', note: 'an ad-hoc measurement of an external package; not committed' }),
      n('e-ci-t2-a', 260, 'T2: Neo4j avg after one ingestion', '0.4556650246305418', { needs: 'needs-Neo4j', note: 'Neo4j answer, history-dependent' }),
      n('e-ci-t2-b', 260, 'T2: Neo4j avg after another ingestion', '0.45566502463054187', { needs: 'needs-Neo4j', note: 'Neo4j answer, history-dependent' }),
      n('e-ci-t3-inc', 261, 'T3: random float lists matching the incremental mean bit for bit', '200/200', { needs: 'needs-Neo4j', note: 'live Neo4j probe, not committed' }),
      n('e-ci-t3-sum', 261, 'T3: random float lists matching sum/count', '93/200', { needs: 'needs-Neo4j', note: 'live Neo4j probe, not committed' }),
      n('e-ci-prs', 25, 'open PRs searched for the I2 branch', '16', { needs: 'needs-external', note: 'GitHub state on 2026-10-15' }),
      n('e-ci-branches', 25, 'remote branches searched', '105', { needs: 'needs-external', note: 'GitHub state on 2026-10-15' }),
    ],
    async run(ctx) {
      const bench = Object.fromEntries(ctx.read(`${CI}/bench.md`).split('\n').filter((l) => /^\| (clean-architecture|ddd)\/clean/.test(l))
        .map((l) => l.split('|').map((x) => x.trim())).map((c) => [`${c[1]}|${c[2]}`, { warm: parseInt(c[4], 10), stages: [6, 7, 8].reduce((s, i) => s + Number(c[i]), 0), ingest: Number(c[6]) }]));
      const b = (v, e) => bench[`${v}|${e}`];
      const round10 = (x) => Math.round(x / 10) * 10;
      const prov = ctx.json(`${CI}/ue-baseline-live/run-provenance.json`).wall;
      const cli = (s) => { const m = /^(\S+) \((?:run2; )?CLI per variant: median (about )?(\d+) ms\)$/.exec(s); return m; };
      const cn = cli(prov.neo4j); const cc = cli(prov['cypher-interp']);
      const t = ctx.json(`${CI}/parity/parity-by-template.json`).timings;
      const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
      const arm = t.filter((x) => x.phase === 'arm:v1.3');
      const ap = t.filter((x) => x.phase.startsWith('apg2-templates'));
      const sum = (a, k) => a.reduce((s, x) => s + (x[k] ?? 0), 0);
      const ph = (pred) => { const a = t.filter((x) => pred(x.phase)); return `${comma(sum(a, 'statements'))}: ${(sum(a, 'neo4jMs') / 1000).toFixed(1)} s / ${(sum(a, 'interpMs') / 1000).toFixed(1)} s`; };
      const mir = ctx.json(`${CI}/mirrors/mirrors.json`).timing;
      const projects = ctx.json(`${CI}/mirrors/mirrors.json`).byTemplate[0].projects;
      const apInterp = sum(ap, 'interpMs'); const apMirror = sum(ap, 'mirrorMs');
      return {
        'e-ci-tm-warm': `${b('clean-architecture/clean', 'cypher-interp').warm} ms (interp) vs ${b('clean-architecture/clean', 'neo4j').warm} ms (Neo4j)`,
        'e-ci-tm-stages': `≈${round10(b('clean-architecture/clean', 'cypher-interp').stages)} ms vs ≈${round10(b('clean-architecture/clean', 'neo4j').stages)} ms`,
        'e-ci-tm-cli-neo4j': `${cn[1]} (median ${comma(Number(cn[3]))} ms per variant)`,
        'e-ci-tm-cli-interp': `${cc[1]} (median ${cc[2] ?? ''}${comma(Number(cc[3]))} ms)`,
        'e-ci-tm-clean-neo4j': `${b('clean-architecture/clean', 'neo4j').warm} ms`,
        'e-ci-tm-clean-interp': `${b('clean-architecture/clean', 'cypher-interp').warm} ms`,
        'e-ci-tm-ddd-neo4j': `${b('ddd/clean', 'neo4j').warm} ms`,
        'e-ci-tm-ddd-interp': `${b('ddd/clean', 'cypher-interp').warm} ms`,
        'e-ci-tm-stages-neo4j': `≈ ${round10(b('clean-architecture/clean', 'neo4j').stages)} ms`,
        'e-ci-tm-stages-interp': `≈ ${round10(b('clean-architecture/clean', 'cypher-interp').stages)} ms`,
        'e-ci-tm-arm-n': String(arm.length),
        'e-ci-tm-arm-neo4j': `${Math.round(med(arm.map((x) => x.neo4jMs)))} ms`,
        'e-ci-tm-arm-interp': `${Math.round(med(arm.map((x) => x.interpMs)))} ms`,
        'e-ci-tm-apg2-projects': String(ap.length),
        'e-ci-tm-apg2-neo4j': `${comma(Math.round(sum(ap, 'neo4jMs')))} ms`,
        'e-ci-tm-apg2-interp': `${Math.round(apInterp)} ms`,
        'e-ci-tm-apg2-mirror': `${Math.round(apMirror)} ms`,
        'e-ci-tm-mir-interp': `${Math.round(mir.interpMs)} ms`,
        'e-ci-tm-mir-mirror': `${Math.round(mir.mirrorMs)} ms`,
        'e-ci-tm-ph-v13': ph((p) => p === 'arm:v1.3'),
        'e-ci-tm-ph-v12e': ph((p) => p === 'arm:v1.2e'),
        'e-ci-tm-ph-sw13': ph((p) => p.startsWith('sweep:v1.3-graph')),
        'e-ci-tm-ph-swapg': ph((p) => p.startsWith('sweep:apg2-graph')),
        'e-ci-tm-ingest': `≈ ${round10(b('clean-architecture/clean', 'neo4j').ingest)} ms on Neo4j, ≈ ${b('clean-architecture/clean', 'cypher-interp').ingest} ms`,
        'e-ci-tm-ratio-lo': `${(apInterp / apMirror).toFixed(1)}x`,
        'e-ci-tm-ratio-hi': `${Math.floor(mir.interpMs / mir.mirrorMs)}x`,
        'e-ci-tm-perproj': `≈ ${Math.round(mir.mirrorMs / projects)} ms vs ≈ ${Math.round(mir.interpMs / projects)} ms`,
        'e-ci-tm-mcp': `≈ ${round10(b('clean-architecture/clean', 'cypher-interp').warm)}-${round10(b('ddd/clean', 'cypher-interp').warm)} ms`,
      };
    },
  },
];
