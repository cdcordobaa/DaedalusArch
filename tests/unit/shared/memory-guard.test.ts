/**
 * Memory guard (Docs/v1.3/scale.md §6): stops a run only when live memory stays over budget after a full collection.
 */
import { CHECKER_HEAP_GROWTH, HEAP_FRACTION, MEMORY_LIMIT_EXCEEDED, MemoryGuard, MemoryLimitError } from '../../../src/shared/process/memory-guard.js';

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
    expect((error as Error).message).toMatch(/^Project too large for the available memory: live heap 960 MB is over 95% of the 1000 MB Node heap limit during edge extraction \(1840 of 9876 files\)\./);
    expect((error as Error).message).toContain('--max-files');
    expect((error as Error).message).toContain('--max-old-space-size');
  });

  it('applies the RSS budget of --memory-limit-mb', () => {
    const guard = new MemoryGuard({ heapLimitBytes: 4000 * MB, rssLimitMb: 512, read: () => ({ heapUsedBytes: 100 * MB, rssBytes: 600 * MB }), collect: () => {} });
    expect(() => guard.check('graph ingestion')).toThrow(/resident memory 600 MB is over the --memory-limit-mb budget of 512 MB during graph ingestion/);
  });

  it('checkProjected: stops before an uninterruptible step whose lower-bound growth passes the heap limit', () => {
    const read = (heap: number) => () => ({ heapUsedBytes: heap * MB, rssBytes: 0 });
    const collect = jest.fn();
    expect(() => new MemoryGuard({ heapLimitBytes: 1000 * MB, read: read(700), collect }).checkProjected('type checker creation', CHECKER_HEAP_GROWTH)).not.toThrow();
    expect(collect).not.toHaveBeenCalled();
    expect(() => new MemoryGuard({ heapLimitBytes: 1000 * MB, read: read(800), collect: () => {} }).checkProjected('type checker creation', CHECKER_HEAP_GROWTH, '5961 files loaded'))
      .toThrow(/^Project too large for the available memory: live heap 800 MB needs at least 1120 MB for type checker creation \(5961 files loaded\), over the 1000 MB Node heap limit\./);
    const readings = [{ heapUsedBytes: 800 * MB, rssBytes: 0 }, { heapUsedBytes: 500 * MB, rssBytes: 0 }];
    expect(() => new MemoryGuard({ heapLimitBytes: 1000 * MB, read: () => readings.shift()!, collect: () => {} }).checkProjected('x', CHECKER_HEAP_GROWTH)).not.toThrow();
  });

  it('checkAhead: stops before parsing when the lower-bound need passes the heap limit', () => {
    const guard = new MemoryGuard({ heapLimitBytes: 1000 * MB, read: () => ({ heapUsedBytes: 100 * MB, rssBytes: 0 }), collect: () => {} });
    expect(() => guard.checkAhead(850 * MB, '10 files')).not.toThrow();
    expect(() => guard.checkAhead(950 * MB, '10 files')).toThrow(/need at least 950 MB/);
    expect(() => guard.checkAhead(950 * MB, '5961 TypeScript files (39 MB of source)'))
      .toThrow(/^Project too large for the available memory: 5961 TypeScript files \(39 MB of source\) need at least 950 MB of heap, over the 1000 MB Node heap limit\./);
  });

  it('does not force collections back to back (V8 would abort on ineffective mark-compacts)', () => {
    let t = 0;
    const collect = jest.fn(() => { t += 100; });
    const readings = [990, 300, 990, 990, 300];
    const guard = new MemoryGuard({ heapLimitBytes: 1000 * MB, read: () => ({ heapUsedBytes: (readings.shift() ?? 0) * MB, rssBytes: 0 }), collect, now: () => t });
    guard.check('a'); // over -> collect (100 ms) -> 300: passes
    t += 50;
    guard.check('b'); // over, but only 50 ms after a 100 ms collection: no collection, no verdict yet
    expect(collect).toHaveBeenCalledTimes(1);
    t += 400;
    guard.check('c'); // over -> collect -> 300: passes
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('runs a real collection by default', () => {
    expect(() => new MemoryGuard({ heapLimitBytes: 1, read: () => ({ heapUsedBytes: 0, rssBytes: 0 }) }).check('x')).not.toThrow();
    const real = new MemoryGuard();
    expect(() => real.check('x')).not.toThrow();
  });
});
