/**
 * Memory guard (Docs/v1.3/scale.md §6): stops a run only when live memory stays over budget after a full collection.
 */
import { HEAP_FRACTION, MEMORY_LIMIT_EXCEEDED, MemoryGuard, MemoryLimitError } from '../../../src/shared/process/memory-guard.js';

const MB = 1024 * 1024;

describe('MemoryGuard', () => {
  it('does nothing under budget and does not collect', () => {
    const collect = jest.fn();
    const guard = new MemoryGuard({ heapLimitBytes: 1000 * MB, read: () => ({ heapUsedBytes: 100 * MB, rssBytes: 200 * MB }), collect });
    expect(() => guard.check('node extraction')).not.toThrow();
    expect(collect).not.toHaveBeenCalled();
  });

  it('collects first and passes when the excess was garbage', () => {
    const readings = [{ heapUsedBytes: 990 * MB, rssBytes: 0 }, { heapUsedBytes: 300 * MB, rssBytes: 0 }];
    const collect = jest.fn();
    const guard = new MemoryGuard({ heapLimitBytes: 1000 * MB, read: () => readings.shift()!, collect });
    expect(() => guard.check('edge extraction')).not.toThrow();
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it('throws a clear MEMORY_LIMIT_EXCEEDED when the live heap stays over the budget', () => {
    const guard = new MemoryGuard({ heapLimitBytes: 1000 * MB, read: () => ({ heapUsedBytes: (HEAP_FRACTION * 1000 + 10) * MB, rssBytes: 0 }), collect: () => {} });
    let error: unknown;
    try {
      guard.check('edge extraction', '1840 of 9876 files');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(MemoryLimitError);
    expect((error as MemoryLimitError).code).toBe(MEMORY_LIMIT_EXCEEDED);
    expect((error as Error).message).toMatch(/^Project too large for the available memory: live heap 930 MB is over 92% of the 1000 MB Node heap limit during edge extraction \(1840 of 9876 files\)\./);
    expect((error as Error).message).toContain('--max-files');
    expect((error as Error).message).toContain('--max-old-space-size');
  });

  it('applies the RSS budget of --memory-limit-mb', () => {
    const guard = new MemoryGuard({ heapLimitBytes: 4000 * MB, rssLimitMb: 512, read: () => ({ heapUsedBytes: 100 * MB, rssBytes: 600 * MB }), collect: () => {} });
    expect(() => guard.check('graph ingestion')).toThrow(/resident memory 600 MB is over the --memory-limit-mb budget of 512 MB during graph ingestion/);
  });

  it('runs a real collection by default', () => {
    expect(() => new MemoryGuard({ heapLimitBytes: 1, read: () => ({ heapUsedBytes: 0, rssBytes: 0 }) }).check('x')).not.toThrow();
    const real = new MemoryGuard();
    expect(() => real.check('x')).not.toThrow();
  });
});
