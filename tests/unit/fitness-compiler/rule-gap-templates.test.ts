/**
 * Rule-gap extension templates (`rule-gap-templates.ts`) and their in-memory mirrors (`rule-gap-in-memory.ts`), on the
 * fixture suite `tests/fixtures/v1.3-rule-gaps/cases.json`: every violating case is reported, no clean or look-alike
 * case is. The catalogue is opt-in (not in `V13_EXTENSION_TEMPLATE_CATALOGUES`), every rule is advisory and has a
 * source row. The live Cypher run needs Neo4j and is not part of this suite (`scripts/v1.3/rule-gaps-run.ts fixtures`).
 */
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { extractAPG, V13_APG2_OPTIONS } from '../../../src/apg-extractor/index.js';
import { memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import type { MemGraph, Row } from '../../../src/fitness-compiler/apg2-in-memory.js';
import {
  RULE_GAP_CATALOGUE, RULE_GAP_SOURCES, RULE_GAP_TEMPLATES, RULE_GAP_TEMPLATE_TIERS,
} from '../../../src/fitness-compiler/rule-gap-templates.js';
import { RULE_GAP_IN_MEMORY, ruleGapParams } from '../../../src/fitness-compiler/rule-gap-in-memory.js';
import type { RuleGapParams } from '../../../src/fitness-compiler/rule-gap-in-memory.js';
import {
  V13_EXTENSION_TEMPLATE_CATALOGUES, V13_OPT_IN_EXTENSION_CATALOGUES, v13ExtensionCatalogueOf, v13OptInCatalogueOf,
} from '../../../src/fitness-compiler/extension-templates.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { instantiateTemplate } from '../../../src/fitness-compiler/index.js';
import type { DddModel, LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';

const SUITE = path.resolve(__dirname, '../../fixtures/v1.3-rule-gaps');

interface ProjectSpec { layers: { name: string; directories: string[]; kind: LayerKind }[]; forbiddenImports: string[]; ddd?: DddModel }
interface Case { id: string; kind: 'violating' | 'clean' | 'look-alike'; project: string; template: string; match: Record<string, unknown> }
const suite = JSON.parse(readFileSync(path.join(SUITE, 'cases.json'), 'utf8')) as { projects: Record<string, ProjectSpec>; cases: Case[] };

const layerModelOf = (p: ProjectSpec): LayerModel => ({
  layers: p.layers.map((l): LayerDefinition => ({ name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit' })),
  ...(p.ddd !== undefined ? { ddd: p.ddd } : {}),
});
const matches = (row: Row, m: Record<string, unknown>): boolean => Object.entries(m).every(([k, v]) => JSON.stringify(row[k]) === JSON.stringify(v));

/** The graph the catalogue needs: v1.3 defaults (member facts, module wiring), APG v2 (SIGNATURE_USES) and field state. */
const OPTIONS = { ...V13_APG2_OPTIONS, fieldState: true };

const graphs = new Map<string, { g: MemGraph; p: RuleGapParams }>();

beforeAll(async () => {
  for (const [name, spec] of Object.entries(suite.projects)) {
    const r = await extractAPG(path.join(SUITE, name), OPTIONS);
    if (!r.success) throw new Error(`extraction failed: ${name}`);
    const lm = layerModelOf(spec);
    graphs.set(name, { g: memGraph(r.data, lm), p: ruleGapParams(lm, { forbiddenImports: spec.forbiddenImports }) });
  }
}, 120_000);

function rowsOf(c: Case): Row[] {
  const entry = graphs.get(c.project);
  const mirror = RULE_GAP_IN_MEMORY.get(c.template);
  if (entry === undefined || mirror === undefined) throw new Error(`no graph or mirror for ${c.id}`);
  return mirror(entry.g, entry.p).filter((r) => matches(r, c.match));
}

describe('rule-gap catalogue', () => {
  it('is opt-in: not in the default v1.3 catalogues, found only when enabled', () => {
    expect([...V13_EXTENSION_TEMPLATE_CATALOGUES.values()].some((c) => c === RULE_GAP_TEMPLATES)).toBe(false);
    expect(V13_OPT_IN_EXTENSION_CATALOGUES.get(RULE_GAP_CATALOGUE)).toBe(RULE_GAP_TEMPLATES);
    for (const name of RULE_GAP_TEMPLATES.keys()) {
      expect(v13ExtensionCatalogueOf(name)).toBeUndefined();
      expect(v13OptInCatalogueOf(name, [])).toBeUndefined();
      expect(v13OptInCatalogueOf(name, [RULE_GAP_CATALOGUE])).toBe(RULE_GAP_CATALOGUE);
      expect(CYPHER_TEMPLATES.has(name)).toBe(false);
    }
  });

  it('gives every template a mirror, an advisory tier and a source row with a locator', () => {
    const names = [...RULE_GAP_TEMPLATES.keys()].sort();
    expect(names).toHaveLength(8);
    expect([...RULE_GAP_IN_MEMORY.keys()].sort()).toEqual(names);
    expect([...RULE_GAP_TEMPLATE_TIERS.keys()].sort()).toEqual(names);
    expect([...RULE_GAP_SOURCES.keys()].sort()).toEqual(names);
    for (const [, t] of RULE_GAP_TEMPLATE_TIERS) expect(t.tier).toBe('advisory');
    for (const [, s] of RULE_GAP_SOURCES) {
      expect(s.locator.length).toBeGreaterThan(0);
      expect(s.wording).toMatch(/verbatim|\(recalled\)/);
    }
  });

  it.each([...RULE_GAP_TEMPLATES.values()].map((t) => [t.functionName, t] as const))('%s: Cypher binds its params and returns its mapped columns', (_, t) => {
    for (const p of t.requiredParams) expect(t.template).toContain(`$${p}`);
    expect(t.template).toContain(`AS ${t.resultMapping.filePathColumn}`);
    for (const c of t.resultMapping.discriminatorColumns) expect(t.template).toMatch(new RegExp(`(AS ${c}\\b|, ${c},|^WITH .*\\b${c}\\b)`, 'm'));
    expect(t.template).toContain('/*EXCLUDE:');
    // The exclude anchor is replaced by the compiler's own instantiation, with and without exclude patterns.
    expect(instantiateTemplate(t, {})).not.toContain('/*EXCLUDE');
    expect(instantiateTemplate(t, { excludePatterns: ['^src/generated/.*$'] })).toContain('$excludePatterns');
  });

  it('every template has a violating, a clean and a look-alike case', () => {
    for (const name of RULE_GAP_TEMPLATES.keys()) {
      const kinds = new Set(suite.cases.filter((c) => c.template === name).map((c) => c.kind));
      expect([...kinds].sort()).toEqual(['clean', 'look-alike', 'violating']);
    }
  });
});

describe('rule-gap fixture suite (in-memory)', () => {
  it.each(suite.cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
    const rows = rowsOf(c);
    if (c.kind === 'violating') expect(rows.length).toBeGreaterThan(0);
    else expect(rows).toEqual([]);
  });

  it('reports nothing beyond the violating cases', () => {
    for (const name of RULE_GAP_TEMPLATES.keys()) {
      const violating = suite.cases.filter((c) => c.template === name && c.kind === 'violating');
      for (const project of new Set(suite.cases.filter((c) => c.template === name).map((c) => c.project))) {
        const entry = graphs.get(project);
        if (entry === undefined) throw new Error(project);
        const all = (RULE_GAP_IN_MEMORY.get(name) ?? ((): Row[] => []))(entry.g, entry.p);
        const unexplained = all.filter((r) => !violating.some((c) => c.project === project && matches(r, c.match)));
        expect({ name, project, unexplained }).toEqual({ name, project, unexplained: [] });
      }
    }
  });
});
