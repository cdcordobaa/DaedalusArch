/**
 * K13 (FR-09 template part, FR-34; BR-U1-34 a; U1 Q19 A, U2 Q16 A): a file is connected when it has an
 * IMPORTS or RE_EXPORTS relationship to or from a `:File`; Package targets do not count; barrels stay
 * excluded. Graph behaviour (BR-U1-34 b) is checked in tests/golden/u1-templates.test.ts.
 */
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';

function orphanTemplate(): CypherTemplate {
  const t = CYPHER_TEMPLATES.get('no-orphan-files');
  if (!t) throw new Error('no-orphan-files template missing');
  return t;
}
const orphan = orphanTemplate();

describe('no-orphan-files (BR-U1-34)', () => {
  it('(a) both directions are typed :File and follow IMPORTS|RE_EXPORTS', () => {
    expect(orphan.template).toContain('NOT EXISTS { MATCH (f)-[:IMPORTS|RE_EXPORTS]->(:File) }');
    expect(orphan.template).toContain('NOT EXISTS { MATCH (:File)-[:IMPORTS|RE_EXPORTS]->(f) }');
    expect(orphan.template).not.toMatch(/-\[:IMPORTS\]->\(\)|\(\)-\[:IMPORTS\]->/);
  });

  it('keeps the layer filter, the barrel exclusion with its anchor, and the row shape (business-logic-model.md §5.1)', () => {
    expect(orphan.template).toBe(`MATCH (f:File)
WHERE f.layer IS NOT NULL
  AND NOT EXISTS { MATCH (f)-[:IMPORTS|RE_EXPORTS]->(:File) }
  AND NOT EXISTS { MATCH (:File)-[:IMPORTS|RE_EXPORTS]->(f) }
  AND NOT f.isBarrel /*EXCLUDE:f*/
RETURN f.filePath AS filePath, f.name AS name, f.layer AS layer
ORDER BY filePath`);
    expect(orphan.requiredParams).toEqual([]);
    expect(orphan.tag).toBe('topological');
  });
});
