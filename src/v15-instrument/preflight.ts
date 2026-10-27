/**
 * v1.5 instrument: spec pre-flight (loud failure). Zero model calls.
 *
 * Two silent failure modes motivated it (2026-10-27):
 *   - the frozen DDD binder (`bindDddModel`, used by the frozen `fastRuleFindings`) rejects an `architecture.ddd` block,
 *     for example an `inner_entities` entry given as a class name instead of a path inside the context, and every
 *     frozen DDD rule is then skipped without a message;
 *   - a spec can satisfy the v1.5 reader (`./spec.ts`) and still fail the frozen schema (missing `scoring`,
 *     `confidence_thresholds`, layer roles), so the frozen tools refuse it while the v1.5 rules run.
 *
 * `preflightSpec` runs the three readers on one spec and reports every error. The frozen modules are imported
 * read-only: the spec loader the MCP server uses (`createSpecLoader`, wired by `buildContext`) and `bindDddModel`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bindDddModel } from '../fitness-compiler/ddd-templates.js';
import { createSpecLoader } from '../mcp-server/tools.js';
import { loadSpec } from './spec.js';

export interface PreflightResult { readonly ok: boolean; readonly errors: string[]; readonly warnings: string[] }

export async function preflightSpec(specPath: string): Promise<PreflightResult> {
  const absolute = path.resolve(specPath);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(absolute)) return { ok: false, errors: [`spec file not found: ${absolute}`], warnings };

  // (a) the frozen schema, through the MCP server's spec loader.
  const frozen = await createSpecLoader()(absolute);
  if (!frozen.ok) {
    errors.push(`frozen schema: ${frozen.message}`);
  } else {
    warnings.push(...frozen.data.warnings.map((w) => `frozen schema: ${w}`));
    // (b) the frozen DDD binder, as `fastRuleFindings` calls it.
    const { spec } = frozen.data;
    if (spec.style === 'ddd' || spec.layerModel.ddd !== undefined) {
      const bound = bindDddModel(spec.layerModel);
      if (!bound.ok) errors.push(...bound.errors.map((e) => `frozen DDD binder: ${e} (every frozen DDD rule would be skipped)`));
    }
  }

  // (c) the v1.5 reader.
  try {
    const v15 = loadSpec(path.dirname(absolute), absolute);
    errors.push(...v15.specErrors.map((e) => `v1.5 spec: ${e}`));
  } catch (e) {
    errors.push(`v1.5 spec: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** One line for logs and refusals. */
export function formatPreflight(specPath: string, r: PreflightResult): string {
  return r.ok
    ? `OK   ${specPath}${r.warnings.length > 0 ? ` (${String(r.warnings.length)} warning(s): ${r.warnings.join('; ')})` : ''}`
    : `FAIL ${specPath}: ${r.errors.join('; ')}`;
}
