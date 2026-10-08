/**
 * BR-U3-66 cross-unit check (U3 handoff H4, added by the unit that merges second): every discriminator column a
 * U3 template reports, plus the SCC key's `scc`, is expressible as a U5a `LocationRule.discriminator` value
 * (`DISCRIMINATOR_COLUMNS`, DV-U5a-13). Test code may import `src/` (BR-U5a-06 restricts `scripts/lib/mutation/**`).
 */
import { TEMPLATE_DISCRIMINATORS } from '../../../../src/fitness-compiler/cypher-templates.js';
import { DISCRIMINATOR_COLUMNS } from '../../../../scripts/lib/mutation/types.js';

describe('U3 discriminator columns ⊆ U5a selector enum (BR-U3-66; H4)', () => {
  it('⋃ TEMPLATE_DISCRIMINATORS ∪ {scc} ⊆ DISCRIMINATOR_COLUMNS', () => {
    const union = new Set<string>(Object.values(TEMPLATE_DISCRIMINATORS).flat());
    union.add('scc');
    const known = new Set<string>(DISCRIMINATOR_COLUMNS);
    expect([...union].filter((c) => !known.has(c)).sort()).toEqual([]);
  });

  it('domain-state-purity reports [class, targetName, relType, field] (MO-DF01 and SP-DF01-ci keys)', () => {
    expect(TEMPLATE_DISCRIMINATORS['domain-state-purity']).toEqual(['class', 'targetName', 'relType', 'field']);
  });
});
