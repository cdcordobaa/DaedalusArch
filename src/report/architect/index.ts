/**
 * Architect HTML report (`firewall evaluate --html <out.html>`): one static, self-contained file that explains the
 * findings of a run in plain language. The default outputs of `evaluate` are unchanged when the flag is absent.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildArchitectModel } from './model.js';
import type { ArchitectReportInput } from './model.js';
import { renderArchitectHtml } from './render.js';

export { buildArchitectModel, graphInputFromApg } from './model.js';
export type { ArchitectGraphInput, ArchitectReportInput, ArchitectReportModel, FindingModel, LayerBox, LayerEdge } from './model.js';
export { renderArchitectHtml } from './render.js';
export { TIER_LABELS } from './rule-text.js';

/** Builds and renders the report as an HTML string. */
export function architectReportHtml(input: ArchitectReportInput): string {
  return renderArchitectHtml(buildArchitectModel(input));
}

/** Writes the report to `outputPath` and returns the absolute path. */
export function writeArchitectReport(input: ArchitectReportInput, outputPath: string): string {
  const abs = resolve(outputPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, architectReportHtml(input), 'utf-8');
  return abs;
}
