/**
 * Memory guard for large projects (Docs/v1.3/scale.md §6).
 *
 * Without a guard, a project too big for the Node heap ends in V8's "JavaScript heap out of memory" abort: no report,
 * no hint. The guard is checked at checkpoints (between files of the extraction passes, between pipeline stages) and
 * stops the run with a `MEMORY_LIMIT_EXCEEDED` error that says what to do instead.
 *
 * By default the guard stops a run only where V8 would abort anyway, so a run that would complete still completes:
 * - before parsing and before the two uninterruptible steps (program and checker creation, then the extraction
 *   passes), it projects the heap with growth factors that are lower bounds measured on the scale corpus, and stops
 *   when even that lower bound passes V8's heap limit;
 * - at every checkpoint it stops when the live heap (after a forced full collection, so garbage does not count) is
 *   over `HEAP_FRACTION` of the limit, past the point where V8 itself gives up ("ineffective mark-compacts").
 * Close to the limit V8 can still abort between checkpoints; the projections catch the clearly-too-big projects early.
 * `--memory-limit-mb` adds a resident-memory budget, for a container limit below the heap limit or an earlier stop.
 */
import * as v8 from 'node:v8';
import { runInNewContext } from 'node:vm';

/** Fraction of V8's heap limit the live heap may use at a checkpoint before the guard stops the run. */
export const HEAP_FRACTION = 0.95;

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
  /** Clock in ms (tests); default `performance.now()`. */
  readonly now?: () => number;
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

const ADVICE = 'Analyse a smaller part (narrow exclude_paths in the spec, or point --project or --tsconfig at one package), '
  + 'cap the size with --max-files, try --skip-excluded-sources, or give Node more heap (NODE_OPTIONS=--max-old-space-size=<MB>).';

/**
 * Lower bound of the heap growth of TypeScript program and checker creation over the parsed sources: the smallest
 * ratio measured on the scale corpus was 1.41 (Docs/v1.3/scale.md §6).
 */
export const CHECKER_HEAP_GROWTH = 1.4;

/**
 * Lower bound of the live heap an extraction (parsing, checker creation, node and edge passes) takes per byte of
 * TypeScript source the project loads: the smallest ratio measured on the scale corpus was 37 bytes (scale.md §6).
 */
export const HEAP_PER_SOURCE_BYTE = 35;

/**
 * Lower bound of the live-heap growth of the node and edge passes over the heap with the type checker created: the
 * smallest ratio measured on the scale corpus was 1.05 (Docs/v1.3/scale.md §6).
 */
export const EXTRACTION_HEAP_GROWTH = 1.05;

export class MemoryGuard {
  private readonly heapLimit: number;
  private readonly heapBudget: number;
  private readonly rssBudget: number | undefined;
  private readonly read: () => MemoryReading;
  private readonly collect: () => void;
  private readonly now: () => number;
  /** When the last forced collection ended, and how long it took (ms). */
  private lastCollectEnd = Number.NEGATIVE_INFINITY;
  private lastCollectMs = 0;

  constructor(options: MemoryGuardOptions = {}) {
    this.heapLimit = options.heapLimitBytes ?? v8.getHeapStatistics().heap_size_limit;
    this.heapBudget = this.heapLimit * HEAP_FRACTION;
    this.rssBudget = options.rssLimitMb !== undefined ? options.rssLimitMb * MB : undefined;
    this.read = options.read ?? defaultRead;
    this.collect = options.collect ?? defaultCollect;
    this.now = options.now ?? (() => performance.now());
  }

  /**
   * A forced full collection, at most one per four times the last one's duration: back-to-back collections near the
   * limit would themselves trip V8's "ineffective mark-compacts" abort. Returns false when it is too soon.
   */
  private collectThrottled(): boolean {
    const start = this.now();
    if (start - this.lastCollectEnd < 4 * this.lastCollectMs) return false;
    this.collect();
    this.lastCollectEnd = this.now();
    this.lastCollectMs = this.lastCollectEnd - start;
    return true;
  }

  /**
   * Throws `MemoryLimitError` when a budget is exceeded after a full collection. `stage` and `progress` go into the
   * message (`"edge extraction"`, `"1,840 of 9,876 files"`).
   */
  check(stage: string, progress?: string): void {
    let m = this.read();
    if (!this.over(m)) return;
    // Too soon after the last collection: V8 is collecting anyway; measure again at the next checkpoint.
    if (!this.collectThrottled()) return;
    m = this.read();
    if (!this.over(m)) return;
    const where = progress !== undefined ? `${stage} (${progress})` : stage;
    const used = this.rssBudget !== undefined && m.rssBytes > this.rssBudget
      ? `resident memory ${mb(m.rssBytes)} is over the --memory-limit-mb budget of ${mb(this.rssBudget)}`
      : `live heap ${mb(m.heapUsedBytes)} is over ${String(Math.round(HEAP_FRACTION * 100))}% of the ${mb(this.heapLimit)} Node heap limit`;
    throw new MemoryLimitError(
      `Project too large for the available memory: ${used} during ${where}. `
      + ADVICE,
    );
  }

  /**
   * Before a step that cannot be interrupted (TypeScript program and checker creation, the extraction passes): fails
   * when the live heap times `growth`, a lower bound of the step's growth, already passes V8's heap limit.
   */
  checkProjected(stage: string, growth: number, progress?: string): void {
    if (this.read().heapUsedBytes * growth <= this.heapLimit) return;
    this.collect();
    this.lastCollectEnd = this.now();
    const live = this.read().heapUsedBytes;
    if (live * growth <= this.heapLimit) return;
    const where = progress !== undefined ? `${stage} (${progress})` : stage;
    throw new MemoryLimitError(
      `Project too large for the available memory: live heap ${mb(live)} needs at least ${mb(live * growth)} for ${where}, `
      + `over the ${mb(this.heapLimit)} Node heap limit. ${ADVICE}`,
    );
  }

  /**
   * Before parsing: fails when the heap in use plus `neededBytes` (a lower bound of what parsing and checker creation
   * will take) already passes V8's heap limit. `description` says what needs the memory.
   */
  checkAhead(neededBytes: number, description: string): void {
    if (this.read().heapUsedBytes + neededBytes <= this.heapLimit) return;
    this.collect();
    this.lastCollectEnd = this.now();
    if (this.read().heapUsedBytes + neededBytes <= this.heapLimit) return;
    throw new MemoryLimitError(
      `Project too large for the available memory: ${description} need at least ${mb(neededBytes)} of heap, `
      + `over the ${mb(this.heapLimit)} Node heap limit. ${ADVICE}`,
    );
  }

  private over(m: MemoryReading): boolean {
    return m.heapUsedBytes > this.heapBudget || this.overRss(m);
  }

  private overRss(m: MemoryReading): boolean {
    return this.rssBudget !== undefined && m.rssBytes > this.rssBudget;
  }
}
