import type { EvaluationReport } from '../shared/types/evaluation.js';

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
  const ahs = Number(report.ahsDeterministic).toFixed(2);
  const verdict = report.verdict.toUpperCase();
  const lines: string[] = [];

  lines.push('╔═══════════════════════════════════════════╗');
  lines.push(`║  Architectural Health Score: ${ahs} (${verdict})`.padEnd(44) + '║');
  lines.push('╚═══════════════════════════════════════════╝');
  lines.push('');
  lines.push(`  AHS (deterministic): ${Number(report.ahsDeterministic).toFixed(2)}`);
  if (report.ahsCombined) {
    lines.push(`  AHS (combined):      ${Number(report.ahsCombined).toFixed(2)}`);
  }
  if (report.ahsNeuronal) {
    lines.push(`  AHS (neuronal):      ${Number(report.ahsNeuronal).toFixed(2)}`);
  }
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
  lines.push(`    Cycles: ${m.cyclicDependencyCount} | Max fan-out: ${m.maxFanOut} | Max fan-in: ${m.maxFanIn}`);
  lines.push(`    Abstraction ratio: ${m.abstractionRatio} | Avg instability: ${m.averageInstability} | Orphans: ${m.orphanFileCount}`);
  lines.push('');
  lines.push(`  Duration: ${report.durationMs}ms`);

  return lines.join('\n');
}

/**
 * Format report as a single CSV row.
 */
export function formatCSV(report: EvaluationReport): string {
  const dims = report.perDimensionScores;
  const getAVR = (d: string) => {
    const found = dims.find((s) => s.dimension === d);
    return found ? Number(found.avr).toFixed(3) : '0.000';
  };

  const m = report.universalMetrics;
  const fields = [
    report.projectPath,
    Number(report.ahsDeterministic).toFixed(3),
    report.ahsCombined ? Number(report.ahsCombined).toFixed(3) : '',
    report.verdict,
    getAVR('structural'),
    getAVR('coupling'),
    getAVR('pattern'),
    getAVR('solid'),
    getAVR('convention'),
    getAVR('semantic'),
    getAVR('intent'),
    String(m.cyclicDependencyCount),
    String(m.maxFanOut),
    String(m.maxFanIn),
    m.abstractionRatio.toFixed(3),
    m.averageInstability.toFixed(3),
    String(m.orphanFileCount),
  ];

  return fields.join(',');
}

/**
 * CSV header row.
 */
export function csvHeader(): string {
  return 'project,ahs_deterministic,ahs_combined,verdict,avr_structural,avr_coupling,avr_pattern,avr_solid,avr_convention,avr_semantic,avr_intent,cycles,max_fan_out,max_fan_in,abstraction_ratio,avg_instability,orphans';
}
