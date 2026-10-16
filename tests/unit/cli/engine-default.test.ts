/**
 * v1.3 npx mode: graph-engine default of the evaluating commands (src/cli/engine-default.ts).
 */
import { engineLine, resolveEngine, resolveEngineForCli } from '../../../src/cli/engine-default.js';

describe('resolveEngine', () => {
  it('--engine wins over everything', () => {
    expect(resolveEngine({ flag: 'neo4j', env: {} })).toEqual({ engine: 'neo4j', source: 'flag' });
    expect(resolveEngine({ flag: 'cypher-interp', neo4jUriFlag: true, env: { NEO4J_URI: 'bolt://h' } })).toEqual({ engine: 'cypher-interp', source: 'flag' });
  });

  it('an explicit --neo4j-uri or a non-empty NEO4J_URI selects neo4j', () => {
    expect(resolveEngine({ neo4jUriFlag: true, env: {} })).toEqual({ engine: 'neo4j', source: 'neo4j-uri-flag' });
    expect(resolveEngine({ env: { NEO4J_URI: 'bolt://h:7687' } })).toEqual({ engine: 'neo4j', source: 'neo4j-uri-env' });
  });

  it('no NEO4J_URI (unset or empty) selects cypher-interp, whatever else is set', () => {
    expect(resolveEngine({ env: {} })).toEqual({ engine: 'cypher-interp', source: 'no-neo4j-uri' });
    expect(resolveEngine({ env: { NEO4J_URI: '', NEO4J_PASSWORD: 'x' } })).toEqual({ engine: 'cypher-interp', source: 'no-neo4j-uri' });
  });

  it('an unknown engine is refused', () => {
    expect(resolveEngine({ flag: 'memory', env: {} })).toBeUndefined();
  });
});

describe('engine line', () => {
  it('names the engine and the reason, never a URI', () => {
    const line = engineLine({ engine: 'neo4j', source: 'neo4j-uri-env' });
    expect(line).toBe('daedalus: graph engine neo4j (reference engine) [NEO4J_URI is set]\n');
    expect(engineLine({ engine: 'cypher-interp', source: 'no-neo4j-uri' })).toMatch(/^daedalus: graph engine cypher-interp .*--engine neo4j.*\n$/);
  });

  it('resolveEngineForCli writes exactly one line, or the error and exit code 2', () => {
    const out: string[] = [];
    expect(resolveEngineForCli({ env: { NEO4J_URI: 'bolt://secret-host:7687' } }, (s) => out.push(s))).toBe('neo4j');
    expect(out).toHaveLength(1);
    expect(out[0]).not.toContain('secret-host');
    const prev = process.exitCode;
    const err: string[] = [];
    expect(resolveEngineForCli({ flag: 'bogus', env: {} }, (s) => err.push(s))).toBeUndefined();
    expect(err[0]).toContain('--engine must be one of neo4j | cypher-interp');
    expect(process.exitCode).toBe(2);
    process.exitCode = prev;
  });
});
