/** Minimal fixtures for the construct-switch tests: the real presets, a hand-built graph, hand-built rows. */
import * as path from 'node:path';
import { parseSpec } from '../../../src/spec-parser/index.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { FunctionId } from '../../../src/shared/types/value-objects.js';
import type { ConstructAnswers } from '../../../src/shared/construct-switches.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { applyConstructCompileOverlays } from '../../../src/construct-switches/compile.js';
import type { CgClass, CgClassEdge, CgEdge, CgPackageEdge, ConstructGraph } from '../../../src/construct-switches/graph.js';
import { applyConstructRows } from '../../../src/construct-switches/rows.js';
import type { RowSwitchResult } from '../../../src/construct-switches/rows.js';
import { computeViolationId } from '../../../src/evaluation-engine/violation-id.js';

const REPO = path.resolve(__dirname, '../../..');
const specs = new Map<string, ParsedSpec>();

export async function presetSpec(style: string): Promise<ParsedSpec> {
  const hit = specs.get(style);
  if (hit !== undefined) return hit;
  const r = await parseSpec({ specFilePath: path.join(REPO, 'presets', `${style}.yaml`) });
  if (!r.success) throw new Error(`preset ${style} does not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  specs.set(style, r.data);
  return r.data;
}

export interface GraphSpec {
  readonly files: Readonly<Record<string, string | null>>;
  readonly edges?: readonly (Partial<CgEdge> & { from: string; to: string })[];
  readonly packages?: readonly (Partial<CgPackageEdge> & { from: string; pkg: string })[];
  readonly classes?: readonly (Partial<CgClass> & { id: string; file: string })[];
  readonly classEdges?: readonly CgClassEdge[];
}

export function graph(s: GraphSpec): ConstructGraph {
  return {
    files: new Map(Object.entries(s.files)),
    edges: (s.edges ?? []).map((e) => ({ type: 'IMPORTS', typeOnly: false, viaReExport: false, reExportHop: false, ...e })),
    packageEdges: (s.packages ?? []).map((p) => ({ typeOnly: false, viaReExport: false, ...p })),
    classes: (s.classes ?? []).map((c) => ({ name: c.id, kind: 'Class', layer: s.files[c.file] ?? null, methods: [], ...c })),
    classEdges: s.classEdges ?? [],
  };
}

export function row(functionId: string, filePath: string, extra: Partial<Violation> = {}): Violation {
  const discriminator = [...(extra.discriminator ?? ['IMPORTS'])];
  return {
    id: computeViolationId({ functionId, filePath, target: extra.target, line: extra.line, discriminator }),
    type: 'LAYER_VIOLATION', dimension: 'structural', severity: 'critical', functionId: functionId as FunctionId, route: 'symbolic',
    filePath, message: 'm', deterministic: true, ...extra, discriminator,
  };
}

/** A cycle row as the no-cyclic-deps mapping writes it. */
export function cycleRow(functionId: string, cycle: readonly string[]): Violation {
  return row(functionId, cycle.join(','), { target: cycle[1], discriminator: [JSON.stringify(cycle)], type: 'CYCLIC_DEPENDENCY' });
}

export function result(functionId: string, violations: readonly Violation[] = []): SymbolicFunctionResult {
  return { functionId: functionId as FunctionId, dimension: 'structural', passed: violations.length === 0, violations, executionTimeMs: 0, deterministic: true };
}

/** Runs the row stage with the preset of `style`, the overlays of `answers` and the given graph. */
export async function stage(style: string, answers: ConstructAnswers, results: readonly SymbolicFunctionResult[], g: ConstructGraph): Promise<RowSwitchResult> {
  const spec = await presetSpec(style);
  const input = applyConstructCompileOverlays(compilerInputFromSpec(spec), answers);
  return applyConstructRows(results, { answers, style, layerModel: input.layerModel, functions: input.fitnessFunctions, graph: g });
}

/** The rows of one function id after the stage, as `file -> target` strings. */
export function rowsOf(r: RowSwitchResult, functionId: string): string[] {
  return (r.results.find((x) => String(x.functionId) === functionId)?.violations ?? []).map((v) => `${v.filePath} -> ${v.target ?? ''}`);
}
