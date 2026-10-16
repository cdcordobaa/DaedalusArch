import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { BUILT_IN_VIOLATION_TYPES } from '../../../src/shared/taxonomy/violation-types.js';
import { IMPORT_RULE_NAMES, IMPORT_RULE_TYPES } from '../../../src/mcp-server/spec-rules.js';
import { RULE_VIOLATION_TYPES, explainViolation } from '../../../src/mcp-server/rule-explainer.js';
import { CLEAN_ARCH_SPEC, LAYERED_SPEC, loadSpec } from './helpers.js';

describe('rule-to-violation-type table', () => {
  it('covers every Cypher template and only built-in violation types', () => {
    for (const name of CYPHER_TEMPLATES.keys()) expect(RULE_VIOLATION_TYPES).toHaveProperty([name]);
    for (const type of Object.values(RULE_VIOLATION_TYPES))
      expect(BUILT_IN_VIOLATION_TYPES).toContain(type);
  });

  it('agrees with the import-rule table of check_import', () => {
    for (const name of IMPORT_RULE_NAMES)
      expect(IMPORT_RULE_TYPES[name]).toBe(RULE_VIOLATION_TYPES[name]);
  });
});

describe('explain_violation', () => {
  it('explains a rule by id with the template text, the catalogue intent and fix', () => {
    const e = explainViolation('FF-S01');
    expect(e).toMatchObject({
      ruleId: 'FF-S01',
      ruleName: 'dependency-direction',
      violationType: 'LAYER_VIOLATION',
      dimension: 'structural',
      severity: 'critical',
      tag: 'structural',
    });
    expect(e?.detects).toBe(CYPHER_TEMPLATES.get('dependency-direction')?.description);
    expect(e?.intent).toBe(
      'A file in one architectural layer depends on a file in a layer it should not access.',
    );
    expect(e?.fix).toMatch(/behind an interface/);
  });

  it('accepts a rule name, a violation type and any letter case', () => {
    expect(explainViolation('domain-purity')?.ruleId).toBe('FF-P01');
    expect(explainViolation('ff-p01')?.ruleName).toBe('domain-purity');
    const byType = explainViolation('layer_skip');
    expect(byType).toMatchObject({
      ruleId: 'FF-S03',
      ruleName: 'no-layer-skip',
      violationType: 'LAYER_SKIP',
    });
    expect(byType?.applicableStyles).toEqual(['layered']);
  });

  it('leaves the rule id open when several rules share a violation type', () => {
    expect(explainViolation('NAMING_CONVENTION')?.ruleId).toBeNull();
  });

  it('falls back to the template text for a rule the catalogue does not describe', () => {
    const e = explainViolation('FF-P06');
    expect(e?.intent).toBe(e?.detects);
    expect(e?.fix).toMatch(/refactor the code to comply/);
    expect(e?.requiredLayerKinds).toEqual(['domain', 'infrastructure']);
  });

  it('explains a neuronal rule from its semantic criteria', () => {
    const e = explainViolation('FF-N02');
    expect(e).toMatchObject({
      ruleName: 'intent-alignment',
      violationType: 'INTENT_VIOLATION',
      tag: 'semantic',
    });
    expect(e?.detects).toMatch(/role of its declared layer/);
  });

  it('adds spec context: layer order, allowed transitions, forbidden imports, status', async () => {
    const layered = explainViolation('no-layer-skip', await loadSpec(LAYERED_SPEC));
    expect(layered?.specContext).toEqual(
      expect.arrayContaining([
        'layer order (inner to outer): persistence < business < presentation',
        'allowed transitions: business>persistence, presentation>business',
      ]),
    );
    const clean = await loadSpec(CLEAN_ARCH_SPEC);
    expect(explainViolation('FF-P01', clean)?.specContext.join('\n')).toContain(
      'forbidden imports: @nestjs/*, typeorm',
    );
    expect(explainViolation('FF-CV01', clean)?.specContext.join('\n')).toMatch(
      /disabled in this spec: ADR-016/,
    );
  });

  it('returns undefined for an unknown rule', () => {
    expect(explainViolation('FF-ZZ99')).toBeUndefined();
  });
});
