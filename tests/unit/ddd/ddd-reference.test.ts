/**
 * DDD reference project (v1.3, FR-V3/FR-V4): the clean variant compiles; the extracted graph agrees with the
 * hand-written expected-graph.json; every variant's findings agree with its hand-written expected-findings.json.
 *
 * The manifests are written from the rule definitions (Docs/v1.3-ddd-notes.md §1) and are never edited to match the
 * tool. A known difference is listed in KNOWN_MISMATCHES with its classification and asserted as it stands, so the
 * suite records it instead of hiding it; fixing the tool turns that assertion red and the entry must be removed.
 * Findings are computed by the TypeScript mirror of the queries (no Neo4j in unit runs; see ddd-neo4j.test.ts).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Manifest } from './reference-project.js';
import {
  analyse, cleanupScratch, must, extractAnnotated, manifestKeys, materialise, parsedPreset, readVariant, REFERENCE, ROOT,
  rowKeys, tmpdir, variantIds,
} from './reference-project.js';

jest.setTimeout(120_000);

/** Variant -> what the tool reports instead of the manifest, and why (notes §6). */
const KNOWN_MISMATCHES: Readonly<Record<string, { readonly got: readonly string[]; readonly classification: string }>> = {
  'g01-value-object-setter-accessor': {
    got: [],
    classification: 'tool gap (extractor): no accessor, field-modifier or visibility facts; FF-DT03 sees setter-named methods only',
  },
  'g03-deep-import-of-reexported-file': {
    got: [],
    classification: 'tool gap (extractor + rule fix): barrel routing erases the barrel hop, so FF-DS02 treats files a public barrel re-exports as published; a deep import of one is missed',
  },
};

/** Expected-graph key edges the extractor does not produce, and why (notes §6). */
const KNOWN_EDGE_MISMATCHES: Readonly<Record<string, { readonly got: string; readonly classification: string }>> = {
  'IMPORTS src/billing/acl/OrderingAcl.ts -> src/ordering/index.ts': {
    got: 'IMPORTS src/billing/acl/OrderingAcl.ts -> src/ordering/contracts/OrderSummary.ts',
    classification: 'extractor semantics (by design, per-name barrel routing): the import lands on the declaring file, not on the barrel',
  },
};

const parent = tmpdir();
afterAll(() => { cleanupScratch(parent); });

interface ExpectedGraph {
  readonly files: Readonly<Record<string, { readonly layer: string | null; readonly context: string | null }>>;
  readonly keyEdges: readonly { readonly from: string; readonly to: string; readonly kind?: string }[];
}

const expectedGraph = JSON.parse(fs.readFileSync(path.join(REFERENCE, 'expected-graph.json'), 'utf8')) as ExpectedGraph;

describe('clean variant', () => {
  it('has 20 to 40 source files and compiles with tsc', () => {
    const files = Object.keys(expectedGraph.files);
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(files.length).toBeLessThanOrEqual(40);
    const tsc = path.join(ROOT, 'node_modules/.bin/tsc');
    expect(() => execFileSync(tsc, ['-p', path.join(REFERENCE, 'clean/tsconfig.json')], { stdio: 'pipe' })).not.toThrow();
  });

  it('the extracted file set, layer map and context map equal expected-graph.json', async () => {
    const apg = await extractAnnotated(path.join(REFERENCE, 'clean'));
    const spec = await parsedPreset();
    const roots = must(spec.layerModel.ddd, 'ddd').contexts;
    const context = (f: string): string | null => roots.find((c) => f.startsWith(c.root))?.name ?? null;
    const got = Object.fromEntries(apg.nodes.filter((n) => n.type === 'File').map((n) => [n.filePath, { layer: n.layer ?? null, context: context(n.filePath) }]));
    const expected = Object.fromEntries(Object.entries(expectedGraph.files).map(([f, v]) => [f, { layer: v.layer, context: v.context }]));
    expect(got).toEqual(expected);
  });

  it('every key edge of expected-graph.json is extracted', async () => {
    const apg = await extractAnnotated(path.join(REFERENCE, 'clean'));
    const byId = new Map(apg.nodes.map((n) => [n.id, n]));
    const edges = new Set(apg.edges
      .filter((e) => e.type === 'IMPORTS' || e.type === 'RE_EXPORTS')
      .map((e) => `${e.type} ${byId.get(e.sourceId)?.filePath ?? ''} -> ${byId.get(e.targetId)?.filePath ?? ''}`));
    const missing = expectedGraph.keyEdges
      .map((k) => `${k.kind ?? 'IMPORTS'} ${k.from} -> ${k.to}`)
      .filter((k) => !edges.has(k));
    // Recorded differences: the expected edge is still absent and the extractor's edge is there instead.
    expect(missing.sort()).toEqual(Object.keys(KNOWN_EDGE_MISMATCHES).sort());
    for (const k of Object.values(KNOWN_EDGE_MISMATCHES)) expect(edges.has(k.got)).toBe(true);
  });
});

describe('findings against the manifests', () => {
  const ids = ['clean', ...variantIds()];

  it('there are at least eight single-violation variants, each for a different rule', () => {
    const rules = variantIds().map((id) => readVariant(id)).filter((v) => /^v\d\d-/.test(v.meta.id)).map((v) => v.meta.rule);
    expect(rules.length).toBeGreaterThanOrEqual(8);
    expect(new Set(rules).size).toBe(rules.length);
    for (const id of variantIds().filter((x) => /^v\d\d-/.test(x))) expect(readVariant(id).manifest.findings).toHaveLength(1);
  });

  it.each(ids)('%s', async (id) => {
    const dir = id === 'clean' ? path.join(REFERENCE, 'clean') : materialise(id, parent);
    const { rows } = await analyse(dir);
    const got = rowKeys(rows);
    const expected = id === 'clean' ? manifestKeys(JSON.parse(fs.readFileSync(path.join(REFERENCE, 'clean/expected-findings.json'), 'utf8')) as Manifest) : manifestKeys(readVariant(id).manifest);
    const known = KNOWN_MISMATCHES[id];
    if (known === undefined) {
      expect(got).toEqual(expected);
    } else {
      // Recorded difference: the tool's output as it stands, and it still differs from the manifest.
      expect(got).toEqual([...known.got].sort());
      expect(got).not.toEqual(expected);
    }
  });
});
