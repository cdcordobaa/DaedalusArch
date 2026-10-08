/**
 * Pure tests of the golden suite environment guards (FR-30, NFR-05). No Neo4j.
 * Dummy credentials only.
 */
import {
  isCiEnv,
  passwordRuleViolation,
  readSnapshotTexts,
  redactSecrets,
  redactUri,
  resolveGoldenEnv,
} from '../../golden/golden-env.js';

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

describe('resolveGoldenEnv password guard (BR-U2-43, Q14 A)', () => {
  const snapshots = readSnapshotTexts();

  function messageOf(fn: () => unknown): string {
    try {
      fn();
    } catch (e) {
      return (e as Error).message;
    }
    return '';
  }

  it('reads the committed golden snapshots', () => {
    expect(snapshots.length).toBe(5);
  });

  it('throws for a password shorter than 8 characters under GOLDEN_REQUIRED=1, naming the rule only', () => {
    const message = messageOf(() => resolveGoldenEnv({ NEO4J_PASSWORD: 'short', GOLDEN_REQUIRED: '1' }, snapshots));
    expect(message).toMatch(/shorter than 8 characters/);
    expect(message.replace('shorter', '').includes('short')).toBe(false);
  });

  // A string every committed snapshot contains (a snapshot key). The BR-U2-43 example `forbiddenImports`
  // left the committed snapshots at U1 K2 (its EVAL_001 text is gone), so it is checked against a
  // golden-baseline text passed explicitly.
  const IN_SNAPSHOT = 'ahsDeterministic';
  const BASELINE_TEXT = '{"code":"EVAL_001","message":"Query failed for domain-purity: Expected parameter(s): forbiddenImports"}';

  it('throws for a password contained in a committed snapshot, naming the rule only', () => {
    expect(snapshots.every((t) => t.includes(IN_SNAPSHOT))).toBe(true);
    const message = messageOf(() =>
      resolveGoldenEnv({ NEO4J_PASSWORD: IN_SNAPSHOT, GOLDEN_REQUIRED: '1' }, snapshots));
    expect(message).toMatch(/committed golden snapshot/);
    expect(message.includes(IN_SNAPSHOT)).toBe(false);
  });

  it('throws for forbiddenImports when a snapshot text contains it (BR-U2-43 example), naming the rule only', () => {
    const message = messageOf(() =>
      resolveGoldenEnv({ NEO4J_PASSWORD: 'forbiddenImports', GOLDEN_REQUIRED: '1' }, [BASELINE_TEXT]));
    expect(message).toMatch(/committed golden snapshot/);
    expect(message.includes('forbiddenImports')).toBe(false);
  });

  it('skips (does not throw) without GOLDEN_REQUIRED, with a reason naming the rule only', () => {
    for (const pw of ['short', IN_SNAPSHOT]) {
      const env = resolveGoldenEnv({ NEO4J_PASSWORD: pw }, snapshots);
      expect(env.enabled).toBe(false);
      if (env.enabled) continue;
      expect(env.reason.replace('shorter', '').includes(pw)).toBe(false);
    }
  });

  it.each(['test-password', 'test-password-123'])('accepts %p (CI value and a long dummy)', (pw) => {
    const env = resolveGoldenEnv({ NEO4J_PASSWORD: pw, GOLDEN_REQUIRED: '1' }, snapshots);
    expect(env.enabled).toBe(true);
    expect(passwordRuleViolation(pw, snapshots)).toBeUndefined();
  });

  it('reads the snapshots by default when no texts are passed', () => {
    expect(() => resolveGoldenEnv({ NEO4J_PASSWORD: IN_SNAPSHOT, GOLDEN_REQUIRED: '1' })).toThrow(/snapshot/);
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
