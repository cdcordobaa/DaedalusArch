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
