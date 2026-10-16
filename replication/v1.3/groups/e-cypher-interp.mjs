// Cypher interpreter spike (Docs/v1.3/cypher-interpreter.md): the no-Neo4j reference run, the mirror comparison, the
// unit tests and interpreter semantics regenerated offline; the Neo4j parity table and the timings re-derived from the
// committed outputs in results/v1.3-cypher-interp/ (the Neo4j side of the parity run is not committed as raw rows).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readAt, treeAt } from '../lib/at-commit.mjs';

const DOC = 'Docs/v1.3/cypher-interpreter.md';
const REF = 'results/v1.3-reference/after-member-facts';
const CI = 'results/v1.3-cypher-interp';
// Re-registered 2026-10-16 (post-merge verification of MT7) against the doc as #151 left it (last commit 3ff49656).
const DOC_COMMIT = '3ff49656';
const TIMING_COMMIT = '2bcc50e7';
const UNIT_COMMIT = 'ccb14f2f';
const n = (id, line, what, stated, extra = {}) => ({ id, doc: DOC, line, what, stated, ...extra });
const comma = (x) => x.toLocaleString('en-US');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** Run a small module with tsx from the repository root (imports read the repository, write nothing into it). */
function tsx(ctx, name, code) {
  const f = join(ctx.out(name), `${name}.mjs`);
  writeFileSync(f, code);
  return JSON.parse(ctx.sh(`node --import tsx ${f}`).trim().split('\n').pop());
}

// ── §4 parity table as the doc writes it (lines 305-375), one number per cell ─────────────────────────────────────
// Re-registered 2026-10-16 (post-merge verification of MT7) against the table #151 rewrote: 81 projects and the
// float-drift, non-empty, per-binding and thin columns.
const PARITY_COLS = ['statements', 'projects', 'equal', 'order', 'float-drift', 'content', 'error', 'unsupported', 'both-error', 'rowsNeo4j',
  'nonempty', 'nonempty-pslh', 'synthetic-slh', 'thin'];
const PARITY_DOC = [
  "abstraction-ratio | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 494 | 494 | 28 / 304 / 0 / 162 | 6 / 0 / 6 | ",
  "agent-reimplementation | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
  "aggregate-boundary | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 434 | 326 | 2 / 128 / 128 / 68 | 8 / 8 / 8 | ",
  "application-service-thin | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 2076 | 548 | 2 / 190 / 298 / 58 | 4 / 4 / 0 | ",
  "boundary-type-leak | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 156 | 48 | 0 / 10 / 32 / 6 | 4 / 4 / 4 | thin",
  "bounded-context-modules | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 176 | 158 | 2 / 62 / 62 / 32 | 0 / 0 / 0 | ",
  "component-adp-cycle | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 78 | 24 | 0 / 8 / 8 / 8 | 4 / 4 / 4 | thin",
  "component-instability | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 17132 | 1055 | 103 / 360 / 592 / 0 | 12 / 12 / 0 | ",
  "component-main-sequence-distance | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 130 | 50 | 0 / 4 / 42 / 4 | 4 / 4 / 4 | ",
  "component-sdp-violation | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 118 | 82 | 0 / 38 / 38 / 6 | 4 / 4 / 4 | ",
  "context-isolation | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 35316 | 1252 | 4 / 492 / 492 / 264 | 12 / 12 / 12 | ",
  "controller-no-entity | 2366 | 81 | 2366 | 0 | 0 | 0 | 0 | 0 | 0 | 2450 | 698 | 0 / 8 / 684 / 6 | 6 / 0 / 6 | ",
  "core-isolation | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 3154 | 482 | 6 / 188 / 188 / 100 | 12 / 12 / 12 | ",
  "deep-import-declared-api | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 50 | 26 | 0 / 10 / 10 / 6 | 4 / 4 / 4 | thin",
  "deep-import-inferred-api | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin",
  "dependency-direction | 1622 | 81 | 1622 | 0 | 0 | 0 | 0 | 0 | 0 | 454 | 418 | 22 / 156 / 156 / 84 | 12 / 12 / 12 | ",
  "dependency-direction-graph | 1600 | 81 | 1600 | 0 | 0 | 0 | 0 | 0 | 0 | 352 | 316 | 12 / 120 / 120 / 64 | 8 / 8 / 8 | ",
  "dependency-inversion | 826 | 81 | 826 | 0 | 0 | 0 | 0 | 0 | 0 | 582 | 202 | 6 / 76 / 0 / 120 | 0 / 0 / 2 | ",
  "domain-event-placement | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 44 | 26 | 2 / 8 / 10 / 6 | 4 / 6 / 4 | thin",
  "domain-purity | 1682 | 81 | 1682 | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 188 | 16 / 68 / 68 / 36 | 4 / 4 / 4 | ",
  "domain-stability | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 5238 | 598 | 6 / 0 / 592 / 0 | 0 / 12 / 0 | ",
  "domain-state-purity | 856 | 81 | 856 | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 172 | 6 / 66 / 66 / 34 | 2 / 2 / 2 | ",
  "endpoint-bypasses-application | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
  "env-read-outside-config | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
  "framework-exception-in-core | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
  "hidden-coupling | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
  "ingest | 4212 | 81 | 4212 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 | ",
  "ingest-verify | 892 | 81 | 532 | 360 | 0 | 0 | 0 | 0 | 0 | 3750 | 892 | 568 / 324 / 0 / 0 | 12 / 0 / 0 | ",
  "inheritance-depth | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin",
  "interface-segregation-proxy | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 1312 | 244 | 0 / 2 / 240 / 2 | 2 / 2 / 2 | ",
  "io-outside-adapters | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 48 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin",
  "judge-graph:classes | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 7386 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "judge-graph:edges | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 33233 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "judge-graph:files | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 10775 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "judge-graph:interfaces | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 3685 | 370 | 0 / 147 / 147 / 76 | 0 / 0 / 0 | ",
  "layer-skip-graph | 1600 | 81 | 1600 | 0 | 0 | 0 | 0 | 0 | 0 | 8424 | 746 | 6 / 292 / 292 / 156 | 12 / 12 / 12 | ",
  "max-fan-in | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 29506 | 1418 | 0 / 504 / 608 / 306 | 12 / 12 / 10 | ",
  "module-domain-imports-infrastructure | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin",
  "module-fan-out | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 25632 | 1458 | 44 / 504 / 608 / 302 | 12 / 12 / 8 | ",
  "naming-controllers | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 16 | 0 / 6 / 4 / 6 | 6 / 4 / 6 | thin",
  "naming-conventions | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 5626 | 490 | 0 / 126 / 296 / 68 | 6 / 6 / 6 | ",
  "naming-repos | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 1522 | 518 | 4 / 176 / 250 / 88 | 0 / 6 / 0 | ",
  "naming-services | 856 | 81 | 856 | 0 | 0 | 0 | 0 | 0 | 0 | 584 | 182 | 0 / 0 / 182 / 0 | 0 / 6 / 0 | ",
  "no-cyclic-deps | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 226 | 178 | 10 / 64 / 64 / 40 | 12 / 12 / 12 | ",
  "no-domain-outward-dep | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 3158 | 486 | 10 / 188 / 188 / 100 | 12 / 12 / 12 | ",
  "no-index-logic | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin",
  "no-layer-skip | 1566 | 81 | 1566 | 0 | 0 | 0 | 0 | 0 | 0 | 19678 | 1330 | 10 / 524 / 524 / 272 | 12 / 12 / 12 | ",
  "no-orphan-files | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 210 | 48 | 0 / 16 / 16 / 16 | 12 / 12 / 12 | thin",
  "nondeterminism-in-core | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 308 | 174 | 0 / 86 / 86 / 2 | 0 / 0 / 0 | ",
  "port-adapter-pattern | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 1382 | 606 | 4 / 152 / 368 / 82 | 8 / 12 / 8 | ",
  "port-dependency-inversion | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 198 | 2 / 76 / 0 / 120 | 0 / 0 / 2 | ",
  "repository-aggregate-root | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 106 | 58 | 2 / 20 / 20 / 16 | 12 / 12 / 12 | ",
  "repository-pattern | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 90 | 90 | 4 / 32 / 32 / 22 | 8 / 8 / 8 | ",
  "single-responsibility-proxy | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 5000 | 398 | 0 / 64 / 300 / 34 | 0 / 6 / 0 | ",
  "test-file-pairing | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 23368 | 858 | 112 / 296 / 296 / 154 | 6 / 6 / 6 | ",
  "undeclared-async-coupling | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 66 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin",
  "universal-literal:averageInstability | 456 | 81 | 351 | 0 | 105 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal-literal:cyclicDependencyCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal-literal:maxFanIn | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal-literal:maxFanOut | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal-literal:orphanFileCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal:abstractionRatio | 912 | 81 | 912 | 0 | 0 | 0 | 0 | 0 | 0 | 912 | 912 | 142 / 304 / 304 / 162 | 6 / 6 / 6 | ",
  "universal:averageInstability | 456 | 81 | 355 | 0 | 101 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal:cyclicDependencyCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal:maxFanIn | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal:maxFanOut | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "universal:orphanFileCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 | ",
  "untested-component | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
  "use-case-isolation | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 76 | 76 | 4 / 28 / 28 / 16 | 4 / 4 / 4 | ",
  "value-object-immutability | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 2224 | 306 | 4 / 6 / 292 / 4 | 2 / 6 / 2 | ",
  "vendor-sdk-outside-adapters | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin",
];
const slug = (t) => t.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
const parityCells = PARITY_DOC.flatMap((row, i) => {
  const [tpl, ...cells] = row.split(' | ');
  return cells.map((v, j) => n(`e-ci-par-${slug(tpl)}-${PARITY_COLS[j] === 'rowsNeo4j' ? 'rows' : PARITY_COLS[j]}`, 305 + i,
    `parity table: ${tpl}, ${PARITY_COLS[j] === 'rowsNeo4j' ? 'Neo4j rows' : PARITY_COLS[j]}`, v));
});

export default [
  {
    id: 'e-ci-ubl',
    title: 'ue-baseline-live --engine cypher-interp (no Neo4j) vs the committed after-member-facts reference',
    needs: 'offline', basis: 'regenerated', slow: true,
    how: 'node --import tsx scripts/v1.3/ue-baseline-live.ts --engine cypher-interp --out <scratch>  (NEO4J_* unset; in a HEAD export)',
    numbers: [
      n('e-ci-ubl-variants', 18, 'reference variants run with --engine cypher-interp', '71'),
      n('e-ci-ubl-raw', 18, 'raw/ files byte-identical to after-member-facts', '71'),
      n('e-ci-ubl-evidence', 18, 'evidence violations identical (elapsedMs ignored)', '71/71'),
      n('e-ci-ubl-raw-s4', 435, 'raw/ + report.json + report.md byte-identical to after-member-facts (section 4.3)', '73/73'),
      n('e-ci-ubl-variants-s6', 491, 'reference-set CLI run, variants', '71'),
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
        'e-ci-ubl-raw-s4': `${same + ['report.json', 'report.md'].filter((f) => readFileSync(join(out, f)).equals(readFileSync(ctx.p(`${REF}/${f}`)))).length}/${raws.length + 2}`, 'e-ci-ubl-variants-s6': String(regen),
      };
    },
  },
  {
    id: 'e-ci-mirrors',
    title: 'APG v2 hand mirrors vs the interpreter on the same graphs (no Neo4j)',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'node --import tsx scripts/v1.3/cypher-interp-mirrors.ts --out <scratch>',
    numbers: [
      n('e-ci-mir-grid', 25, 'templates x projects with rows and row order identical', '9 templates × 78 projects'),
      n('e-ci-mir-grid-s7', 515, 'templates x projects with rows and order identical (recommendation)', '9 templates × 78 projects'),
      n('e-ci-mir-projects-s6', 497, 'cypher-interp-mirrors.ts projects', '78'),
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
    how: 'npx jest --maxWorkers=2 --runTestsByPath tests/unit/cypher-interp/{interpreter,unsupported-and-timeout,template-order}.test.ts (in an export of ccb14f2f)',
    numbers: [n('e-ci-unit-tests', 27, 'tests in the three tests/unit/cypher-interp suites the doc names (§9), at ccb14f2f where the figure was written (242 at the later re-run commits f6d5ea5a and 3ff49656, which left the line unchanged; #183 added two more suites)', '240')],
    async run(ctx) {
      let txt;
      try { txt = ctx.sh('npx jest --maxWorkers=2 --runTestsByPath tests/unit/cypher-interp/interpreter.test.ts tests/unit/cypher-interp/unsupported-and-timeout.test.ts tests/unit/cypher-interp/template-order.test.ts 2>&1', { cwd: treeAt(ctx, UNIT_COMMIT) }); } catch (e) { txt = String(e.stdout ?? '') + String(e.stderr ?? ''); }
      const m = /Tests:\s+(?:(\d+) failed, )?(\d+) passed, (\d+) total/.exec(txt);
      return { 'e-ci-unit-tests': m ? (m[1] ? `${m[2]}/${m[3]} (${m[1]} failed)` : m[3]) : 'no jest summary' };
    },
  },
  {
    id: 'e-ci-traps',
    title: 'interpreter answers for the semantic traps of section 5 (interpreter column; the Neo4j column needs Neo4j)',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'MemoryGraphRepository.executeQuery on the T5, T6, T7, T13, T14, T16 example queries (node --import tsx)',
    numbers: [
      n('e-ci-t5', 468, 'T5: UNWIND [1.0, 1, 2] AS x RETURN x, count(*)', '1.0, 2 then 2, 1'),
      n('e-ci-t6', 469, 'T6: apoc.coll.indexOf([1, 2], 2.0)', '1'),
      n('e-ci-t7', 470, 'T7: apoc.coll.indexOf(null, x)', '-1'),
      n('e-ci-t13', 476, "T13: size('😀')", '1'),
      n('e-ci-t14', 477, "T14: toString(1.0), 'x' + 1.0, toString(1e20)", '1.0, x1.0, 1.0E20'),
      n('e-ci-t16', 479, 'T16: 7 / 2, -7 / 2, -7 % 2, 2 ^ 2', '3, -3, -1, 4.0'),
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
      n('e-ci-census-all', 190, 'catalogue templates in the census', '47'),
      n('e-ci-census-frozen', 190, 'frozen CYPHER_TEMPLATES', '25'),
      n('e-ci-census-hex', 190, 'hexagonal templates', '5'),
      n('e-ci-census-mw', 191, 'module-wiring templates', '1'),
      n('e-ci-census-ddd', 191, 'DDD templates', '7'),
      n('e-ci-census-apg2', 191, 'APG v2 templates', '9'),
      n('e-ci-census-univ', 192, 'distinct universal-metric texts', '11'),
      n('e-ci-census-judge', 192, 'judge graph-view queries', '4'),
      n('e-ci-census-verify', 192, 'ingestion verification counts (verifyIngestion queries)', '4'),
      n('e-ci-baselines', 94, 'ablation baselines from v13-in-memory-baselines.ts (imported by scripts/apg2-ablation.ts)', '3'),
      n('e-ci-gen-size', 121, 'generated parser size (Cypher25Lexer.ts + Cypher25Parser.ts)', '2 MB'),
      n('e-ci-gen-size-s8', 550, 'generated parser size (packaging)', '2 MB'),
      n('e-ci-mirror-lines', 515, 'apg2-in-memory.ts line count', '271 lines'),
      n('e-ci-cli-pw', 542, "unconditional requireEnvForCli('NEO4J_PASSWORD') calls left in src/cli/cli.ts", 'two', { known: { actual: 'one', note: 'doc erratum (post-merge verification 2026-10-16): true when written (ccb14f2f: two); already one at the doc commit 3ff49656, which merged v1.3 9768def4' } }),
      n('e-ci-apg2-per-project', 496, 'APG v2 templates per project', '9'),
      n('e-ci-mir-templates-s6', 497, 'templates in the mirror comparison', '9'),
      n('e-ci-apg2-mirrors', 93, 'APG v2 templates with a hand mirror (APG2_IN_MEMORY)', '9'),
      n('e-ci-apoc', 160, 'APOC functions built in (functions.ts)', 'three'),
      n('e-ci-index', 172, 'CREATE INDEX statements of the ingestion', 'two'),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-ci-code', `
const R = process.cwd();
const { CYPHER_TEMPLATES } = await import(R + '/src/fitness-compiler/cypher-templates.ts');
const { V13_EXTENSION_TEMPLATE_CATALOGUES: C } = await import(R + '/src/fitness-compiler/extension-templates.ts');
const { UNIVERSAL_METRIC_QUERIES: U, UNIVERSAL_METRIC_QUERIES_LITERAL: L } = await import(R + '/src/scoring-engine/universal-metrics.ts');
const { JUDGE_GRAPH_QUERIES } = await import(R + '/src/llm-critic/judge-graph.ts');
const { APG2_TEMPLATES } = await import(R + '/src/fitness-compiler/apg2-templates.ts');
const { APG2_IN_MEMORY } = await import(R + '/src/fitness-compiler/apg2-in-memory.ts');
const sz = (k) => C.get(k).size;
console.log(JSON.stringify({ frozen: CYPHER_TEMPLATES.size, hex: sz('hexagonal'), mw: sz('module-wiring'), ddd: sz('ddd'), apg2: sz('apg2'),
  univ: new Set([...Object.values(U), ...Object.values(L)]).size, judge: Object.keys(JUDGE_GRAPH_QUERIES).length, apg2t: APG2_TEMPLATES.size ?? Object.keys(APG2_TEMPLATES).length, mirrors: APG2_IN_MEMORY.size }));
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
      const apoc = new Set(ctx.read('src/cypher-interp/functions.ts').match(/'apoc\.[A-Za-z.]+'/g) ?? []).size;
      const idx = (ctx.read('src/neo4j-ingestion/graph-ingester.ts').match(/CREATE INDEX/g) ?? []).length;
      return {
        'e-ci-census-all': String(all), 'e-ci-census-frozen': String(r.frozen), 'e-ci-census-hex': String(r.hex), 'e-ci-census-mw': String(r.mw),
        'e-ci-census-ddd': String(r.ddd), 'e-ci-census-apg2': String(r.apg2), 'e-ci-census-univ': String(r.univ), 'e-ci-census-judge': String(r.judge),
        'e-ci-census-verify': String(verify), 'e-ci-baselines': String(baselines), 'e-ci-gen-size': mb, 'e-ci-gen-size-s8': mb,
        'e-ci-mirror-lines': `${lines} lines`, 'e-ci-cli-pw': words[cli] ?? String(cli), 'e-ci-apg2-per-project': String(r.apg2t), 'e-ci-mir-templates-s6': String(r.apg2t),
        'e-ci-apg2-mirrors': String(r.mirrors), 'e-ci-apoc': words[apoc], 'e-ci-index': words[idx],
      };
    },
  },
  {
    id: 'e-ci-parity',
    title: 'differential parity vs Neo4j 5.26.24 (section 4): re-derived from the committed parity outputs',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out <dir> (needs live Neo4j); here: sums over results/v1.3-cypher-interp/parity/{parity-by-template,parity-nonequal}.json',
    numbers: [
      n('e-ci-par-summary', 20, 'parity summary (statements, projects, content/error/unsupported)', '72,388 statements, 81 projects: 0 content, 0 error, 0 unsupported'),
      n('e-ci-par-order', 20, 'statements classed order', '360'),
      n('e-ci-par-float', 20, 'statements classed float-drift', '206'),
      n('e-ci-par-result', 291, 'parity result line', '72,388 statements: equal 71,822, order 360, float-drift 206, content 0, error 0, unsupported 0, both-error 0'),
      n('e-ci-par-order-s4', 378, 'order statements (explanation)', '360'),
      n('e-ci-par-order-t1', 378, 'order statements from the ingestion verification counts (T1)', '360'),
      n('e-ci-par-order-t2', 379, 'float-drift statements from averageInstability in both universal-metric sets (T2)', '206'),
      n('e-ci-par-projects', 261, 'projects in the parity run', '81'),
      n('e-ci-par-proj-ref', 261, 'reference variants among the parity projects', '71'),
      n('e-ci-par-proj-fix', 262, 'APG v2 fixture projects among the parity projects', '7'),
      n('e-ci-par-proj-syn', 263, 'synthetic APG projects among the parity projects', 'three'),
      n('e-ci-par-earlier-zero', 294, 'an earlier run of the fix: 315 order + 283 float-drift + 4 content', '315 `order` + 283 `float-drift` + 4', { needs: 'not-checkable', note: 'earlier runs are not committed; the committed run is e-ci-par-result' }),
      n('e-ci-par-wall', 258, 'parity run wall time', '4.5 min', { needs: 'not-checkable', note: 'machine-dependent and needs Neo4j; the committed timings sum the statements only' }),
      n('e-ci-par-judge', 547, 'judge-graph:* statements equal', '1,516', { known: { actual: '1,540', note: 'doc erratum (post-merge verification 2026-10-16): #151 re-ran parity on 81 projects; its own table (judge-graph:* rows, 4 x 385) gives 1,540; this §8 line keeps the spike figure (4 x 379)' } }),
      n('e-ci-par-earlier', 293, "order count of the spike's run", '763', { needs: 'not-checkable', note: "the spike's parity outputs are not committed" }),
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
        'e-ci-par-float': String(k('float-drift')),
        'e-ci-par-result': `${comma(total)} statements: equal ${comma(total - ne.length)}, order ${order}, float-drift ${k('float-drift')}, content ${k('content')}, error ${k('error')}, unsupported ${k('unsupported')}, both-error ${k('both-error')}`,
        'e-ci-par-order-s4': String(order),
        'e-ci-par-order-t1': String(ne.filter((e) => e.klass === 'order' && e.label === 'ingest-verify').length),
        'e-ci-par-order-t2': String(ne.filter((e) => e.klass === 'float-drift' && /averageInstability/.test(e.label)).length),
        'e-ci-par-projects': String(projects),
        'e-ci-par-proj-ref': String([...new Set(by.timings.map((t) => t.project))].filter((p) => !/^(apg2-fixture|synthetic)\//.test(p)).length),
        'e-ci-par-proj-fix': String([...new Set(by.timings.map((t) => t.project))].filter((p) => p.startsWith('apg2-fixture/')).length),
        'e-ci-par-proj-syn': ['no', 'one', 'two', 'three', 'four'][[...new Set(by.timings.map((t) => t.project))].filter((p) => p.startsWith('synthetic/')).length],
        'e-ci-par-judge': comma(by.rows.filter((r) => r.template.startsWith('judge-graph:')).reduce((s, r) => s + r.equal, 0)),
      };
      for (const r of by.rows) {
        const nb = r.nonEmptyByBinding; const sy = r.syntheticNonEmptyByBinding;
        const cell = { nonempty: r.nonEmptyBoth, 'nonempty-pslh': `${nb.pipeline} / ${nb.spec} / ${nb.low} / ${nb.high}`,
          'synthetic-slh': `${sy.spec} / ${sy.low} / ${sy.high}`, thin: r.thin ? 'thin' : '' };
        for (const c of PARITY_COLS) res[`e-ci-par-${slug(r.template)}-${c === 'rowsNeo4j' ? 'rows' : c}`] = String(c in cell ? cell[c] : r[c]);
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
      n('e-ci-tm-warm', 29, 'warm in-process evaluation, one variant (summary)', '149 ms (interp) vs 728 ms (Neo4j)'),
      n('e-ci-tm-stages', 29, 'graph stages (summary)', '≈20 ms vs ≈600 ms'),
      n('e-ci-tm-cli-neo4j', 491, 'reference-set CLI run, Neo4j', '3m26.8s (median 2,710 ms per variant)'),
      n('e-ci-tm-cli-interp', 491, 'reference-set CLI run, cypher-interp', '2m49.9s (median about 2,330 ms)'),
      n('e-ci-tm-clean-neo4j', 492, 'warm evaluation clean-architecture/clean, Neo4j', '728 ms'),
      n('e-ci-tm-clean-interp', 492, 'warm evaluation clean-architecture/clean, interp', '149 ms'),
      n('e-ci-tm-ddd-neo4j', 493, 'warm evaluation ddd/clean, Neo4j', '866 ms'),
      n('e-ci-tm-ddd-interp', 493, 'warm evaluation ddd/clean, interp', '321 ms'),
      n('e-ci-tm-stages-neo4j', 494, 'graph stages, Neo4j', '≈ 600 ms'),
      n('e-ci-tm-stages-interp', 494, 'graph stages, interp', '≈ 20 ms'),
      n('e-ci-tm-arm-n', 495, 'projects in the arm v1.3 median', '71'),
      n('e-ci-tm-arm-neo4j', 495, 'arm v1.3 graph statements per project, median, Neo4j', '505 ms'),
      n('e-ci-tm-arm-interp', 495, 'arm v1.3 graph statements per project, median, interp', '14 ms'),
      n('e-ci-tm-apg2-projects', 496, 'APG v2 template timing, projects', '78'),
      n('e-ci-tm-apg2-neo4j', 496, 'APG v2 templates total, Neo4j', '1,747 ms'),
      n('e-ci-tm-apg2-interp', 496, 'APG v2 templates total, interp', '103 ms'),
      n('e-ci-tm-apg2-mirror', 496, 'APG v2 templates total, hand mirrors', '43 ms'),
      n('e-ci-tm-mir-interp', 497, 'cypher-interp-mirrors.ts, interp', '833 ms'),
      n('e-ci-tm-mir-mirror', 497, 'cypher-interp-mirrors.ts, mirrors', '67 ms'),
      n('e-ci-tm-ph-v13', 499, 'phase total arm v1.3', '3,159: 36.4 s / 1.3 s'),
      n('e-ci-tm-ph-v12e', 500, 'phase total arm v1.2e', '3,159: 35.6 s / 1.0 s'),
      n('e-ci-tm-ph-sw13', 500, 'phase total sweep on the v1.3 graphs', '31,950: 44.6 s / 12.9 s'),
      n('e-ci-tm-ph-swapg', 500, 'phase total sweep on the APG v2 graphs', '26,513: 81.4 s / 9.4 s'),
      n('e-ci-tm-ingest', 504, 'ingest-apg stage, Neo4j vs interp', '≈ 510 ms on Neo4j, ≈ 6 ms'),
      n('e-ci-tm-ratio-lo', 506, 'hand mirrors faster than the interpreter, per template run', '2.4x'),
      n('e-ci-tm-ratio-hi', 507, 'hand mirrors faster than the interpreter, with ingestion', '12x'),
      n('e-ci-tm-perproj', 518, 'per project, mirrors vs interpreter', '≈ 1 ms vs ≈ 11 ms'),
      n('e-ci-tm-mcp', 545, 'warm evaluation range in a long-lived server', '≈ 150-320 ms'),
      n('e-ci-tm-tsmorph', 506, 'tsx start-up and ts-morph extraction per variant', '≈ 2.2 s', { needs: 'not-checkable', note: 'no committed record splits the per-variant CLI time' }),
      n('e-ci-tm-warmup', 508, 'ANTLR prediction warm-up of the first query', '≈ 300-600 ms', { needs: 'not-checkable', note: 'not in a committed record; machine-dependent' }),
      n('e-ci-tm-lint', 143, 'lintCypherQuery time per query', '200-400 ms', { needs: 'not-checkable', note: 'an ad-hoc measurement of an external package; not committed' }),
      n('e-ci-t2-a', 465, 'T2: Neo4j avg after one ingestion', '0.4556650246305418', { needs: 'needs-Neo4j', note: 'Neo4j answer, history-dependent' }),
      n('e-ci-t2-b', 465, 'T2: Neo4j avg after another ingestion', '0.45566502463054187', { needs: 'needs-Neo4j', note: 'Neo4j answer, history-dependent' }),
      n('e-ci-t3-inc', 466, 'T3: random float lists matching the incremental mean bit for bit', '200/200', { needs: 'needs-Neo4j', note: 'live Neo4j probe, not committed' }),
      n('e-ci-t3-sum', 466, 'T3: random float lists matching sum/count', '93/200', { needs: 'needs-Neo4j', note: 'live Neo4j probe, not committed' }),
      n('e-ci-prs', 87, 'open PRs searched for the I2 branch', '16', { needs: 'needs-external', note: 'GitHub state on 2026-10-15' }),
      n('e-ci-branches', 87, 'remote branches searched', '105', { needs: 'needs-external', note: 'GitHub state on 2026-10-15' }),
    ],
    async run(ctx0) {
      // §6 states the spike's run (2bcc50e7): #151's re-runs replaced parity-by-template.json and run-provenance.json
      // without changing §6, so the records are read at that commit (bench.md and mirrors.json are unchanged since).
      const ctx = { ...ctx0, read: (rel) => readAt(ctx0, TIMING_COMMIT, rel), json: (rel) => JSON.parse(readAt(ctx0, TIMING_COMMIT, rel)) };
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
