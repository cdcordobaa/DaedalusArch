/**
 * Pure tests of the golden suite environment guards (FR-30, NFR-05). No Neo4j.
 * Dummy credentials only.
 */
import { isCiEnv, redactSecrets, redactUri, resolveGoldenEnv } from '../../golden/golden-env.js';

const DUMMY = 'dummy-not-real-pw';

describe('resolveGoldenEnv', () => {
  it('skips without NEO4J_PASSWORD and throws with GOLDEN_REQUIRED=1', () => {
    expect(resolveGoldenEnv({}).enabled).toBe(false);
    expect(() => resolveGoldenEnv({ GOLDEN_REQUIRED: '1' })).toThrow(/NEO4J_PASSWORD/);
  });

  it('refuses a non-local host unless GOLDEN_ALLOW_WIPE=1', () => {
    const env = { NEO4J_PASSWORD: DUMMY, NEO4J_URI: 'bolt://db.example.com:7687' };
    expect(() => resolveGoldenEnv(env)).toThrow(/wipes the database/);
    expect(resolveGoldenEnv({ ...env, GOLDEN_ALLOW_WIPE: '1' }).enabled).toBe(true);
  });

  it('refuses a URI with embedded credentials and never echoes them', () => {
    const env = { NEO4J_PASSWORD: DUMMY, NEO4J_URI: 'bolt://neo4j:SECRETX99@localhost:7687' };
    let message = '';
    try {
      resolveGoldenEnv(env);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/embedded credentials/);
    expect(message.includes('SECRETX99')).toBe(false);
    expect(message.includes('neo4j:')).toBe(false);
  });
});

describe('redactUri', () => {
  it('drops userinfo and keeps host and port', () => {
    expect(redactUri('bolt://neo4j:SECRETX99@db.example.com:7687')).toBe('bolt://db.example.com:7687');
    expect(redactUri('bolt://localhost:7687')).toBe('bolt://localhost:7687');
  });

  it('never echoes an unparseable URI', () => {
    expect(redactUri('bolt://neo4j:SECRET X@[bad')).toBe('bolt://<unparseable>');
  });
});

describe('redactSecrets', () => {
  it('removes the password and credentialed URI userinfo', () => {
    const text = `auth failed for neo4j://neo4j:${DUMMY}@localhost:7687 using ${DUMMY}`;
    const out = redactSecrets(text, DUMMY);
    expect(out.includes(DUMMY)).toBe(false);
    expect(out).toBe('auth failed for neo4j://<redacted>@localhost:7687 using <redacted>');
  });
});

describe('isCiEnv', () => {
  it.each([
    [undefined, false], ['', false], ['0', false], ['false', false], ['FALSE', false],
    ['true', true], ['1', true], ['yes', true],
  ])('CI=%p → %p', (value, expected) => {
    const env = value === undefined ? {} : { CI: value };
    expect(isCiEnv(env)).toBe(expected);
  });
});
