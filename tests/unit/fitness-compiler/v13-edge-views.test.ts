/**
 * ADR-V13-01 edge views: every v1.3-active template has a recorded view (`Docs/v1.3/edge-views.md`), the frozen
 * template text is untouched, and `edgeViews` rewrites exactly the IMPORTS patterns of literal / resolved templates.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { HEXAGONAL_TEMPLATES } from '../../../src/fitness-compiler/hexagonal-templates.js';
import { V13_CYPHER_TEMPLATES } from '../../../src/fitness-compiler/v13-templates.js';
import {
  TEMPLATE_EDGE_VIEWS, applyEdgeView, cypherReadsImports, edgeViewOf,
} from '../../../src/fitness-compiler/edge-views.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CATALOGUES = { CYPHER_TEMPLATES, HEXAGONAL_TEMPLATES, V13_CYPHER_TEMPLATES } as const;
const ALL = [...CYPHER_TEMPLATES, ...HEXAGONAL_TEMPLATES, ...V13_CYPHER_TEMPLATES];

async function compiled(specRel: string, edgeViews: boolean): Promise<CypherQuery[]> {
  const parsed = await parseSpec({ specFilePath: path.join(REPO_ROOT, specRel) });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  const r = compileFunctions(compilerInputFromSpec(parsed.data), edgeViews ? V13_COMPILE_OPTIONS : {});
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return [...r.data.symbolicQueries, ...r.data.hybridPairs.map((h) => h.symbolicQuery)];
}

/** `Docs/v1.3/edge-views.md` table rows: template name(s) → view. */
function docTable(): Map<string, string> {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'Docs/v1.3/edge-views.md'), 'utf8');
  const section = text.slice(text.indexOf('## Table'));
  const out = new Map<string, string>();
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5 || cells[1] === 'Catalogue' || cells[1]?.startsWith('---')) continue;
    for (const name of (cells[2] ?? '').split(',').map((n) => n.trim()).filter((n) => n !== '')) out.set(name, cells[3] ?? '');
  }
  return out;
}

describe('edge-view table (ADR-V13-01)', () => {
  it.each(Object.entries(CATALOGUES))('every %s template has a view', (_name, catalogue) => {
    for (const name of catalogue.keys()) expect([name, edgeViewOf(name)]).toEqual([name, expect.stringMatching(/^(literal|resolved|none)$/)]);
  });

  it("a template's view is 'none' exactly when its Cypher reads no IMPORTS edge", () => {
    for (const [name, t] of ALL) expect([name, edgeViewOf(name) === 'none']).toEqual([name, !cypherReadsImports(t.template)]);
  });

  it('the ADR assignments: literal for layer, skip, cycle and context rules; resolved for usage rules', () => {
    for (const n of ['dependency-direction', 'no-layer-skip', 'no-cyclic-deps', 'no-domain-outward-dep', 'dependency-direction-graph', 'layer-skip-graph', 'core-isolation', 'context-isolation']) {
      expect([n, edgeViewOf(n)]).toEqual([n, 'literal']);
    }
    for (const n of ['domain-purity', 'controller-no-entity', 'aggregate-boundary', 'repository-aggregate-root']) {
      expect([n, edgeViewOf(n)]).toEqual([n, 'resolved']);
    }
  });

  it('every entry has a one-line reason', () => {
    for (const [name, e] of TEMPLATE_EDGE_VIEWS) {
      expect([name, e.reason.length > 10 && !e.reason.includes('\n')]).toEqual([name, true]);
    }
  });

  it('Docs/v1.3/edge-views.md lists the same view for every template in the table', () => {
    const doc = docTable();
    expect([...doc.keys()].sort()).toEqual([...TEMPLATE_EDGE_VIEWS.keys()].sort());
    for (const [name, e] of TEMPLATE_EDGE_VIEWS) expect([name, doc.get(name)]).toEqual([name, e.view]);
  });

  it('counts: 13 literal, 4 resolved, 21 none', () => {
    const count = (v: string): number => [...TEMPLATE_EDGE_VIEWS.values()].filter((e) => e.view === v).length;
    expect([count('literal'), count('resolved'), count('none')]).toEqual([13, 4, 21]);
  });
});

describe('applyEdgeView', () => {
  it('rewrites every IMPORTS pattern of a literal / resolved template and nothing else', () => {
    for (const [name, t] of ALL) {
      const view = edgeViewOf(name);
      const out = applyEdgeView(name, t.template);
      if (view === 'none') {
        expect(out).toBe(t.template);
        continue;
      }
      const prop = view === 'literal' ? 'viaReExport' : 'reExportHop';
      const patterns = [...t.template.matchAll(/\[[A-Za-z_0-9]*:[A-Z_|]*\bIMPORTS\b[A-Z_|]*(\*[0-9.]*)?\]/g)].length;
      const predicates = out.split(`.${prop}, false)`).length - 1;
      expect([name, predicates]).toEqual([name, patterns]);
      expect(out).not.toContain(view === 'literal' ? 'reExportHop' : 'viaReExport');
    }
  });

  it('the frozen literal no-layer-skip gets an inline WHERE on its named relationship', () => {
    const out = applyEdgeView('no-layer-skip', CYPHER_TEMPLATES.get('no-layer-skip')!.template);
    expect(out).toContain('MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)');
  });

  it('variable-length patterns are bound and filtered in the following WHERE', () => {
    const cyc = applyEdgeView('no-cyclic-deps', CYPHER_TEMPLATES.get('no-cyclic-deps')!.template);
    expect(cyc).toContain('MATCH p = (f:File)-[_ev0:IMPORTS|RE_EXPORTS*2..10]->(f)\nWHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.viaReExport, false)) AND ALL(n IN nodes(p)');
    const ctrl = applyEdgeView('controller-no-entity', CYPHER_TEMPLATES.get('controller-no-entity')!.template);
    expect(ctrl).toContain('-[_ev0:IMPORTS|CONSTRUCTOR_INJECTS*1..2]->(entity:Class)\nWHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.reExportHop, false)) AND ctrl.layer');
  });

  it('unnamed patterns get distinct names', () => {
    const out = applyEdgeView('component-instability', CYPHER_TEMPLATES.get('component-instability')!.template);
    expect(out).toContain('(f)<-[_ev0:IMPORTS WHERE NOT coalesce(_ev0.viaReExport, false)]-(incoming:File)');
    expect(out).toContain('(f)-[_ev1:IMPORTS WHERE NOT coalesce(_ev1.viaReExport, false)]->(outgoing:File)');
  });

  it('leaves MODULE_IMPORTS, unknown names and DDD-only names absent from the Cypher alone', () => {
    const t = V13_CYPHER_TEMPLATES.get('module-domain-imports-infrastructure')!.template;
    expect(applyEdgeView('module-domain-imports-infrastructure', t)).toBe(t);
    expect(applyEdgeView('adr:some decision', 'MATCH (a)-[:IMPORTS]->(b) RETURN a')).toBe('MATCH (a)-[:IMPORTS]->(b) RETURN a');
  });

  it('is deterministic', () => {
    for (const [name, t] of ALL) expect(applyEdgeView(name, t.template)).toBe(applyEdgeView(name, t.template));
  });
});

describe('compileFunctions edgeViews option', () => {
  it.each(['specs/clean-arch.yaml', 'presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml', 'presets/hexagonal.yaml'])(
    '%s: without the option the compiled text has no view predicate (frozen text); with it, every IMPORTS-reading query is rewritten',
    async (spec) => {
      const frozen = await compiled(spec, false);
      const v13 = await compiled(spec, true);
      expect(v13.map((q) => q.name)).toEqual(frozen.map((q) => q.name));
      for (const q of frozen) expect(q.cypher).not.toMatch(/viaReExport|reExportHop/);
      v13.forEach((q, i) => {
        const before = frozen[i]!;
        expect(q.params).toEqual(before.params);
        const view = edgeViewOf(q.name);
        expect([q.name, q.cypher]).toEqual([q.name, view === undefined ? before.cypher : applyEdgeView(q.name, before.cypher)]);
      });
    },
  );

  it('V13_COMPILE_OPTIONS turns edge views on', () => {
    expect(V13_COMPILE_OPTIONS.edgeViews).toBe(true);
  });
});
