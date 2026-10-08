/**
 * K6 (FR-35, NFR-07; BR-U1-28, BR-U1-02): bounded canonical cycle query, static checks.
 * The graph behaviour is checked against Neo4j in tests/golden/u1-templates.test.ts.
 */
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { CYCLE_ROW_CAP, CYPHER_TEMPLATES, MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';

function cycleTemplate(): CypherTemplate {
  const t = CYPHER_TEMPLATES.get('no-cyclic-deps');
  if (!t) throw new Error('no-cyclic-deps template missing');
  return t;
}
const cycle = cycleTemplate();

describe('no-cyclic-deps (BR-U1-28)', () => {
  it('pins MAX_CYCLE_LENGTH = 10 and CYCLE_ROW_CAP = 100 (frozen, BR-U1-02)', () => {
    expect(MAX_CYCLE_LENGTH).toBe(10);
    expect(CYCLE_ROW_CAP).toBe(100);
  });

  it('uses the literal bound *2..10 and the sentinel LIMIT 101, never a parameter', () => {
    const text = cycle.template;
    expect(text).toContain(`*2..${String(MAX_CYCLE_LENGTH)}]`);
    expect(text).toMatch(new RegExp(`LIMIT ${String(CYCLE_ROW_CAP + 1)}\\s*$`));
    expect(text).not.toMatch(/\*2\.\.\$/);
    expect(text).not.toMatch(/LIMIT \$/);
    expect(cycle.requiredParams).toEqual([]);
  });

  it('canonicalises rotation, keeps simple paths and de-duplicates before ORDER BY', () => {
    const text = cycle.template;
    expect(text).toContain('ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)');
    expect(text).toContain('size(apoc.coll.toSet(nodes(p)[1..])) = length(p)');
    const distinct = text.indexOf('WITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle');
    const order = text.indexOf('ORDER BY cycle');
    expect(distinct).toBeGreaterThan(-1);
    expect(order).toBeGreaterThan(distinct);
  });

  it('traverses IMPORTS only at K6 and keeps the message and filePathColumn', () => {
    expect(cycle.template).toContain('-[:IMPORTS*2..');
    expect(cycle.template).not.toContain('RE_EXPORTS');
    expect(cycle.resultMapping.filePathColumn).toBe('cycle');
    expect(cycle.resultMapping.messageTemplate).toBe('Circular dependency: {cycle}');
  });
});
