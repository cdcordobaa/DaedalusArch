/**
 * Memory guard for large projects (Docs/v1.3/scale.md §6).
 *
 * Without a guard, a project too big for the Node heap ends in V8's "JavaScript heap out of memory" abort: no report,
 * no hint. The guard is checked at checkpoints (between files of the extraction passes, between pipeline stages) and
 * stops the run with a `MEMORY_LIMIT_EXCEEDED` error that says what to do instead.
 *
 * Two budgets:
 * - the heap budget (always on): live heap above `HEAP_FRACTION` of V8's heap limit. Garbage is not live data, so
 *   before failing the guard forces a full collection and measures again; a run fails only when the live heap
 *   itself is that close to the limit, where V8 would abort soon anyway;
 * - the RSS budget (`--memory-limit-mb`): resident memory above the given number of MB, for a container limit
 *   below the heap limit.
 */
import * as v8 from 'node:v8';
import { runInNewContext } from 'node:vm';

/** Fraction of V8's heap limit the live heap may use before the guard stops the run. */
export const HEAP_FRACTION = 0.92;

export const MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED';

export class MemoryLimitError extends Error {
  readonly code = MEMORY_LIMIT_EXCEEDED;
}

export interface MemoryReading {
  readonly heapUsedBytes: number;
  readonly rssBytes: number;
}

export interface MemoryGuardOptions {
  /** RSS budget in MB (`--memory-limit-mb`); absent = no RSS budget. */
  readonly rssLimitMb?: number;
  /** V8's heap limit in bytes; default `v8.getHeapStatistics().heap_size_limit`. */
  readonly heapLimitBytes?: number;
  /** Memory reader (tests). */
  readonly read?: () => MemoryReading;
  /** Full garbage collection (tests); default: V8's `gc`, exposed on first use. */
  readonly collect?: () => void;
}

const MB = 1024 * 1024;

function defaultRead(): MemoryReading {
  const m = process.memoryUsage();
  return { heapUsedBytes: m.heapUsed, rssBytes: m.rss };
}

let exposedGc: (() => void) | undefined;
function defaultCollect(): void {
  if (exposedGc === undefined) {
    const globalGc = (globalThis as { gc?: () => void }).gc;
    if (typeof globalGc === 'function') {
      exposedGc = globalGc;
    } else {
      v8.setFlagsFromString('--expose-gc');
      exposedGc = runInNewContext('gc') as () => void;
    }
  }
  exposedGc();
}

const mb = (bytes: number): string => `${String(Math.round(bytes / MB))} MB`;

export class MemoryGuard {
  private readonly heapBudget: number;
  private readonly rssBudget: number | undefined;
  private readonly read: () => MemoryReading;
  private readonly collect: () => void;

  constructor(options: MemoryGuardOptions = {}) {
    const heapLimit = options.heapLimitBytes ?? v8.getHeapStatistics().heap_size_limit;
    this.heapBudget = heapLimit * HEAP_FRACTION;
    this.rssBudget = options.rssLimitMb !== undefined ? options.rssLimitMb * MB : undefined;
    this.read = options.read ?? defaultRead;
    this.collect = options.collect ?? defaultCollect;
  }

  /**
   * Throws `MemoryLimitError` when a budget is exceeded after a full collection. `stage` and `progress` go into the
   * message (`"edge extraction"`, `"1,840 of 9,876 files"`).
   */
  check(stage: string, progress?: string): void {
    let m = this.read();
    if (!this.over(m)) return;
    this.collect();
    m = this.read();
    if (!this.over(m)) return;
    const where = progress !== undefined ? `${stage} (${progress})` : stage;
    const used = this.rssBudget !== undefined && m.rssBytes > this.rssBudget
      ? `resident memory ${mb(m.rssBytes)} is over the --memory-limit-mb budget of ${mb(this.rssBudget)}`
      : `live heap ${mb(m.heapUsedBytes)} is over ${String(Math.round(HEAP_FRACTION * 100))}% of the ${mb(this.heapBudget / HEAP_FRACTION)} Node heap limit`;
    throw new MemoryLimitError(
      `Project too large for the available memory: ${used} during ${where}. `
      + 'Analyse a smaller part (narrow exclude_paths in the spec, or point --project or --tsconfig at one package), '
      + 'cap the size with --max-files, try --skip-excluded-sources, or give Node more heap '
      + '(NODE_OPTIONS=--max-old-space-size=<MB>).',
    );
  }

  private over(m: MemoryReading): boolean {
    return m.heapUsedBytes > this.heapBudget || (this.rssBudget !== undefined && m.rssBytes > this.rssBudget);
  }
}
