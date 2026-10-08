/**
 * NFR-07 contract (D-U0-5, U2 BR-U2-38): Neo4jRepository.executeQuery always
 * passes a transaction timeout to the driver: the per-query `timeoutMs`, else
 * the configured `queryTimeoutMs` (default 30 000 ms); writes use 120 000 ms.
 * BR-U2-41: the driver is created lazily, once, by the first query.
 */
const mockRun = jest.fn();
const mockClose = jest.fn();
const mockSession = jest.fn(() => ({ run: mockRun, close: mockClose }));
const mockDriverClose = jest.fn();

const mockDriver = jest.fn(() => ({ session: mockSession, close: mockDriverClose }));

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: {
    driver: (...args: unknown[]) => (mockDriver as (...a: unknown[]) => unknown)(...args),
    auth: { basic: jest.fn(() => ({})) },
  },
}));

import { Neo4jRepository } from '../../../src/neo4j-ingestion/neo4j-repository.js';
import { WRITE_QUERY_TIMEOUT_MS } from '../../../src/neo4j-ingestion/types.js';

function fakeResult(): unknown {
  return {
    records: [{ keys: ['ok'], get: (key: string) => (key === 'ok' ? 1 : undefined) }],
    summary: { counters: { updates: () => ({ nodesCreated: 2 }) } },
  };
}

describe('Neo4jRepository.executeQuery timeout plumbing (NFR-07, D-U0-5)', () => {
  let repo: Neo4jRepository;

  beforeEach(() => {
    mockRun.mockReset();
    mockClose.mockReset();
    mockSession.mockClear();
    mockDriver.mockClear();
    mockDriverClose.mockReset();
    mockClose.mockResolvedValue(undefined);
    repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jUser: 'neo4j', neo4jPassword: 'unit-test' });
  });

  it('without options passes the default { timeout: 30000 } (BR-U2-38)', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const result = await repo.executeQuery('RETURN 1 AS ok', { a: 1 });
    expect(result.success).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun.mock.calls[0]).toEqual(['RETURN 1 AS ok', { a: 1 }, { timeout: 30000 }]);
  });

  it('with options lacking timeoutMs still passes the default timeout', async () => {
    mockRun.mockResolvedValue(fakeResult());
    await repo.executeQuery('RETURN 1 AS ok', undefined, {});
    expect(mockRun.mock.calls[0]).toEqual(['RETURN 1 AS ok', undefined, { timeout: 30000 }]);
  });

  it('uses the configured queryTimeoutMs when the query gives none', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const configured = new Neo4jRepository({ neo4jPassword: 'unit-test', queryTimeoutMs: 7000 });
    await configured.executeQuery('RETURN 1 AS ok');
    expect(mockRun.mock.calls[0]).toEqual(['RETURN 1 AS ok', undefined, { timeout: 7000 }]);
  });

  it('clearGraph passes the write timeout { timeout: 120000 }', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const result = await repo.clearGraph();
    expect(result.success).toBe(true);
    expect(WRITE_QUERY_TIMEOUT_MS).toBe(120000);
    expect(mockRun.mock.calls[0]).toEqual(['MATCH (n) DETACH DELETE n', undefined, { timeout: 120000 }]);
  });

  it('with { timeoutMs: 500 } passes { timeout: 500 } as the third argument', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const result = await repo.executeQuery('RETURN 1 AS ok', {}, { timeoutMs: 500 });
    expect(result.success).toBe(true);
    expect(mockRun.mock.calls[0]).toEqual(['RETURN 1 AS ok', {}, { timeout: 500 }]);
  });

  it('maps records and counters on success and closes the session', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const result = await repo.executeQuery('RETURN 1 AS ok');
    expect(result).toEqual({ success: true, data: { records: [{ ok: 1 }], summary: { counters: { nodesCreated: 2 } } } });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('returns success: false with the driver error code when run rejects, and closes the session', async () => {
    const err = Object.assign(new Error('timed out'), { code: 'Neo.ClientError.Transaction.TransactionTimedOut' });
    mockRun.mockRejectedValue(err);
    const result = await repo.executeQuery('CALL x()', {}, { timeoutMs: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('Neo.ClientError.Transaction.TransactionTimedOut');
      expect(result.errors[0]?.message).toBe('timed out');
    }
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});

describe('Neo4jRepository lazy driver (BR-U2-41)', () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockClose.mockReset();
    mockSession.mockClear();
    mockDriver.mockClear();
    mockDriverClose.mockReset();
    mockClose.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockDriver.mockImplementation(() => ({ session: mockSession, close: mockDriverClose }));
  });

  it('creates no driver in the constructor', () => {
    new Neo4jRepository({ neo4jPassword: 'unit-test' });
    expect(mockDriver).not.toHaveBeenCalled();
  });

  it('six concurrent first calls create the driver once', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const repo = new Neo4jRepository({ neo4jPassword: 'unit-test' });
    const results = await Promise.all(Array.from({ length: 6 }, () => repo.executeQuery('RETURN 1 AS ok')));
    expect(results.every((r) => r.success)).toBe(true);
    expect(mockDriver).toHaveBeenCalledTimes(1);
    expect(mockSession).toHaveBeenCalledTimes(6);
  });

  it('a throwing neo4j.driver yields success: false, not an exception', async () => {
    mockDriver.mockImplementation(() => {
      throw Object.assign(new Error('bad url'), { code: 'ServiceUnavailable' });
    });
    const repo = new Neo4jRepository({ neo4jPassword: 'unit-test' });
    const result = await repo.executeQuery('RETURN 1 AS ok');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('ServiceUnavailable');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('a malformed URI does not throw at construction', () => {
    expect(() => new Neo4jRepository({ neo4jPassword: 'x'.repeat(9), neo4jUri: 'not a uri' })).not.toThrow();
  });

  it('close() before any query resolves without creating or closing a driver', async () => {
    const repo = new Neo4jRepository({ neo4jPassword: 'unit-test' });
    await expect(repo.close()).resolves.toBeUndefined();
    expect(mockDriver).not.toHaveBeenCalled();
    expect(mockDriverClose).not.toHaveBeenCalled();
  });

  it('close() after a query closes the driver', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const repo = new Neo4jRepository({ neo4jPassword: 'unit-test' });
    await repo.executeQuery('RETURN 1 AS ok');
    await repo.close();
    expect(mockDriverClose).toHaveBeenCalledTimes(1);
  });
});

// ── Scrubbed repository errors (NFR-05, D-U0-6; BR-U2-39, 40, 42; S-1, S-2) ──

function rejectWith(message: string, code?: string): void {
  mockRun.mockRejectedValue(code !== undefined ? Object.assign(new Error(message), { code }) : new Error(message));
}

async function failureOf(repo: Neo4jRepository): Promise<{ code: string | undefined; message: string | undefined }> {
  const result = await repo.executeQuery('RETURN 1 AS ok');
  expect(result.success).toBe(false);
  if (result.success) return { code: undefined, message: undefined };
  return { code: result.errors[0]?.code, message: result.errors[0]?.message };
}

function resetMocks(): void {
  mockRun.mockReset();
  mockClose.mockReset();
  mockSession.mockClear();
  mockDriver.mockClear();
  mockDriverClose.mockReset();
  mockClose.mockResolvedValue(undefined);
}

describe('Neo4jRepository scrubbed errors (BR-U2-39)', () => {
  beforeEach(resetMocks);

  it('a 5-character password (neo4j) is not a known secret; the text survives', async () => {
    rejectWith('auth failed for neo4j with neo4j');
    const repo = new Neo4jRepository({ neo4jUser: 'neo4j', neo4jPassword: 'neo4j' });
    expect((await failureOf(repo)).message).toBe('auth failed for neo4j with neo4j');
  });

  it('redacts a long password and the URI', async () => {
    rejectWith('pw s3cret-pass-123 at bolt://localhost:7687 failed');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    const { message } = await failureOf(repo);
    expect(message).not.toContain('s3cret-pass-123');
    expect(message).not.toContain('bolt://localhost:7687');
    expect(message).toBe('pw [REDACTED] at [REDACTED] failed');
  });

  it('redacts the explicit host:port of the URI', async () => {
    rejectWith('cannot reach localhost:7687 now');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(repo)).message).toBe('cannot reach [REDACTED] now');
  });

  it('a credentialed URI in a message keeps scheme and host', async () => {
    rejectWith('see bolt://u:p@h:7687');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(repo)).message).toBe('see bolt://[REDACTED]@h:7687');
  });

  it('redacts a resolved IPv4 address with the URI port (S-1)', async () => {
    rejectWith('connect ECONNREFUSED 127.0.0.1:7687', 'ServiceUnavailable');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    expect(await failureOf(repo)).toEqual({ code: 'ServiceUnavailable', message: 'connect ECONNREFUSED [REDACTED]' });
  });

  it('redacts a bare ::1 address with the URI port (S-1)', async () => {
    rejectWith('connect ECONNREFUSED ::1:7687');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(repo)).message).toBe('connect ECONNREFUSED [REDACTED]');
  });

  it('redacts a bracketed IPv6 address with the URI port (S-1)', async () => {
    rejectWith('connect ECONNREFUSED [fe80::1]:7687');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(repo)).message).toBe('connect ECONNREFUSED [REDACTED]');
  });

  it('uses 7687 when the URI names no port, and the URI port otherwise', async () => {
    rejectWith('connect ECONNREFUSED 127.0.0.1:7687');
    const noPort = new Neo4jRepository({ neo4jUri: 'bolt://localhost', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(noPort)).message).toBe('connect ECONNREFUSED [REDACTED]');
    rejectWith('connect ECONNREFUSED 127.0.0.1:7999 and 127.0.0.1:7687');
    const otherPort = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7999', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(otherPort)).message).toBe('connect ECONNREFUSED [REDACTED] and 127.0.0.1:7687');
  });

  it('an address on another port survives', async () => {
    rejectWith('http on 10.0.0.5:7474 is fine');
    const repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jPassword: 's3cret-pass-123' });
    expect((await failureOf(repo)).message).toBe('http on 10.0.0.5:7474 is fine');
  });

  it('never treats the user name or a scheme token as a secret', async () => {
    rejectWith('user neo4j-admin over neo4j+ssc');
    const repo = new Neo4jRepository({ neo4jUri: 'neo4j+ssc://db', neo4jUser: 'neo4j-admin', neo4jPassword: 'neo4j-admin' });
    expect((await failureOf(repo)).message).toBe('user neo4j-admin over neo4j+ssc');
  });
});

describe('Neo4jRepository failure paths (BR-U2-40, D-U0-6)', () => {
  beforeEach(resetMocks);
  afterEach(() => {
    mockDriver.mockImplementation(() => ({ session: mockSession, close: mockDriverClose }));
    mockSession.mockImplementation(() => ({ run: mockRun, close: mockClose }));
  });

  const cfg = { neo4jUri: 'bolt://localhost:7687', neo4jUser: 'neo4j', neo4jPassword: 's3cret-pass-123' };
  const leaky = 'Could not connect to bolt://neo4j:s3cret-pass-123@localhost:7687 (password s3cret-pass-123)';

  it('D-U0-6 acceptance: a driver error loses the password and the credentialed URI, keeps the code', async () => {
    rejectWith(leaky, 'ServiceUnavailable');
    const { code, message } = await failureOf(new Neo4jRepository(cfg));
    expect(code).toBe('ServiceUnavailable');
    expect(message).not.toContain('s3cret-pass-123');
    expect(message).not.toContain('neo4j:s3cret');
    expect(message).not.toContain('bolt://neo4j:');
    expect(message).toContain('Could not connect to bolt://[REDACTED]@');
  });

  it('an error without a code becomes UNEXPECTED_ERROR', async () => {
    rejectWith('boom');
    expect((await failureOf(new Neo4jRepository(cfg))).code).toBe('UNEXPECTED_ERROR');
  });

  it('a throwing neo4j.driver gives a scrubbed failure with the original code', async () => {
    mockDriver.mockImplementation(() => {
      throw Object.assign(new Error(leaky), { code: 'Neo.ClientError.Security.Unauthorized' });
    });
    const { code, message } = await failureOf(new Neo4jRepository(cfg));
    expect(code).toBe('Neo.ClientError.Security.Unauthorized');
    expect(message).not.toContain('s3cret-pass-123');
    expect(message).not.toContain('localhost:7687');
  });

  it('a throwing driver.session() gives a scrubbed failure with the original code', async () => {
    mockSession.mockImplementation(() => {
      throw Object.assign(new Error(leaky), { code: 'SessionExpired' });
    });
    const { code, message } = await failureOf(new Neo4jRepository(cfg));
    expect(code).toBe('SessionExpired');
    expect(message).not.toContain('s3cret-pass-123');
    expect(message).not.toContain('localhost:7687');
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('session.close() failing after a successful run keeps the data and adds one scrubbed warning (S-2)', async () => {
    mockRun.mockResolvedValue(fakeResult());
    mockClose.mockRejectedValue(new Error('close failed for s3cret-pass-123 at 127.0.0.1:7687'));
    const result = await new Neo4jRepository(cfg).executeQuery('RETURN 1 AS ok');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ records: [{ ok: 1 }], summary: { counters: { nodesCreated: 2 } } });
      expect(result.warnings).toEqual([{ code: 'REPO_SESSION_CLOSE_FAILED', message: 'close failed for [REDACTED] at [REDACTED]' }]);
    }
  });

  it('session.close() failing after a failed run returns the run error only', async () => {
    rejectWith('run failed', 'Neo.ClientError.Statement.SyntaxError');
    mockClose.mockRejectedValue(new Error('close failed'));
    const result = await new Neo4jRepository(cfg).executeQuery('RETURN 1 AS ok');
    expect(result).toEqual({ success: false, errors: [{ code: 'Neo.ClientError.Statement.SyntaxError', message: 'run failed' }] });
  });
});

describe('Neo4jRepository keeps the golden EVAL_001 texts byte-identical (BR-U2-42)', () => {
  beforeEach(resetMocks);

  // The seven EVAL_001 texts of the golden baseline (GOLDEN_BASE f5fed3f). U1 K2 (FR-07, FR-08) binds the
  // parameters, so the committed snapshots no longer carry them; the texts are pinned here verbatim.
  const texts = new Set<string>([
    'Query failed for domain-purity: Expected parameter(s): forbiddenImports',
    'Query failed for inheritance-depth: Expected parameter(s): maxDepth',
    'Query failed for interface-segregation-proxy: Expected parameter(s): maxInterfaceMethods',
    'Query failed for naming-controllers: Expected parameter(s): pattern',
    'Query failed for naming-repos: Expected parameter(s): pattern',
    'Query failed for naming-services: Expected parameter(s): pattern',
    'Query failed for single-responsibility-proxy: Expected parameter(s): maxPublicMethods, maxDependencies',
  ]);

  it('pins the seven EVAL_001 texts of the golden baseline', () => {
    expect(texts.size).toBe(7);
  });

  it.each(['neo4j', 'test-password', 'test-password-123'])('passes every text through unchanged with password %s', async (password) => {
    const repo = new Neo4jRepository({ neo4jUser: 'neo4j', neo4jPassword: password });
    for (const text of texts) {
      rejectWith(text, 'Neo.ClientError.Statement.ParameterMissing');
      expect((await failureOf(repo)).message).toBe(text);
    }
  });
});
