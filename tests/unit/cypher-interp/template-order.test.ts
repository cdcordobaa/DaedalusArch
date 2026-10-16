/**
 * Order guard for the rule catalogue (Docs/v1.3/cypher-interpreter.md §4-5, traps T1 and T8).
 *
 * Downstream code reads violation rows in the order the query returns them: the report formatter's top-10 and the
 * cycle cap (`no-cyclic-deps` `ORDER BY cycle LIMIT 101`) keep the first rows. That order is defined only if every
 * template ends in an ORDER BY whose keys are unique at the row grain; otherwise Neo4j's planner and store order
 * (T1) and its unstable Top-N (T8) decide which rows survive, and the interpreter cannot reproduce them.
 *
 * 1. Statically, for every catalogue template in every text the compiler can emit: the query ends in RETURN, that
 *    RETURN has an ORDER BY, every key is a projected column, and nothing but LIMIT follows it.
 * 2. Dynamically, on the synthetic parity graphs and the APG v2 fixture graphs, under the sweep's three bindings: no
 *    two returned rows share their ORDER BY key, so the keys are unique at the row grain on every row the templates
 *    produce there; and every template produced rows somewhere, so the check is not vacuous. The thin templates of
 *    the parity run return rows in at least 3 statements per binding on the synthetic graphs.
 *
 * Row-grain preconditions the keys rely on (true of every graph the extractor emits; stated, not enforced):
 * - one edge per (source, target, type) between two files (the extractor merges repeated imports into `lines`);
 * - single class inheritance (`inheritance-depth`: one row per class and depth);
 * - for `aggregate-boundary` and `repository-aggregate-root`, the spec's aggregates do not claim the same file in
 *   `innerEntities`: the rows are per aggregate but the ORDER BY is (source, target, relType), so an overlap gives
 *   two rows with one key (pinned by the last test below).
 */
import neo4j from 'neo4j-driver';
import { parseCypher } from '../../../src/cypher-interp/parse.js';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES } from '../../../src/fitness-compiler/extension-templates.js';
import { apg2Params } from '../../../src/fitness-compiler/apg2-in-memory.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { extractAPG, V13_APG2_OPTIONS } from '../../../src/apg-extractor/index.js';
import { ingestAPG } from '../../../src/neo4j-ingestion/index.js';
import type { SnapshotStore } from '../../../src/shared/interfaces/snapshot-store.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import { paramNames, sweepTexts } from '../../../scripts/v1.3/lib/memory-sweep.js';
import { SWEEP_BINDINGS, bindingParams, sweepParams } from '../../../scripts/v1.3/lib/memory-bindings.js';
import { THIN_TEMPLATES, apg2FixtureProjects, syntheticProjects, thinTemplateProject } from '../../../scripts/v1.3/lib/memory-projects.js';

jest.setTimeout(240_000);

const ALL_TEMPLATES: [string, CypherTemplate][] = [
  ...[...CYPHER_TEMPLATES].map(([k, t]): [string, CypherTemplate] => [k, t]),
  ...[...V13_EXTENSION_TEMPLATE_CATALOGUES.values()].flatMap((m) => [...m].map(([k, t]): [string, CypherTemplate] => [k, t])),
];

const TEXTS = ALL_TEMPLATES.flatMap(([name, t]) => sweepTexts(t).map((s) => ({ name, variant: s.variant, text: s.text })));

/** The ORDER BY key columns of a text's final RETURN (asserted to be projected columns by the static test). */
function orderKeys(text: string): string[] {
  const q = parseCypher(text);
  const last = q.clauses[q.clauses.length - 1];
  if (last?.k !== 'return') return [];
  return last.projection.orderBy.map((o) => (o.expr.k === 'var' ? o.expr.name : '?'));
}

describe('catalogue templates: static order guard', () => {
  it('covers every catalogue template', () => {
    expect(new Set(TEXTS.map((t) => t.name)).size).toBe(ALL_TEMPLATES.length);
    expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(47);
  });

  it.each(TEXTS.map((t) => [`${t.name} [${t.variant}]`, t.text] as const))('%s ends in RETURN … ORDER BY over projected columns', (_label, text) => {
    const q = parseCypher(text);
    const last = q.clauses[q.clauses.length - 1];
    expect(last?.k).toBe('return');
    if (last?.k !== 'return') return;
    const p = last.projection;
    expect(p.orderBy.length).toBeGreaterThan(0);
    expect(p.skip).toBeUndefined();
    const aliases = new Set(p.items.map((i) => i.alias));
    for (const o of p.orderBy) {
      expect(o.expr.k).toBe('var');
      if (o.expr.k === 'var') expect(aliases.has(o.expr.name)).toBe(true);
    }
  });
});

interface Graph {
  readonly id: string;
  readonly repo: MemoryGraphRepository;
  readonly params: Record<string, unknown>;
}

const nullStore = {} as SnapshotStore;

async function ingest(id: string, apg: APGResult, layerModel: LayerModel, extra: Readonly<Record<string, unknown>> = {}, allowedAsync?: readonly string[]): Promise<Graph> {
  const repo = new MemoryGraphRepository();
  const r = await ingestAPG({ apgResult: apg, layerModel, mode: 'stateless' }, repo, nullStore);
  if (!r.success) throw new Error(`${id}: ${r.errors.map((e) => e.message).join('; ')}`);
  const a2 = apg2Params(layerModel, allowedAsync !== undefined ? { allowedAsync: [...allowedAsync] } : undefined);
  const files = repo.graph.nodesWithLabel('File').map((n) => {
    const fp = n.properties.get('filePath');
    return typeof fp === 'string' ? fp : '';
  });
  return { id, repo, params: { ...sweepParams(layerModel, new Map(), a2, files), ...extra } };
}

/** Driver value → a comparable string (INTEGER and FLOAT kept apart). */
function keyOf(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (neo4j.isInt(x) ? `int:${String(x)}` : typeof x === 'number' ? `float:${String(x)}` : x));
}

describe('catalogue templates: ORDER BY keys are unique at the row grain', () => {
  const graphs: Graph[] = [];
  beforeAll(async () => {
    for (const s of syntheticProjects()) graphs.push(await ingest(s.id, s.apg, s.layerModel, s.params));
    for (const f of apg2FixtureProjects(process.cwd())) {
      const v2 = await extractAPG(f.dir, { ...V13_APG2_OPTIONS, components: f.components });
      if (!v2.success) throw new Error(`${f.id}: extraction failed`);
      graphs.push(await ingest(f.id, v2.data, f.layerModel, {}, f.allowedAsync));
    }
  });

  it('no two rows share an ORDER BY key, and every template returns rows on some graph', async () => {
    const duplicates: string[] = [];
    const rowsPerTemplate = new Map<string, number>(ALL_TEMPLATES.map(([n]) => [n, 0]));
    for (const g of graphs) {
      for (const binding of SWEEP_BINDINGS) {
        const params = bindingParams(g.params, binding);
        for (const t of TEXTS) {
          const p: Record<string, unknown> = {};
          for (const n of paramNames(t.text)) p[n] = n === 'excludePatterns' ? ['.*\\.spec\\.ts$'] : params[n] ?? null;
          const r = await g.repo.executeQuery(t.text, p);
          if (!r.success) throw new Error(`${g.id} ${t.name} [${t.variant}] ${binding}: ${r.errors.map((e) => e.message).join('; ')}`);
          const keys = orderKeys(t.text);
          const seen = new Set<string>();
          for (const rec of r.data.records) {
            const k = keyOf(keys.map((c) => rec[c] ?? null));
            if (seen.has(k)) duplicates.push(`${g.id} ${t.name} [${t.variant}] ${binding}: key ${k}`);
            seen.add(k);
          }
          rowsPerTemplate.set(t.name, (rowsPerTemplate.get(t.name) ?? 0) + r.data.records.length);
        }
      }
    }
    expect(duplicates.slice(0, 10)).toEqual([]);
    expect([...rowsPerTemplate].filter(([, n]) => n === 0).map(([name]) => name)).toEqual([]);
  });

  it('gives every thin template at least 3 non-empty statements per binding on the synthetic graphs', async () => {
    const short: string[] = [];
    for (const name of THIN_TEMPLATES) {
      for (const binding of SWEEP_BINDINGS) {
        let n = 0;
        for (const g of graphs.filter((x) => x.id.startsWith('synthetic/'))) {
          const params = bindingParams(g.params, binding);
          for (const t of TEXTS.filter((x) => x.name === name)) {
            const p: Record<string, unknown> = {};
            for (const k of paramNames(t.text)) p[k] = k === 'excludePatterns' ? ['.*\\.spec\\.ts$'] : params[k] ?? null;
            const r = await g.repo.executeQuery(t.text, p);
            if (r.success && r.data.records.length > 0) n += 1;
          }
        }
        if (n < 3) short.push(`${name} ${binding}: ${String(n)}`);
      }
    }
    expect(short).toEqual([]);
  });

  it('precondition: overlapping aggregates tie on the aggregate templates\' ORDER BY key', async () => {
    const syn = thinTemplateProject('a');
    const inner = String((syn.params?.aggregates as { innerEntities: string[] }[])[0]?.innerEntities[0]);
    const overlapping = [
      { name: 'A1', innerEntities: [inner], module: '^__none__$' },
      { name: 'A2', innerEntities: [inner], module: '^__none__$' },
    ];
    const g = await ingest(syn.id, syn.apg, syn.layerModel, { aggregates: overlapping });
    const t = TEXTS.find((x) => x.name === 'aggregate-boundary' && x.variant === 'v1.2e');
    if (t === undefined) throw new Error('aggregate-boundary missing');
    const r = await g.repo.executeQuery(t.text, { aggregates: overlapping, excludePatterns: [] });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const keys = r.data.records.map((rec) => keyOf(orderKeys(t.text).map((c) => rec[c] ?? null)));
    expect(new Set(keys).size).toBeLessThan(keys.length);
  });
});
