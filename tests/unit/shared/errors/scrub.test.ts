/**
 * Secret scrubber (U0 Step 27, NFR-05, NFR-08): every property listed in the
 * U0 NFR note section 3 (NFR-05), plus a seeded 500-iteration generated-text check.
 */
import {
  REDACTED,
  scrubDeep,
  scrubSecrets,
  scrubWarning,
} from '../../../../src/shared/errors/scrub.js';
import type { DomainWarning } from '../../../../src/shared/errors/domain-result.js';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
  }
  return value;
}

/** mulberry32: small deterministic PRNG so the generated check is reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('REDACTED', () => {
  it('is the literal redaction token', () => {
    expect(REDACTED).toBe('[REDACTED]');
  });
});

describe('scrubSecrets — known secrets', () => {
  it('redacts every occurrence of a known secret', () => {
    expect(scrubSecrets('auth failed for s3cr3tPass, retry s3cr3tPass', ['s3cr3tPass'])).toBe(
      `auth failed for ${REDACTED}, retry ${REDACTED}`,
    );
  });

  it('ignores empty and whitespace-only known secrets', () => {
    const text = 'a b  c\td';
    expect(scrubSecrets(text, ['', ' ', '\t', '   '])).toBe(text);
  });

  it('matches secrets with regex metacharacters literally', () => {
    const secret = 'p.a$s*(w)[o]r+d?^|\\';
    expect(scrubSecrets(`x ${secret} y`, [secret])).toBe(`x ${REDACTED} y`);
    // the metacharacters are not interpreted: a string the "regex" would match stays
    expect(scrubSecrets('x pXaas y', [secret])).toBe('x pXaas y');
  });

  it('removes overlapping secrets completely', () => {
    const out = scrubSecrets('pre abcdefghi post', ['abcdef', 'defghi']);
    expect(out).toBe(`pre ${REDACTED} post`);
    expect(out).not.toMatch(/abc|ghi/);
  });

  it('removes a secret that contains a shorter secret (longest first)', () => {
    const out = scrubSecrets('k=xyz, long=xyz123456', ['xyz', 'xyz123456']);
    expect(out).not.toContain('xyz');
    expect(out).not.toContain('123456');
  });

  it('removes overlapping occurrences of the same secret', () => {
    expect(scrubSecrets('aaaa', ['aaa'])).toBe(REDACTED);
  });

  it('does not rewrite an existing token even when a secret occurs inside it', () => {
    expect(scrubSecrets(`value ${REDACTED} RED`, ['RED'])).toBe(`value ${REDACTED} ${REDACTED}`);
  });
});

describe('scrubSecrets — credential shapes', () => {
  it.each([
    ['bolt'],
    ['neo4j'],
    ['neo4j+s'],
    ['neo4j+ssc'],
    ['http'],
    ['https'],
  ])('redacts user:pass in a %s URI and keeps scheme and host', (scheme) => {
    expect(scrubSecrets(`connect ${scheme}://neo4j:hunter2@db.example:7687/x failed`, [])).toBe(
      `connect ${scheme}://${REDACTED}@db.example:7687/x failed`,
    );
  });

  it('redacts a URI password that contains @', () => {
    expect(scrubSecrets('bolt://neo4j:p@ss@localhost:7687', [])).toBe(`bolt://${REDACTED}@localhost:7687`);
  });

  it('leaves a URI without credentials unchanged', () => {
    const text = 'bolt://localhost:7687 and https://example.com:8080/a@b';
    expect(scrubSecrets(text, [])).toBe(text);
  });

  it('redacts bearer tokens', () => {
    expect(scrubSecrets('Authorization: Bearer eyJhbGciOi.payload.sig', [])).toBe(
      `Authorization: Bearer ${REDACTED}`,
    );
  });

  it('redacts Anthropic, OpenAI and Google key shapes', () => {
    const anthropic = 'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    const openai = 'sk-proj1234567890abcdefghijKLMNOP';
    const google = 'AIzaSyA1234567890abcdefghijklmnopqrstu';
    expect(scrubSecrets(`keys: ${anthropic} ${openai} ${google}.`, [])).toBe(
      `keys: ${REDACTED} ${REDACTED} ${REDACTED}.`,
    );
  });

  it.each([
    ['password=hunter2', `password=${REDACTED}`],
    ['apiKey=abc123', `apiKey=${REDACTED}`],
    ['api_key=abc123', `api_key=${REDACTED}`],
    ['token=abc123', `token=${REDACTED}`],
    ['NEO4J_PASSWORD=hunter2', `NEO4J_PASSWORD=${REDACTED}`],
    ['password="two words"', `password=${REDACTED}`],
    ["token='quoted'", `token=${REDACTED}`],
  ])('redacts the value in %s', (input, expected) => {
    expect(scrubSecrets(`cfg ${input} end`, [])).toBe(`cfg ${expected} end`);
  });

  it('redacts a key=value pair inside a query string and keeps the rest', () => {
    expect(scrubSecrets('https://h/p?user=bob&token=abc123&x=1', [])).toBe(
      `https://h/p?user=bob&token=${REDACTED}&x=1`,
    );
  });
});

describe('scrubSecrets — benign text and idempotence', () => {
  const benign = [
    '/Users/dev/project/src/domain/order.ts',
    'C:\\work\\repo\\src\\infrastructure\\db.ts',
    "Layer 'domain' must not depend on 'infrastructure' (src/domain/a.ts -> src/infrastructure/b.ts)",
    'Cyclic dependency: src/a.ts -> src/b.ts -> src/a.ts',
    'maxTokens=1000, temperature=0.2, tokens used: 532',
    'bolt://localhost:7687',
    'Function no-cyclic-deps returned 3 rows; ask-sk-learn; AIza short',
    'Bearer short',
    'EVAL_001: Neo.ClientError.Statement.SyntaxError at line 4',
  ];

  it.each(benign.map((text) => [text]))('leaves %s byte-identical', (text) => {
    expect(scrubSecrets(text, [])).toBe(text);
    expect(scrubSecrets(text, ['not-present-secret'])).toBe(text);
  });

  it('is idempotent on redacted output', () => {
    const inputs = [
      'bolt://neo4j:hunter2@h:7687 password=hunter2 Bearer abcdefghijkl sk-ant-abcdefghijklmnop',
      'RED RED [REDACTED] RED',
      'token=[REDACTED] and password=',
    ];
    for (const input of inputs) {
      const once = scrubSecrets(input, ['hunter2', 'RED', 'ACT']);
      expect(scrubSecrets(once, ['hunter2', 'RED', 'ACT'])).toBe(once);
    }
  });
});

describe('scrubSecrets — seeded generated text (500 iterations)', () => {
  it('never leaks an inserted secret, is idempotent, and keeps secret-free text unchanged', () => {
    const rand = prng(20261007);
    const pick = (alphabet: string): string => alphabet.charAt(Math.floor(rand() * alphabet.length));
    const benignAlphabet = 'abcdefghijklmnopqrstuvwxyz ABCXYZ0123456789/._-:\n';
    const secretAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%^*()+?|.';

    for (let iteration = 0; iteration < 500; iteration++) {
      let text = '';
      const length = Math.floor(rand() * 120);
      for (let i = 0; i < length; i++) {
        text += pick(benignAlphabet);
      }
      expect(scrubSecrets(text, [])).toBe(text);

      let secret = '';
      const secretLength = 8 + Math.floor(rand() * 17);
      for (let i = 0; i < secretLength; i++) {
        secret += pick(secretAlphabet);
      }
      const inserts = 1 + Math.floor(rand() * 3);
      let withSecret = text;
      for (let i = 0; i < inserts; i++) {
        const at = Math.floor(rand() * (withSecret.length + 1));
        withSecret = withSecret.slice(0, at) + secret + withSecret.slice(at);
      }

      const once = scrubSecrets(withSecret, [secret]);
      for (const segment of once.split(REDACTED)) {
        expect(segment).not.toContain(secret);
      }
      expect(scrubSecrets(once, [secret])).toBe(once);
    }
  });
});

describe('scrubWarning', () => {
  it('keeps code, scrubs message and every string in context', () => {
    const warning: DomainWarning = {
      code: 'NEO4J_QUERY_FAILED',
      message: 'cannot reach bolt://neo4j:hunter2@db:7687 (hunter2)',
      context: {
        uri: 'bolt://neo4j:hunter2@db:7687',
        attempts: 3,
        nested: { detail: 'pw hunter2', list: ['ok', 'hunter2'] },
      },
    };
    const out = scrubWarning(deepFreeze(warning), ['hunter2']);
    expect(out.code).toBe('NEO4J_QUERY_FAILED');
    expect(out.message).toBe(`cannot reach bolt://${REDACTED}@db:7687 (${REDACTED})`);
    expect(out.context).toEqual({
      uri: `bolt://${REDACTED}@db:7687`,
      attempts: 3,
      nested: { detail: `pw ${REDACTED}`, list: ['ok', REDACTED] },
    });
    expect(warning.message).toContain('hunter2');
  });

  it('keeps extra fields of a warning subtype and works without context', () => {
    const warning = { code: 'W', message: 'token=abc', stage: 'scoring' };
    const out = scrubWarning(warning, []);
    expect(out).toEqual({ code: 'W', message: `token=${REDACTED}`, stage: 'scoring' });
    expect('context' in out).toBe(false);
  });
});

describe('scrubDeep', () => {
  it('returns a deep copy and never mutates frozen input', () => {
    const input = deepFreeze({
      a: 'secret-1',
      b: { c: ['x', 'secret-1', { d: 'y secret-1' }] },
    });
    const out = scrubDeep(input, ['secret-1']);
    expect(out).toEqual({ a: REDACTED, b: { c: ['x', REDACTED, { d: `y ${REDACTED}` }] } });
    expect(out).not.toBe(input);
    expect(out.b).not.toBe(input.b);
    expect(out.b.c).not.toBe(input.b.c);
    expect(input.a).toBe('secret-1');
  });

  it('copies a secret-free structure equal but not identical', () => {
    const input = { list: [1, 2, { s: 'plain' }] };
    const out = scrubDeep(input, []);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out.list).not.toBe(input.list);
  });

  it('leaves non-strings untouched', () => {
    const date = new Date(0);
    const input = { n: 1, b: true, nil: null, u: undefined, big: 10n, date };
    const out = scrubDeep(input, ['1', 'true']);
    expect(out.n).toBe(1);
    expect(out.b).toBe(true);
    expect(out.nil).toBeNull();
    expect(out.u).toBeUndefined();
    expect(out.big).toBe(10n);
    expect(out.date).toBe(date);
  });

  it('scrubs a top-level string and a top-level array', () => {
    expect(scrubDeep('pw=hunter2', ['hunter2'])).toBe(`pw=${REDACTED}`);
    expect(scrubDeep(['hunter2', 1], ['hunter2'])).toEqual([REDACTED, 1]);
  });

  it('replaces a cyclic reference with [Circular]', () => {
    interface Node {
      name: string;
      self?: Node;
      children: Node[];
    }
    const root: Node = { name: 'root hunter2', children: [] };
    root.self = root;
    root.children.push(root);
    const out = scrubDeep(root, ['hunter2']) as unknown as Record<string, unknown>;
    expect(out).toEqual({ name: `root ${REDACTED}`, self: '[Circular]', children: ['[Circular]'] });
  });

  it('copies a shared (non-cyclic) reference twice', () => {
    const shared = { s: 'hunter2' };
    const out = scrubDeep({ a: shared, b: shared }, ['hunter2']);
    expect(out).toEqual({ a: { s: REDACTED }, b: { s: REDACTED } });
  });
});
