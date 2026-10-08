/**
 * U1 K16: controller checks bind the presentation layer (ADR-016 a; ADR-015 item 1; BR-U1-46).
 * (a) bindings of nestjs and the three clean-architecture specs; (b) nestjs FF-P05/FF-CV04 parameter maps;
 * the two templates match `$controllerLayer`, with requiredLayerKinds and applicableStyles unchanged (§3.1).
 * (d) is the gated graph test in tests/golden/u1-templates.test.ts.
 */
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');

async function parsed(rel: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!r.success) throw new Error(`${rel} did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

async function queries(rel: string): Promise<readonly CypherQuery[]> {
  const r = compileFunctions(compilerInputFromSpec(await parsed(rel)));
  if (!r.success) throw new Error(`${rel} did not compile: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data.symbolicQueries;
}

const CONTROLLER_TEMPLATES = ['controller-no-entity', 'naming-controllers'];

describe('BR-U1-46 (a) controllerLayer binding', () => {
  it('presets/nestjs.yaml → controllerLayer = presentation', async () => {
    const b = bindLayerParams((await parsed('presets/nestjs.yaml')).layerModel.layers);
    expect([b.presentationLayer, b.controllerLayer]).toEqual(['presentation', 'presentation']);
  });

  it.each([
    ['specs/clean-arch.yaml', 'infrastructure'],
    ['presets/clean-architecture.yaml', 'infrastructure'],
    ['specs/daedalus-arch.yaml', 'core-modules'],
  ])('%s → controllerLayer = infraLayer (%s)', async (rel, infra) => {
    const b = bindLayerParams((await parsed(rel)).layerModel.layers);
    expect(b.presentationLayer).toBeUndefined();
    expect([b.infraLayer, b.controllerLayer]).toEqual([infra, infra]);
  });
});

describe('BR-U1-46 (b) nestjs parameter maps', () => {
  it('FF-P05 and FF-CV04 carry controllerLayer presentation and no infraLayer', async () => {
    const qs = await queries('presets/nestjs.yaml');
    const p05 = qs.find((q) => String(q.functionId) === 'FF-P05');
    const cv04 = qs.find((q) => String(q.functionId) === 'FF-CV04');
    expect(p05?.params).toEqual({
      controllerLayer: 'presentation', domainLayer: 'domain', entityRoles: ['Entity', 'Aggregate', 'ValueObject'],
    });
    expect(cv04?.params).toEqual({ controllerLayer: 'presentation', pattern: '^(?:[^/]*Controller)$' });
    expect(p05 && 'infraLayer' in p05.params).toBe(false);
    expect(cv04 && 'infraLayer' in cv04.params).toBe(false);
  });

  it.each(['specs/clean-arch.yaml', 'presets/clean-architecture.yaml'])('%s: FF-P05 and FF-CV04 bind controllerLayer = infrastructure', async (rel) => {
    const qs = await queries(rel);
    for (const id of ['FF-P05', 'FF-CV04']) {
      const q = qs.find((x) => String(x.functionId) === id);
      expect({ id, controllerLayer: q?.params.controllerLayer, hasInfra: q != null && 'infraLayer' in q.params })
        .toEqual({ id, controllerLayer: 'infrastructure', hasInfra: false });
    }
  });
});

describe('BR-U1-46 templates', () => {
  it.each(CONTROLLER_TEMPLATES)('%s matches $controllerLayer and lists controllerLayer in place of infraLayer', (name) => {
    const t = CYPHER_TEMPLATES.get(name);
    expect(t?.template).toContain('.layer = $controllerLayer');
    expect(t?.template).not.toContain('$infraLayer');
    expect(t?.requiredParams).toContain('controllerLayer');
    expect(t?.requiredParams).not.toContain('infraLayer');
  });

  it('requiredLayerKinds and applicableStyles are unchanged (business-rules.md §3.1)', () => {
    const p05 = CYPHER_TEMPLATES.get('controller-no-entity');
    const cv04 = CYPHER_TEMPLATES.get('naming-controllers');
    expect([p05?.requiredParams, p05?.requiredLayerKinds, p05?.applicableStyles]).toEqual([
      ['controllerLayer', 'domainLayer', 'entityRoles'], ['infrastructure', 'domain'], ['clean-architecture', 'nestjs'],
    ]);
    expect([cv04?.requiredParams, cv04?.requiredLayerKinds, cv04?.applicableStyles]).toEqual([
      ['controllerLayer', 'pattern'], ['infrastructure'], ['clean-architecture', 'nestjs'],
    ]);
  });

  it('no other template references $controllerLayer', () => {
    const users = [...CYPHER_TEMPLATES.values()]
      .filter((t) => t.template.includes('$controllerLayer') || t.requiredParams.includes('controllerLayer'))
      .map((t) => t.functionName);
    expect([...users].sort()).toEqual([...CONTROLLER_TEMPLATES].sort());
  });
});
