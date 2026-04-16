import { injectExcludePaths } from '../../../src/fitness-compiler/exclude-injector.js';

describe('injectExcludePaths', () => {
  const simpleCypher = `MATCH (source)-[:IMPORTS]->(target) WHERE source.layer = 'domain' AND target.layer = 'infrastructure' RETURN source.filePath AS violator`;

  it('returns unchanged cypher when excludePaths is empty', () => {
    const result = injectExcludePaths(simpleCypher, []);
    expect(result.cypher).toBe(simpleCypher);
    expect(result.additionalParams).toEqual({});
  });

  it('injects NONE clause before RETURN', () => {
    const result = injectExcludePaths(simpleCypher, ['src/cli/**']);
    expect(result.cypher).toContain('NONE(ep IN $excludePatterns WHERE source.filePath =~ ep)');
    expect(result.cypher).toContain('RETURN source.filePath AS violator');
    expect(result.additionalParams).toHaveProperty('excludePatterns');
  });

  it('converts glob patterns to regex in params', () => {
    const result = injectExcludePaths(simpleCypher, ['src/cli/**', '**/*.spec.ts']);
    const patterns = result.additionalParams['excludePatterns'] as string[];
    expect(patterns).toHaveLength(2);
    expect(patterns[0]).toMatch(/^\^/); // anchored
    expect(patterns[0]).toMatch(/\$$/); // anchored
  });

  it('detects node alias from RETURN clause', () => {
    const cypherWithN = `MATCH (n:File) WHERE n.layer = 'domain' RETURN n.filePath AS path`;
    const result = injectExcludePaths(cypherWithN, ['src/cli/**']);
    expect(result.cypher).toContain('n.filePath =~ ep');
  });

  it('defaults to source alias when no filePath in RETURN', () => {
    const cypherNoPath = `MATCH (a)-[:IMPORTS]->(b) WHERE a.layer = 'domain' RETURN count(a) AS total`;
    const result = injectExcludePaths(cypherNoPath, ['src/cli/**']);
    expect(result.cypher).toContain('source.filePath =~ ep');
  });

  it('handles multiple exclude patterns', () => {
    const result = injectExcludePaths(simpleCypher, [
      'src/pipeline/pipeline-factory.ts',
      'src/cli/**',
      '**/*.spec.ts',
    ]);
    const patterns = result.additionalParams['excludePatterns'] as string[];
    expect(patterns).toHaveLength(3);
  });
});
