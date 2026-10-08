import type { EvaluationReport, ReportScoring } from '../shared/types/evaluation.js';
import type { FitnessFunction } from '../shared/types/spec.js';
import type { Dimension } from '../shared/types/enums.js';
import { formatAllActionableViolations } from '../report/actionable-formatter.js';

/** The three AHS variants of a report; which one is the headline is `scoring.verdictSource`. */
export type AhsVariant = ReportScoring['verdictSource'];

/** Printed form of an AHS variant: `n/a` when the mode does not compute it (BR-U3-43; never `NaN`). */
export function ahsText(value: number | undefined, fractionDigits: number): string {
  return value === undefined ? 'n/a' : value.toFixed(fractionDigits);
}

/** The headline AHS: the verdict-source variant (BR-U3-43, BR-U3-35). */
export function headlineAhs(report: EvaluationReport): { readonly source: AhsVariant; readonly value: number | undefined } {
  const source = report.scoring.verdictSource;
  return { source, value: report[source] };
}

/** Dimensions printed as CSV `avr_<dimension>` columns, in `DIMENSIONS` order (no `intent`, R7). */
const CSV_DIMENSIONS: readonly Dimension[] = ['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'integrity'];

function headerBox(report: EvaluationReport): string[] {
  const headline = headlineAhs(report);
  const verdict = report.verdict.toUpperCase();
  return [
    '╔═══════════════════════════════════════════╗',
    `║  Architectural Health Score: ${ahsText(headline.value, 2)} (${verdict})`.padEnd(44) + '║',
    '╚═══════════════════════════════════════════╝',
    '',
    `  Headline AHS:        ${headline.source}`,
    `  AHS (deterministic): ${ahsText(report.ahsDeterministic, 2)}`,
    `  AHS (combined):      ${ahsText(report.ahsCombined, 2)}`,
    `  AHS (neuronal):      ${ahsText(report.ahsNeuronal, 2)}`,
  ];
}

/** Printed form of a universal metric: `n/a` for `null` (BR-U3-43; JSON keeps `null`). */
export function metricText(value: number | null, fractionDigits?: number): string {
  if (value === null) return 'n/a';
  return fractionDigits === undefined ? String(value) : value.toFixed(fractionDigits);
}

/**
 * Format report as JSON string.
 */
export function formatJSON(report: EvaluationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format report as human-readable summary for CLI / PR comments.
 */
export function formatHuman(report: EvaluationReport): string {
  const lines: string[] = headerBox(report);
  lines.push(`  Verdict:             ${report.verdict}`);
  lines.push(`  Mode:                ${report.evaluationMode}`);
  lines.push('');

  // Per-dimension breakdown
  lines.push('  Per-Dimension Breakdown:');
  for (const dim of report.perDimensionScores) {
    const avr = Number(dim.avr).toFixed(3);
    lines.push(`    ${dim.dimension.padEnd(14)} AVR: ${avr}  (${dim.functionCount} functions, ${dim.violationCount} violations)`);
  }
  lines.push('');

  // Functions that failed to run and dimensions left out of the score (FR-13, FR-15)
  if (report.functionExecution.failed.length > 0) {
    lines.push('  Failed to run:');
    for (const f of report.functionExecution.failed) lines.push(`    ${String(f.functionId)} ${f.name} [${f.code}] ${f.message}`);
    lines.push('');
  }
  if (report.droppedDimensions.length > 0) {
    lines.push('  Dropped dimensions:');
    for (const d of report.droppedDimensions) lines.push(`    ${d.dimension}: ${d.reason} (declared ${String(d.declared)}, executed ${String(d.executed)})`);
    lines.push('');
  }

  // Top violations
  if (report.violations.length > 0) {
    lines.push('  Top Violations:');
    const top = report.violations.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      const v = top[i]!;
      lines.push(`    ${i + 1}. [${v.severity}] ${v.filePath} — ${v.message}`);
    }
    if (report.violations.length > 10) {
      lines.push(`    ... and ${report.violations.length - 10} more`);
    }
    lines.push('');
  }

  // Universal metrics
  const m = report.universalMetrics;
  lines.push('  Universal Metrics:');
  lines.push(`    Cycles: ${metricText(m.cyclicDependencyCount)} | Max fan-out: ${metricText(m.maxFanOut)} | Max fan-in: ${metricText(m.maxFanIn)}`);
  lines.push(`    Abstraction ratio: ${metricText(m.abstractionRatio)} | Avg instability: ${metricText(m.averageInstability)} | Orphans: ${metricText(m.orphanFileCount)}`);
  lines.push('');
  lines.push(`  Duration: ${report.durationMs}ms`);

  return lines.join('\n');
}

/**
 * Format report as a single CSV row.
 */
export function formatCSV(report: EvaluationReport): string {
  const dims = report.perDimensionScores;
  // A dimension without a row (not executed in the mode, or dropped) is printed `n/a` (BR-U3-43).
  const getAVR = (d: Dimension): string => {
    const found = dims.find((s) => s.dimension === d);
    return found ? Number(found.avr).toFixed(3) : 'n/a';
  };

  const m = report.universalMetrics;
  const fields = [
    report.projectPath,
    ahsText(headlineAhs(report).value, 3),
    report.scoring.verdictSource,
    ahsText(report.ahsDeterministic, 3),
    ahsText(report.ahsCombined, 3),
    ahsText(report.ahsNeuronal, 3),
    report.verdict,
    ...CSV_DIMENSIONS.map(getAVR),
    metricText(m.cyclicDependencyCount),
    metricText(m.maxFanOut),
    metricText(m.maxFanIn),
    metricText(m.abstractionRatio, 3),
    metricText(m.averageInstability, 3),
    metricText(m.orphanFileCount),
  ];

  return fields.join(',');
}

/**
 * Format report as human-readable summary with actionable violation details.
 * Uses the What/Where/Why/Fix format for each violation.
 */
export function formatActionableHuman(
  report: EvaluationReport,
  fitnessFunctions: readonly FitnessFunction[],
): string {
  const lines: string[] = headerBox(report);
  lines.push(`  Verdict:             ${report.verdict}`);
  lines.push(`  Mode:                ${report.evaluationMode}`);
  lines.push('');

  if (report.violations.length > 0) {
    const actionable = formatAllActionableViolations(report.violations, fitnessFunctions);
    lines.push(`  Violations (${actionable.length}):`);
    lines.push('');

    for (const v of actionable) {
      lines.push(`  ${v.what}`);
      lines.push(`    File: ${v.where}`);
      lines.push(`    Why:  ${v.why}`);
      lines.push(`    Fix:  ${v.fix}`);
      lines.push('');
    }
  }

  lines.push(`  Duration: ${report.durationMs}ms`);
  return lines.join('\n');
}

/**
 * CSV header row.
 */
export function csvHeader(): string {
  return 'project,ahs,verdict_source,ahs_deterministic,ahs_combined,ahs_neuronal,verdict,avr_structural,avr_coupling,avr_pattern,avr_solid,avr_convention,avr_semantic,avr_integrity,cycles,max_fan_out,max_fan_in,abstraction_ratio,avg_instability,orphans';
}
