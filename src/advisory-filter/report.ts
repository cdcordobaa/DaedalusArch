/**
 * The report-level advisory post-filter: moves the rows the options remove from `violations` to
 * `advisoryFilter.suppressed`. Everything else in the report (scores, tiers, functionResults, verdict) is the
 * unfiltered run's and is left as it is, so blocking results are byte-identical with and without the filter.
 */
import type { EvaluationReport } from '../shared/types/evaluation.js';
import { applyAdvisoryFilter } from './advisory-filter.js';
import type { AdvisoryFilterOption, ProjectView } from './advisory-filter.js';
import { advisoryTierOf } from './project-view.js';

export function filterReportAdvisory(report: EvaluationReport, options: readonly AdvisoryFilterOption[], view: ProjectView): EvaluationReport {
  if (options.length === 0) return report;
  const blocking = report.tiers !== undefined ? new Set<string>(report.tiers.blocking.rules.map((r) => r.functionId)) : undefined;
  const { kept, suppressed } = applyAdvisoryFilter(report.violations, options, advisoryTierOf(report.tiers?.style ?? undefined, blocking), view);
  return {
    ...report,
    violations: kept,
    advisoryFilter: {
      options: [...options],
      suppressed: suppressed.map((s) => ({ option: s.option, reason: s.reason, violation: s.finding })),
    },
  };
}
