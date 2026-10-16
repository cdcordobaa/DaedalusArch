/**
 * Spec validation under the v1.3 rule set (unit U-D; integration-notes open point): v1.3 extension templates are
 * accepted with `{ rules: 'v1.3' }`, the v1.2E check (the default) is unchanged.
 */
import { validateSpecAgainstProject } from '../../../src/spec-parser/spec-validator.js';
import { APG2_TEMPLATES } from '../../../src/fitness-compiler/apg2-templates.js';
import { CHEAP2_TEMPLATES } from '../../../src/fitness-compiler/cheap2-templates.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES, v13ExtensionCatalogueOf } from '../../../src/fitness-compiler/extension-templates.js';
import { V13_CYPHER_TEMPLATES } from '../../../src/fitness-compiler/v13-templates.js';
import { HEXAGONAL_TEMPLATES } from '../../../src/fitness-compiler/hexagonal-templates.js';
import { DDD_TEMPLATES } from '../../../src/fitness-compiler/ddd-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import type { FitnessFunction, ParsedSpec } from '../../../src/shared/types/spec.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const fn = (id: string, name: string): FitnessFunction => ({
  id: functionId(id), name, dimension: 'structural', severity: 'critical', route: 'symbolic',
  isBuiltIn: false, validated: false, enabled: true, excludePaths: [],
});

const spec = (functions: FitnessFunction[]): ParsedSpec => ({
  specVersion: '1.0.0',
  layerModel: { layers: [] },
  fitnessFunctions: functions,
  scoringWeights: { structural: 0.5, coupling: 0.2, pattern: 0.2, solid: 0.05, convention: 0.05, semantic: 0, integrity: 0 },
  verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
  confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
  adrRules: [],
});

const badRefs = (s: ParsedSpec, rules?: 'v1.2e' | 'v1.3'): string[] =>
  validateSpecAgainstProject(s, '/nonexistent', rules === undefined ? {} : { rules }).errors
    .filter((e) => e.code === 'INVALID_TEMPLATE_REF')
    .map((e) => e.field ?? '');

const MODULE_WIRING = 'module-domain-imports-infrastructure';

describe('spec validation: v1.3 extension templates', () => {
  const mixed = spec([
    fn('FF-S01', 'dependency-direction'),
    fn('FF-S04', 'core-isolation'),
    fn('MW-01', MODULE_WIRING),
    fn('X-01', 'no-such-template'),
  ]);

  it('v1.2E (default and explicit): unchanged, the module-wiring template is rejected, frozen and hexagonal names accepted', () => {
    expect(badRefs(mixed)).toEqual(['fitness_functions.MW-01.name', 'fitness_functions.X-01.name']);
    expect(badRefs(mixed, 'v1.2e')).toEqual(badRefs(mixed));
  });

  it('v1.3: the module-wiring and hexagonal templates are accepted; an unknown name is still rejected', () => {
    expect(badRefs(mixed, 'v1.3')).toEqual(['fitness_functions.X-01.name']);
  });

  it('v1.3 accepts every template of every extension catalogue', () => {
    const all = [...V13_EXTENSION_TEMPLATE_CATALOGUES.values()].flatMap((c) => [...c.keys()]);
    expect(all.sort()).toEqual([...HEXAGONAL_TEMPLATES.keys(), ...V13_CYPHER_TEMPLATES.keys(), ...DDD_TEMPLATES.keys(), ...APG2_TEMPLATES.keys(), ...CHEAP2_TEMPLATES.keys()].sort());
    expect(badRefs(spec(all.map((name, i) => fn(`E-${String(i)}`, name))), 'v1.3')).toEqual([]);
  });

  it('the DDD catalogue (U-C1, registered at integration) is accepted under v1.3 only', () => {
    expect([...V13_EXTENSION_TEMPLATE_CATALOGUES.keys()]).toEqual(['hexagonal', 'module-wiring', 'ddd', 'apg2', 'cheap2']);
    expect(DDD_TEMPLATES.size).toBeGreaterThan(0);
    for (const name of DDD_TEMPLATES.keys()) expect(v13ExtensionCatalogueOf(name)).toBe('ddd');
    const ddd = spec([...DDD_TEMPLATES.keys()].map((name, i) => fn(`DDD-${String(i)}`, name)));
    expect(badRefs(ddd, 'v1.3')).toEqual([]);
    expect(badRefs(ddd, 'v1.2e')).toEqual([...DDD_TEMPLATES.keys()].map((_, i) => `fitness_functions.DDD-${String(i)}.name`));
  });

  it('a catalogue registered later is accepted under v1.3 only', () => {
    const registry = V13_EXTENSION_TEMPLATE_CATALOGUES as Map<string, ReadonlyMap<string, CypherTemplate>>;
    const later = spec([fn('LATER-01', 'later-library-rule')]);
    expect(badRefs(later, 'v1.3')).toEqual(['fitness_functions.LATER-01.name']);
    registry.set('later', new Map([['later-library-rule', {} as CypherTemplate]]));
    try {
      expect(v13ExtensionCatalogueOf('later-library-rule')).toBe('later');
      expect(badRefs(later, 'v1.3')).toEqual([]);
      expect(badRefs(later, 'v1.2e')).toEqual(['fitness_functions.LATER-01.name']);
    } finally {
      registry.delete('later');
    }
  });

  it('neuronal functions are not template-checked in either rule set', () => {
    const neural: FitnessFunction = { ...fn('FF-N01', 'architectural-integrity'), route: 'neuronal', semanticCriteria: { rule: 'r', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } } };
    expect(badRefs(spec([neural]), 'v1.2e')).toEqual([]);
    expect(badRefs(spec([neural]), 'v1.3')).toEqual([]);
  });
});
