/**
 * Deterministic warning merge and cap (C8 report builder; FR-13, FR-34, FR-35; U3 BR-U3-57,
 * BR-U3-58 hook, BR-U3-70 items 1 and 10; domain-entities.md §6.2).
 *
 *   report.warnings = scrub → sort by (stage rank, stage, code, message, canonicalJson(context ?? null))
 *                     → cap 50 per (stage, code), one REPORT_001 entry after each capped pair's shown entries
 *
 * The order is total, so it never depends on the extract/parse race of `ParallelCommand`.
 */
import type { PipelineWarning } from '../shared/errors/domain-result.js';

/** Frozen cap per (stage, code) pair (BR-U3-70 item 1). */
export const WARNING_CAP_PER_CODE = 50;

/** Stage of the cap entries and of the assembler (S1 `AssembleReportCommand`). */
export const REPORT_STAGE = 'assemble-report';

/**
 * Frozen stage rank: pipeline command order (`createPipeline`), each command name followed by the
 * module stage names its component uses. Unknown stages sort after every listed stage, by name.
 */
export const WARNING_STAGE_ORDER: readonly string[] = [
  'snapshot-load',
  'parallel:extract-apg+parse-spec',
  'extract-apg', 'apg-extractor',
  'parse-spec', 'spec-parser',
  'validate-spec',
  'ingest-apg', 'neo4j-ingestion',
  'compile-functions', 'fitness-compiler',
  'route-evaluate', 'router', 'neuro-symbolic-router',
  'evaluate-symbolic', 'evaluation-engine',
  'evaluate-neuronal', 'llm-critic',
  'compute-scores', 'scoring-engine',
  REPORT_STAGE,
  'snapshot-save',
  'drift-detect',
  'create-baseline', 'compare-baseline',
  'generate-report',
  'pipeline-executor',
];

const STAGE_RANK: ReadonlyMap<string, number> = new Map(WARNING_STAGE_ORDER.map((stage, i) => [stage, i]));

function stageRank(stage: string): number {
  return STAGE_RANK.get(stage) ?? WARNING_STAGE_ORDER.length;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareText)) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** `JSON.stringify` with object keys sorted recursively (array order kept). */
export function canonicalJson(value: unknown): string {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return 'null';
  return JSON.stringify(sortKeys(value));
}

/** Code-unit comparison (locale-independent). */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Total order of BR-U3-57. */
export function compareWarnings(a: PipelineWarning, b: PipelineWarning): number {
  return stageRank(a.stage) - stageRank(b.stage)
    || compareText(a.stage, b.stage)
    || compareText(a.code, b.code)
    || compareText(a.message, b.message)
    || compareText(canonicalJson(a.context ?? null), canonicalJson(b.context ?? null));
}

function capEntry(stage: string, code: string, total: number): PipelineWarning {
  return {
    stage: REPORT_STAGE,
    code: 'REPORT_001',
    message: `${code} from ${stage}: showing ${String(WARNING_CAP_PER_CODE)} of ${String(total)}`,
    context: { stage, code, total, shown: WARNING_CAP_PER_CODE },
  };
}

/**
 * Scrubs every warning with `scrub` (BR-U3-58; the builder passes `scrubWarning` bound to the known
 * secrets), sorts by `compareWarnings` and caps each (stage, code) pair at `WARNING_CAP_PER_CODE`
 * with one `REPORT_001` entry placed after that pair's shown entries. Input is not mutated.
 */
export function mergeWarnings(
  warnings: readonly PipelineWarning[],
  scrub: (warning: PipelineWarning) => PipelineWarning,
): readonly PipelineWarning[] {
  const sorted = warnings.map(scrub).sort(compareWarnings);
  const out: PipelineWarning[] = [];
  let i = 0;
  while (i < sorted.length) {
    const head = sorted[i];
    if (head === undefined) break;
    let j = i;
    while (j < sorted.length && sorted[j]?.stage === head.stage && sorted[j]?.code === head.code) j++;
    const total = j - i;
    out.push(...sorted.slice(i, i + Math.min(total, WARNING_CAP_PER_CODE)));
    if (total > WARNING_CAP_PER_CODE) out.push(capEntry(head.stage, head.code, total));
    i = j;
  }
  return out;
}
