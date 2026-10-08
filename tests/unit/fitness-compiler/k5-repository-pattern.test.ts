/**
 * U1 K5 (ADR-015 item 1, BR-U1-45): `repository-pattern` reports only violations.
 */
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';

describe('BR-U1-45 (b): repository-pattern keeps only the violating branch', () => {
  const t = CYPHER_TEMPLATES.get('repository-pattern');
  if (!t) throw new Error('repository-pattern template missing');

  it('has no UNION and no compliant IMPLEMENTS-to-interface match', () => {
    expect(t.template).not.toMatch(/\bUNION\b/);
    expect(t.template).not.toContain(':IMPLEMENTS]->(i:Interface)');
  });

  it('matches infrastructure Repository/Repo classes that implement no interface', () => {
    expect(t.template).toContain('WHERE c.layer = $infraLayer');
    expect(t.template).toContain("(c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')");
    expect(t.template).toContain('NOT EXISTS { MATCH (c)-[:IMPLEMENTS]->(:Interface) }');
  });

  it('keeps the row shape, result mapping, requiredParams and requiredLayerKinds', () => {
    expect(t.template).toContain("RETURN '' AS interface, c.name AS implementation, c.filePath AS filePath");
    expect(t.resultMapping).toEqual({ filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: [] });
    expect(t.requiredParams).toEqual(['domainLayer', 'infraLayer']);
    expect(t.requiredLayerKinds).toEqual(['domain', 'infrastructure']);
  });
});
