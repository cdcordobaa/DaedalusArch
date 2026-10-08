/**
 * K11 (FR-29; BR-U1-27, BR-U1-02): every template carries its operational tag, frozen in
 * business-rules.md §4.1 (ADR-015 item 9 definitions with reading notes R1-R3).
 */
import { CYPHER_TEMPLATES, getTemplateTag, listTemplatesByTag } from '../../../src/fitness-compiler/cypher-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import type { TemplateTag } from '../../../src/shared/types/enums.js';

/** business-rules.md §4.1, verbatim (frozen; BR-U1-02). */
const TAG_TABLE: Readonly<Record<string, TemplateTag>> = {
  'dependency-direction': 'structural',
  'no-layer-skip': 'structural',
  'no-domain-outward-dep': 'structural',
  'no-cyclic-deps': 'topological',
  'module-fan-out': 'topological',
  'max-fan-in': 'topological',
  'component-instability': 'topological',
  'domain-stability': 'topological',
  'no-orphan-files': 'topological',
  'abstraction-ratio': 'topological',
  'inheritance-depth': 'topological',
  'domain-purity': 'pattern-proxy',
  'dependency-inversion': 'pattern-proxy',
  'repository-pattern': 'pattern-proxy',
  'use-case-isolation': 'pattern-proxy',
  'controller-no-entity': 'pattern-proxy',
  'single-responsibility-proxy': 'pattern-proxy',
  'interface-segregation-proxy': 'pattern-proxy',
  'naming-conventions': 'pattern-proxy',
  'naming-services': 'pattern-proxy',
  'naming-repos': 'pattern-proxy',
  'naming-controllers': 'pattern-proxy',
  'test-file-pairing': 'pattern-proxy',
  'no-index-logic': 'pattern-proxy',
};

const TAGS: readonly TemplateTag[] = ['structural', 'topological', 'pattern-proxy'];

describe('template tags (BR-U1-27)', () => {
  it('(a) tag and requiredLayerKinds are required fields of CypherTemplate (typecheck)', () => {
    // Compile-time pins: removing either property from this literal type must fail Gate T.
    type IsRequired<K extends keyof CypherTemplate> = undefined extends CypherTemplate[K] ? false : true;
    const tagRequired: IsRequired<'tag'> = true;
    const kindsRequired: IsRequired<'requiredLayerKinds'> = true;
    expect([tagRequired, kindsRequired]).toEqual([true, true]);
  });

  it('the table covers exactly the 24 templates', () => {
    expect(Object.keys(TAG_TABLE).sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    expect(CYPHER_TEMPLATES.size).toBe(24);
  });

  it.each(Object.entries(TAG_TABLE))('(b) getTemplateTag(%s) = %s (§4.1, frozen)', (name, tag) => {
    expect(getTemplateTag(name)).toBe(tag);
    expect(CYPHER_TEMPLATES.get(name)?.tag).toBe(tag);
  });

  it('getTemplateTag of an unknown name is undefined', () => {
    expect(getTemplateTag('no-such-template')).toBeUndefined();
  });

  it('(c) listTemplatesByTag partitions the 24 templates 3 / 8 / 13, in insertion order', () => {
    const lists = TAGS.map((t) => listTemplatesByTag(t));
    expect(lists.map((l) => l.length)).toEqual([3, 8, 13]);
    const all = lists.flat();
    expect(new Set(all).size).toBe(24);
    expect([...all].sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    const order = [...CYPHER_TEMPLATES.keys()];
    for (const [i, t] of TAGS.entries()) {
      expect(lists[i]).toEqual(order.filter((n) => TAG_TABLE[n] === t));
    }
  });
});
