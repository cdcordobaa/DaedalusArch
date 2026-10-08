/**
 * K7 (FR-35; BR-U1-29 a): every row-returning template ends with a total ORDER BY after its last
 * RETURN, and every collect is sorted explicitly. Keys per business-logic-model.md §5.2; the
 * `relType` discriminator of the three dependency templates joined the key with its column at K10.
 */
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';

const EXPECTED_KEYS: Readonly<Record<string, string>> = {
  'dependency-direction': 'source, target, relType',
  'no-cyclic-deps': 'cycle',
  'no-layer-skip': 'source, target, relType',
  'no-domain-outward-dep': 'source, target, relType',
  'domain-purity': 'source, target, relType', // U3-R5 (BR-U3-20, §2.1): attributed cross-unit update
  'dependency-inversion': 'filePath, class',
  'repository-pattern': 'filePath, implementation',
  'use-case-isolation': 'filePath, useCase',
  'controller-no-entity': 'filePath, controller, entity',
  'domain-stability': 'filePath',
  'module-fan-out': 'filePath',
  'component-instability': 'filePath',
  'no-orphan-files': 'filePath',
  'max-fan-in': 'filePath',
  'abstraction-ratio': 'ratio',
  'single-responsibility-proxy': 'filePath, class',
  'interface-segregation-proxy': 'filePath, interface',
  'inheritance-depth': 'filePath, class, depth',
  'naming-conventions': 'filePath, class',
  'naming-services': 'filePath, class',
  'naming-repos': 'filePath, class',
  'naming-controllers': 'filePath, class',
  'test-file-pairing': 'filePath',
  'no-index-logic': 'filePath',
};

describe('ORDER BY on every template (BR-U1-29 a)', () => {
  it('covers all 24 templates', () => {
    expect([...CYPHER_TEMPLATES.keys()].sort()).toEqual(Object.keys(EXPECTED_KEYS).sort());
  });

  it.each([...CYPHER_TEMPLATES.entries()])('%s has ORDER BY after its last RETURN with the §5.2 key', (name, t) => {
    const text = t.template;
    const lastReturn = text.lastIndexOf('RETURN ');
    const orderBy = text.lastIndexOf('ORDER BY ');
    expect(lastReturn).toBeGreaterThan(-1);
    expect(orderBy).toBeGreaterThan(lastReturn);
    const key = /ORDER BY ([^\n]+)/.exec(text.slice(orderBy))?.[1]?.trim();
    expect(key).toBe(EXPECTED_KEYS[name]);
  });

  it('sorts every collect explicitly (apoc.coll.sort)', () => {
    for (const [name, t] of CYPHER_TEMPLATES) {
      const collects = t.template.match(/collect\(/g) ?? [];
      const sorted = t.template.match(/apoc\.coll\.sort\(collect\(/g) ?? [];
      expect({ name, unsorted: collects.length - sorted.length }).toEqual({ name, unsorted: 0 });
    }
  });

  it('keeps no UNION in any template (BR-U1-45)', () => {
    for (const [name, t] of CYPHER_TEMPLATES) {
      expect({ name, union: /\bUNION\b/.test(t.template) }).toEqual({ name, union: false });
    }
  });
});
