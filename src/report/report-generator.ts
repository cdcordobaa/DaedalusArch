import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DomainResult } from '../shared/errors/domain-result.js';
import { formatAllActionableViolations } from './actionable-formatter.js';
import { buildGraphData } from './graph-data-builder.js';
import { buildDashboardData } from './dashboard-data-builder.js';
import { getHtmlTemplate } from './html-template.js';
import type { ReportInput, ReportOutput, CytoscapeGraphData, DashboardData } from './types.js';

/**
 * Generate a self-contained HTML report dashboard.
 *
 * Orchestrates:
 *   1. Format violations → ActionableViolation[]
 *   2. Build Cytoscape.js graph data from APG
 *   3. Build dashboard data from evaluation report
 *   4. Render HTML template with injected data
 *   5. Write to output file
 */
export function generateReport(input: ReportInput): DomainResult<ReportOutput> {
  const {
    evaluationReport,
    parsedSpec,
    apgResult,
    baselineResult,
    projectName,
    outputPath,
  } = input;

  // 1. Format violations
  const actionableViolations = formatAllActionableViolations(
    evaluationReport.violations,
    parsedSpec.fitnessFunctions,
    baselineResult,
  );

  // 2. Build graph data
  const graphData: CytoscapeGraphData = buildGraphData(
    apgResult,
    parsedSpec,
    actionableViolations,
  );

  // 3. Build dashboard data
  const dashboardData: DashboardData = buildDashboardData(
    evaluationReport,
    parsedSpec,
    apgResult,
    actionableViolations,
    projectName,
    baselineResult,
  );

  // 4. Render HTML
  const htmlContent = renderHTML(dashboardData, graphData);

  // 5. Write file
  const resolvedPath = resolve(outputPath);
  writeFileSync(resolvedPath, htmlContent, 'utf-8');

  const sections = [
    'header',
    'ahs-score',
    'architecture-map',
    'fitness-functions',
    'violations-explorer',
    ...(baselineResult ? ['baseline-split'] : []),
    'summary-stats',
  ];

  return DomainResult.ok({
    htmlContent,
    outputPath: resolvedPath,
    sections,
  });
}

/**
 * Render HTML by injecting serialized data into the template.
 */
function renderHTML(dashboardData: DashboardData, graphData: CytoscapeGraphData): string {
  const template = getHtmlTemplate();

  return template
    .replace('__DASHBOARD_DATA__', JSON.stringify(dashboardData))
    .replace('__GRAPH_DATA__', JSON.stringify(graphData));
}
