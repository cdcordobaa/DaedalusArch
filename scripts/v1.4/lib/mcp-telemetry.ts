/**
 * MCP tool-call telemetry of a `daedalus-mcp` loop out-root (the 2a report §11 table, as a reusable path for 2b).
 * Input per scored step: the step record's `process` block (`loop-process/v1`, `scripts/lib/loop/process-metrics.ts`)
 * and its call log lines (`mcp-call/v1`). Inherited step-1 records (shared start) carry no MCP turn and are skipped.
 */

export interface McpCallLine {
  readonly tool: string;
  readonly filesTouched?: readonly string[];
  readonly blockingCount?: number | null;
  readonly verdict?: string | null;
  readonly error?: string | null;
}

export interface ProcessBlock {
  readonly calls: number;
  readonly errors: number;
  readonly callsByTool: Readonly<Record<string, number>>;
  readonly firstCallBeforeFirstWrite: boolean | null;
  readonly latencyMs?: { readonly p50: number | null; readonly p95: number | null };
}

export interface TelemetryStep {
  readonly task: string;
  readonly rep: number;
  readonly step: number;
  readonly calls: number;
  readonly errors: number;
  readonly callsByTool: Readonly<Record<string, number>>;
  readonly firstCallBeforeFirstWrite: boolean | null;
  readonly latencyMs: { readonly p50: number | null; readonly p95: number | null };
  readonly checks: readonly { readonly tool: string; readonly verdict: string | null; readonly blockingCount: number | null; readonly files: readonly string[] }[];
  readonly logLines: number;
}

/** The check tools whose verdicts are tabulated (every other tool only counts as a call). */
export const CHECK_TOOLS: readonly string[] = Object.freeze(['check_import', 'check_file', 'check_diff']);

export function telemetryStep(where: { task: string; rep: number; step: number }, proc: ProcessBlock, lines: readonly McpCallLine[]): TelemetryStep {
  return {
    ...where,
    calls: proc.calls,
    errors: proc.errors,
    callsByTool: proc.callsByTool,
    firstCallBeforeFirstWrite: proc.firstCallBeforeFirstWrite,
    latencyMs: { p50: proc.latencyMs?.p50 ?? null, p95: proc.latencyMs?.p95 ?? null },
    checks: lines.filter((l) => CHECK_TOOLS.includes(l.tool)).map((l) => ({ tool: l.tool, verdict: l.verdict ?? null, blockingCount: l.blockingCount ?? null, files: [...(l.filesTouched ?? [])] })),
    logLines: lines.length,
  };
}

export interface TelemetrySummary {
  readonly turns: number;
  readonly calls: number;
  readonly errors: number;
  /** Per tool: calls, and the turns that used it. */
  readonly byTool: Readonly<Record<string, { readonly calls: number; readonly turns: number }>>;
  readonly turnsWithFirstCallBeforeFirstWrite: number;
  readonly turnsWithoutCalls: number;
  /** Per check tool and verdict (`null` verdict as "none"). */
  readonly checkVerdicts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Process blocks whose call count differs from the log's line count (a telemetry gap). */
  readonly logMismatches: number;
}

export function summariseTelemetry(steps: readonly TelemetryStep[]): TelemetrySummary {
  const byTool: Record<string, { calls: number; turns: number }> = {};
  const verdicts: Record<string, Record<string, number>> = {};
  for (const s of steps) {
    for (const [tool, n] of Object.entries(s.callsByTool)) {
      const t = (byTool[tool] ??= { calls: 0, turns: 0 });
      t.calls += n;
      if (n > 0) t.turns++;
    }
    for (const c of s.checks) {
      const v = (verdicts[c.tool] ??= {});
      const key = c.verdict ?? 'none';
      v[key] = (v[key] ?? 0) + 1;
    }
  }
  const sorted = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    turns: steps.length,
    calls: steps.reduce((a, s) => a + s.calls, 0),
    errors: steps.reduce((a, s) => a + s.errors, 0),
    byTool: sorted(byTool),
    turnsWithFirstCallBeforeFirstWrite: steps.filter((s) => s.firstCallBeforeFirstWrite === true).length,
    turnsWithoutCalls: steps.filter((s) => s.calls === 0).length,
    checkVerdicts: sorted(verdicts),
    logMismatches: steps.filter((s) => s.calls !== s.logLines).length,
  };
}
