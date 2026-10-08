/**
 * U3-R6 (FR-21; ADR-015 item 9): `domain-state-purity` and FF-P06
 * (U3 business-rules.md BR-U3-14, BR-U3-22 text §2.2, BR-U3-23 metadata and mapping, BR-U3-24 declarations,
 * BR-U3-66 discriminators over 25 templates). Static and stubbed; the fixtures TF-02..04 are gated in
 * tests/golden/u3-templates.test.ts.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { CYPHER_TEMPLATES, TEMPLATE_DISCRIMINATORS, getTemplateTag } from '../../../src/fitness-compiler/cypher-templates.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { resolveTemplate } from '../../../src/spec-parser/template-registry.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { CompiledFunctions, CypherQuery } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const ROOT = path.resolve(__dirname, '../../..');

/** §2.2, verbatim (BR-U3-22). */
const SECTION_2_2 = `MATCH (c:Class)-[e:FLOWS_TO|CONSTRUCTOR_INJECTS]->(t)
WHERE c.layer = $domainLayer AND t.layer = $infraLayer AND (t:Class OR t:Interface) /*EXCLUDE:c*/
RETURN c.filePath AS filePath, c.name AS class, t.filePath AS target, t.name AS targetName,
       type(e) AS relType, coalesce(e.field, e.parameterName) AS field, e.line AS line
ORDER BY filePath, class, target, relType, field`;

function template(name = 'domain-state-purity'): NonNullable<ReturnType<typeof CYPHER_TEMPLATES.get>> {
  const t = CYPHER_TEMPLATES.get(name);
  if (t === undefined) throw new Error(`${name} missing`);
  return t;
}

function stubRepo(records: Record<string, unknown>[]): GraphRepository {
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records, summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

async function violationsOf(name: string, records: Record<string, unknown>[], id = 'FF-P06'): Promise<readonly Violation[]> {
  const q: CypherQuery = {
    functionId: functionId(id), name, cypher: template(name).template, params: {},
    dimension: 'pattern', severity: 'critical', route: 'symbolic', source: 'template',
  };
  const out = await evaluateSymbolic({ queries: [q], graphRepository: stubRepo(records) });
  if (!out.success) throw new Error('evaluateSymbolic failed');
  return out.data.results[0]?.violations ?? [];
}

const FLOW_ROW = {
  filePath: 'src/domain/Order.ts', class: 'Order', target: 'src/infrastructure/InMemoryOrderRepository.ts',
  targetName: 'InMemoryOrderRepository', relType: 'FLOWS_TO', field: 'repo', line: 5,
};

async function compiledFrom(file: string): Promise<CompiledFunctions> {
  const parsed = await parseSpec({ specFilePath: file });
  if (!parsed.success) throw new Error(`${file} did not parse: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const compiled = compileFunctions(compilerInputFromSpec(parsed.data));
  if (!compiled.success) throw new Error(`${file} did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  return compiled.data;
}

describe('BR-U3-22 domain-state-purity text (§2.2, exact)', () => {
  it('equals §2.2 byte for byte', () => {
    expect(template().template).toBe(SECTION_2_2);
  });
});

describe('BR-U3-23 domain-state-purity metadata and mapping', () => {
  it('requiredParams [domainLayer, infraLayer], kinds [domain, infrastructure], all styles, tag structural', () => {
    const t = template();
    expect(t.requiredParams).toEqual(['domainLayer', 'infraLayer']);
    expect(t.optionalParams).toEqual([]);
    expect(t.requiredLayerKinds).toEqual(['domain', 'infrastructure']);
    expect(t.applicableStyles).toBeUndefined();
    expect(t.tag).toBe('structural');
    expect(getTemplateTag('domain-state-purity')).toBe('structural');
  });

  it('maps per T-MAP: filePath, target, line (no lines/isTypeOnly), disc [class, targetName, relType, field], no evidence', () => {
    const rm = template().resultMapping;
    expect({
      filePath: rm.filePathColumn, target: rm.targetColumn, line: rm.lineColumn, lines: rm.linesColumn,
      isTypeOnly: rm.isTypeOnlyColumn, disc: rm.discriminatorColumns, evid: rm.evidenceColumns, cycle: rm.cycleColumn,
      message: rm.messageTemplate,
    }).toEqual({
      filePath: 'filePath', target: 'target', line: 'line', lines: undefined, isTypeOnly: undefined,
      disc: ['class', 'targetName', 'relType', 'field'], evid: undefined, cycle: undefined,
      message: 'Domain class {class} holds infrastructure {targetName} via {relType} ({field})',
    });
  });

  it('a FLOWS_TO row maps to one violation with line, field in disc, tag structural and the FR-21 type', async () => {
    const [v, ...rest] = await violationsOf('domain-state-purity', [FLOW_ROW]);
    expect(rest).toEqual([]);
    expect(v).toMatchObject({
      filePath: 'src/domain/Order.ts', target: 'src/infrastructure/InMemoryOrderRepository.ts', line: 5,
      discriminator: ['Order', 'InMemoryOrderRepository', 'FLOWS_TO', 'repo'], tag: 'structural',
      type: 'DOMAIN_STATE_PURITY_VIOLATION', dimension: 'pattern',
      message: 'Domain class Order holds infrastructure InMemoryOrderRepository via FLOWS_TO (repo)',
    });
    expect(v?.evidence).toBeUndefined();
    expect(v?.lines).toBeUndefined();
    expect(v?.isTypeOnly).toBeUndefined();
  });

  it('an injection row with line null maps to a violation without a line key (its id uses "" for the line)', async () => {
    const [v] = await violationsOf('domain-state-purity', [{ ...FLOW_ROW, relType: 'CONSTRUCTOR_INJECTS', line: null }]);
    expect(v).toBeDefined();
    expect(v !== undefined && 'line' in v).toBe(false);
    expect(v?.message).toBe('Domain class Order holds infrastructure InMemoryOrderRepository via CONSTRUCTOR_INJECTS (repo)');
  });

  it('two injected parameters of one infrastructure type give two violations (field discriminates)', async () => {
    const inj = { ...FLOW_ROW, relType: 'CONSTRUCTOR_INJECTS', line: null };
    const vs = await violationsOf('domain-state-purity', [{ ...inj, field: 'a' }, { ...inj, field: 'b' }]);
    expect(vs.map((v) => v.discriminator?.[3])).toEqual(['a', 'b']);
    expect(new Set(vs.map((v) => v.id)).size).toBe(2);
  });
});

describe('BR-U3-14 violation types over the 25 templates', () => {
  it.each([...CYPHER_TEMPLATES.keys()])('%s maps to a taxonomy type, never CUSTOM_', async (name) => {
    const [v] = await violationsOf(name, [{ filePath: 'src/a.ts', source: 'src/a.ts', cycle: ['src/a.ts', 'src/b.ts', 'src/a.ts'] }], 'FF-X01');
    expect(String(v?.type)).not.toMatch(/^CUSTOM_/);
  });

  it('domain-state-purity → DOMAIN_STATE_PURITY_VIOLATION; the registry has 25 templates', async () => {
    expect(CYPHER_TEMPLATES.size).toBe(25);
    const [v] = await violationsOf('domain-state-purity', [FLOW_ROW]);
    expect(v?.type).toBe('DOMAIN_STATE_PURITY_VIOLATION');
  });
});

describe('BR-U3-66 TEMPLATE_DISCRIMINATORS over 25 templates', () => {
  it('covers all 25 templates and equals the registry', () => {
    expect(Object.keys(TEMPLATE_DISCRIMINATORS)).toHaveLength(25);
    expect(Object.keys(TEMPLATE_DISCRIMINATORS).sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    for (const [name, t] of CYPHER_TEMPLATES) expect(TEMPLATE_DISCRIMINATORS[name]).toEqual(t.resultMapping.discriminatorColumns);
    expect(TEMPLATE_DISCRIMINATORS['domain-state-purity']).toEqual(['class', 'targetName', 'relType', 'field']);
  });
});

describe('BR-U3-24 FF-P06 declarations', () => {
  const FILES = ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml', 'specs/clean-arch.yaml'];

  it.each(FILES)('%s declares FF-P06 as BR-U3-24 states', (rel) => {
    const raw = YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as { fitness_functions: Record<string, unknown>[] };
    expect(raw.fitness_functions.find((f) => f.id === 'FF-P06')).toMatchObject({
      name: 'domain-state-purity', dimension: 'pattern', severity: 'critical', route: 'symbolic',
    });
  });

  it.each(FILES)('%s compiles FF-P06 with domainLayer and infraLayer bound', async (rel) => {
    const c = await compiledFrom(path.join(ROOT, rel));
    const q = c.symbolicQueries.find((x) => String(x.functionId) === 'FF-P06');
    expect(q?.name).toBe('domain-state-purity');
    expect(c.disabledFunctions.map((d) => String(d.id))).not.toContain('FF-P06');
    const params = q?.params ?? {};
    expect(typeof params.domainLayer).toBe('string');
    expect(typeof params.infraLayer).toBe('string');
  });

  it('layered binds business as domain and persistence as infrastructure (BR-U1-17)', async () => {
    const c = await compiledFrom(path.join(ROOT, 'presets/layered.yaml'));
    expect(c.symbolicQueries.find((x) => String(x.functionId) === 'FF-P06')?.params).toEqual({ domainLayer: 'business', infraLayer: 'persistence' });
  });

  it('the clean-architecture library declares FF-P06 (pattern, critical, symbolic)', () => {
    expect(resolveTemplate('clean-architecture')?.functions.find((f) => String(f.id) === 'FF-P06')).toMatchObject({
      name: 'domain-state-purity', dimension: 'pattern', severity: 'critical', route: 'symbolic',
    });
  });

  it('a spec without an infrastructure kind lists FF-P06 as kind-disabled (BR-U1-15), not as a failure', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-p06-'));
    try {
      const file = path.join(dir, 'no-infra.yaml');
      fs.writeFileSync(file, `spec_version: "1.0.0"
architecture:
  style: layered
  layers:
    - { name: business, kind: domain, directories: [src/business/**], roles: [entity] }
    - { name: presentation, kind: presentation, directories: [src/presentation/**], roles: [controller] }
fitness_functions:
  - id: FF-P06
    name: domain-state-purity
    dimension: pattern
    severity: critical
    route: symbolic
scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.60, icc_minimum: 0.70 }
`);
      const parsed = await parseSpec({ specFilePath: file });
      if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
      const only = { ...compilerInputFromSpec(parsed.data) };
      const input = { ...only, fitnessFunctions: only.fitnessFunctions.filter((f) => String(f.id) === 'FF-P06') };
      const r = compileFunctions(input);
      if (!r.success) throw new Error(`did not compile: ${r.errors.map((e) => e.message).join('; ')}`);
      expect(r.data.disabledFunctions).toEqual([{ id: 'FF-P06', name: 'domain-state-purity', reason: 'no infrastructure layer' }]);
      expect(r.data.symbolicQueries).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
