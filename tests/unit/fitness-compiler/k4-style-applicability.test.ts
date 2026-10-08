/**
 * U1 K4: template applicability by style (FR-20, AD-8; ADR-015 item 10, U1 Q22 B).
 * BR-U1-18 (a) frozen §3.1 table × {clean-architecture, nestjs, layered, no style}; BR-U1-18 (b) self-spec;
 * BR-U1-43 (b) nestjs FF-S03; ParsedSpec.style lower-cased and absent when not declared.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import { isTemplateApplicable } from '../../../src/fitness-compiler/template-applicability.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';
import type { LayerModel, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-k4-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

function model(layers: [string, LayerKind][]): LayerModel {
  return { layers: layers.map(([name, kind]) => ({ name, directories: [], naming: [], role: 'r', kind, kindSource: 'explicit' as const })) };
}

const CLEAN = model([['domain', 'domain'], ['application', 'application'], ['infrastructure', 'infrastructure']]);
const NESTJS = model([['domain', 'domain'], ['infrastructure', 'infrastructure'], ['application', 'application'], ['presentation', 'presentation']]);
const LAYERED = model([['persistence', 'infrastructure'], ['business', 'domain'], ['presentation', 'presentation']]);

const STYLES: { column: string; style: string | undefined; layers: LayerModel }[] = [
  { column: 'clean-architecture', style: 'clean-architecture', layers: CLEAN },
  { column: 'nestjs', style: 'nestjs', layers: NESTJS },
  { column: 'layered', style: 'layered', layers: LAYERED },
  { column: 'no style', style: undefined, layers: CLEAN },
];

const OK = '✓';
const STYLE = (s: string): string => `not applicable to style ${s}`;
const CA_NESTJS = ['clean-architecture', 'nestjs'];

/** business-rules.md §3.1 (frozen, BR-U1-02): `applicableStyles` and the outcome per style column. */
const TABLE: [string, readonly string[] | undefined, string, string, string, string][] = [
  ['dependency-direction', undefined, OK, OK, OK, OK],
  ['no-cyclic-deps', undefined, OK, OK, OK, OK],
  ['no-layer-skip', ['layered'], STYLE('clean-architecture'), STYLE('nestjs'), OK, OK],
  ['no-domain-outward-dep', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['domain-purity', undefined, OK, OK, OK, OK],
  ['dependency-inversion', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['repository-pattern', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['use-case-isolation', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['controller-no-entity', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['domain-stability', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['module-fan-out', undefined, OK, OK, OK, OK],
  ['component-instability', undefined, OK, OK, OK, OK],
  ['no-orphan-files', undefined, OK, OK, OK, OK],
  ['max-fan-in', undefined, OK, OK, OK, OK],
  ['abstraction-ratio', undefined, OK, OK, OK, OK],
  ['single-responsibility-proxy', undefined, OK, OK, OK, OK],
  ['interface-segregation-proxy', undefined, OK, OK, OK, OK],
  ['inheritance-depth', undefined, OK, OK, OK, OK],
  ['naming-conventions', undefined, OK, OK, 'no application layer', OK],
  ['naming-services', undefined, OK, OK, 'no application layer', OK],
  ['naming-repos', undefined, OK, OK, OK, OK],
  ['naming-controllers', CA_NESTJS, OK, OK, STYLE('layered'), OK],
  ['test-file-pairing', undefined, OK, OK, OK, OK],
  ['no-index-logic', undefined, OK, OK, OK, OK],
];

describe('BR-U1-18 (a): applicability table (business-rules.md §3.1, frozen)', () => {
  it('covers exactly the 24 templates', () => {
    expect(TABLE.map((r) => r[0]).sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
  });

  it.each(TABLE)('%s', (name, styles, ...outcomes) => {
    const template = CYPHER_TEMPLATES.get(name);
    if (!template) throw new Error(`no template ${name}`);
    expect(template.applicableStyles).toEqual(styles);
    STYLES.forEach(({ column, style, layers }, i) => {
      const a = isTemplateApplicable(template, style, bindLayerParams(layers.layers), layers);
      expect({ column, outcome: a.applicable ? OK : a.reason }).toEqual({ column, outcome: outcomes[i] });
    });
  });
});

async function load(rel: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!r.success) throw new Error(`${rel} did not parse`);
  return r.data;
}

function compile(spec: ParsedSpec): CompiledFunctions {
  const r = compileFunctions(compilerInputFromSpec(spec));
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function queryIds(c: CompiledFunctions): string[] {
  return [...c.symbolicQueries.map((q) => String(q.functionId)), ...c.hybridPairs.map((h) => String(h.functionId))];
}

describe('BR-U1-18 (b): self-spec has no style, so applicableStyles is ignored', () => {
  it('no function is style-disabled; the seven style-restricted functions compile', async () => {
    const spec = await load('specs/daedalus-arch.yaml');
    expect(spec.style).toBeUndefined();
    const c = compile(spec);
    expect(c.disabledFunctions).toEqual([]);
    const ids = queryIds(c);
    for (const id of ['FF-S04', 'FF-P02', 'FF-P03', 'FF-P04', 'FF-P05', 'FF-C01', 'FF-CV04']) {
      expect({ id, compiled: ids.includes(id) }).toEqual({ id, compiled: true });
    }
  });
});

describe('BR-U1-43 (b): FF-S03 is not applicable to nestjs', () => {
  it('presets/nestjs.yaml: FF-S03 disabled with the style reason; no CypherQuery for FF-S03', async () => {
    const c = compile(await load('presets/nestjs.yaml'));
    expect(c.disabledFunctions).toEqual([{ id: 'FF-S03', name: 'no-layer-skip', reason: 'not applicable to style nestjs' }]);
    expect(queryIds(c)).not.toContain('FF-S03');
    expect(c.warnings.filter((w) => w.code === 'COMPILER_004')).toEqual([expect.objectContaining({ functionId: 'FF-S03' })]);
  });

  it.each(['presets/clean-architecture.yaml', 'specs/clean-arch.yaml'])('%s: FF-S03 disabled "not applicable to style clean-architecture"', async (rel) => {
    const c = compile(await load(rel));
    expect(c.disabledFunctions).toEqual([{ id: 'FF-S03', name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' }]);
  });
});

describe('ParsedSpec.style (P3/P9)', () => {
  const SCORING = `scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`;

  it('is the lower-cased architecture.style and reaches CompilerInput', async () => {
    const file = path.join(TMP, 'styled.yaml');
    fs.writeFileSync(file, `spec_version: "1.0.0"\narchitecture:\n  style: NestJS\n  layers:\n    - { name: domain, roles: [r] }\n    - { name: infrastructure, roles: [r] }\nfitness_functions: []\n${SCORING}`);
    const r = await parseSpec({ specFilePath: file });
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    expect(r.data.style).toBe('nestjs');
    expect(compilerInputFromSpec(r.data).style).toBe('nestjs');
  });

  it('is absent (key not present) when the spec declares no style', async () => {
    const spec = await load('specs/daedalus-arch.yaml');
    expect('style' in spec).toBe(false);
    expect('style' in compilerInputFromSpec(spec)).toBe(false);
  });
});
