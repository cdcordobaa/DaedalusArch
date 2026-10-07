/**
 * NFR-07 contract (U0 Step 25, D-U0-5): Neo4jRepository.executeQuery forwards
 * an explicit per-query timeout to the driver and applies no default.
 */
const mockRun = jest.fn();
const mockClose = jest.fn();
const mockSession = jest.fn(() => ({ run: mockRun, close: mockClose }));
const mockDriverClose = jest.fn();

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: {
    driver: jest.fn(() => ({ session: mockSession, close: mockDriverClose })),
    auth: { basic: jest.fn(() => ({})) },
  },
}));

import { Neo4jRepository } from '../../../src/neo4j-ingestion/neo4j-repository.js';

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
    mockClose.mockResolvedValue(undefined);
    repo = new Neo4jRepository({ neo4jUri: 'bolt://localhost:7687', neo4jUser: 'neo4j', neo4jPassword: 'unit-test' });
  });

  it('without options calls run with exactly two arguments (no default timeout)', async () => {
    mockRun.mockResolvedValue(fakeResult());
    const result = await repo.executeQuery('RETURN 1 AS ok', { a: 1 });
    expect(result.success).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun.mock.calls[0]).toEqual(['RETURN 1 AS ok', { a: 1 }]);
    expect(mockRun.mock.calls[0]).toHaveLength(2);
  });

  it('with options lacking timeoutMs still calls run with exactly two arguments', async () => {
    mockRun.mockResolvedValue(fakeResult());
    await repo.executeQuery('RETURN 1 AS ok', undefined, {});
    expect(mockRun.mock.calls[0]).toHaveLength(2);
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
