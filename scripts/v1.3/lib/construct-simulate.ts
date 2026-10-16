/**
 * Offline stand-ins for the compile-time construct switches (re-score only). In the pipeline a compile-time option
 * changes the compiled Cypher, which runs on Neo4j; offline there is no Neo4j, so the rows a newly compiled template
 * would return are computed here from the in-memory graph, with the template's own definition:
 * - `domain-state-purity` (Q1 B or C: FF-P06 in layered): a domain Class holding an infrastructure Class or Interface
 *   through FLOWS_TO or CONSTRUCTOR_INJECTS;
 * - `no-cyclic-deps` (Q16 B: FF-S02 in ddd): simple cycles of length 2..MAX_CYCLE_LENGTH over IMPORTS|RE_EXPORTS in
 *   the literal view, each started at its smallest file;
 * - `dependency-direction` (Q13 C: the nestjs layers reordered): an import from a lower to a higher layer.
 * These are estimates of what the live run will report, not the instrument: the live re-run is the measurement.
 */
import type { Violation, ViolationType } from '../../../src/shared/taxonomy/violation-types.js';
import type { FitnessFunction } from '../../../src/shared/types/spec.js';
import { computeViolationId } from '../../../src/evaluation-engine/violation-id.js';
import { MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';
import type { ConstructGraph } from '../../../src/construct-switches/graph.js';
import { literalEdges } from '../../../src/construct-switches/graph.js';
import type { LayerView } from '../../../src/construct-switches/layer-view.js';
import { globMatcher } from '../../../src/construct-switches/overlays.js';

export const SIMULATED_TEMPLATES: ReadonlySet<string> = new Set(['domain-state-purity', 'no-cyclic-deps', 'dependency-direction']);

function violation(ff: FitnessFunction, type: ViolationType, row: {
  filePath: string; target?: string; line?: number; isTypeOnly?: boolean; discriminator: string[]; message: string;
}): Violation {
  const functionId = ff.id;
  return {
    id: computeViolationId({ functionId, filePath: row.filePath, target: row.target, line: row.line, discriminator: row.discriminator }),
    type, dimension: ff.dimension, severity: ff.severity, functionId, route: 'symbolic', filePath: row.filePath, message: row.message,
    deterministic: true,
    ...(row.target !== undefined ? { target: row.target } : {}),
    ...(row.line !== undefined ? { line: row.line } : {}),
    ...(row.isTypeOnly !== undefined ? { isTypeOnly: row.isTypeOnly } : {}),
    discriminator: row.discriminator,
  };
}

/** The rows the template `ff.name` would return on this graph; throws for a template without a stand-in. */
export function simulateTemplate(ff: FitnessFunction, g: ConstructGraph, view: LayerView): Violation[] {
  const excluded = globMatcher(ff.excludePaths);
  const layer = (f: string): string | null => g.files.get(f) ?? null;
  const out: Violation[] = [];
  if (ff.name === 'domain-state-purity') {
    const domain = view.domainLayer;
    const infra = view.order.find((l) => view.kindOf(l) === 'infrastructure');
    const byId = new Map(g.classes.map((c) => [c.id, c]));
    for (const e of g.classEdges) {
      if (e.type !== 'FLOWS_TO' && e.type !== 'CONSTRUCTOR_INJECTS') continue;
      const c = byId.get(e.from);
      const t = byId.get(e.to);
      if (c === undefined || t === undefined || c.kind !== 'Class' || c.layer !== domain || t.layer !== infra || excluded(c.file)) continue;
      out.push(violation(ff, 'DOMAIN_STATE_PURITY_VIOLATION', {
        filePath: c.file, target: t.file, ...(e.line !== undefined ? { line: e.line } : {}),
        discriminator: [c.name, t.name, e.type, e.field ?? ''],
        message: `Domain class ${c.name} holds infrastructure ${t.name} via ${e.type} (${e.field ?? ''})`,
      }));
    }
  } else if (ff.name === 'no-cyclic-deps') {
    const next = new Map<string, Set<string>>();
    for (const e of literalEdges(g)) next.set(e.from, (next.get(e.from) ?? new Set<string>()).add(e.to));
    const cycles = new Set<string>();
    const files = [...g.files.keys()].sort();
    for (const start of files) {
      const path = [start];
      const walk = (n: string): void => {
        for (const m of [...(next.get(n) ?? [])].sort()) {
          if (m === start && path.length >= 2) cycles.add(JSON.stringify([...path, start]));
          else if (m > start && !path.includes(m) && path.length < MAX_CYCLE_LENGTH) {
            path.push(m);
            walk(m);
            path.pop();
          }
        }
      };
      walk(start);
    }
    for (const c of [...cycles].sort()) {
      const cycle = JSON.parse(c) as string[];
      if (cycle.some((f) => excluded(f))) continue;
      out.push(violation(ff, 'CYCLIC_DEPENDENCY', {
        filePath: cycle.join(','), ...(cycle[1] !== undefined ? { target: cycle[1] } : {}), discriminator: [c], message: `Circular dependency: ${cycle.join(',')}`,
      }));
    }
  } else if (ff.name === 'dependency-direction') {
    for (const e of literalEdges(g)) {
      const s = layer(e.from);
      const t = layer(e.to);
      if (s === null || t === null || s === t || excluded(e.from)) continue;
      const si = view.order.indexOf(s);
      const ti = view.order.indexOf(t);
      if (si < 0 || ti < 0 || si >= ti) continue;
      out.push(violation(ff, 'LAYER_VIOLATION', {
        filePath: e.from, target: e.to, ...(e.line !== undefined ? { line: e.line } : {}), isTypeOnly: e.typeOnly, discriminator: [e.type],
        message: `${e.from} (${s}) ${e.type === 'IMPORTS' ? 'imports' : 're-exports'} from ${e.to} (${t})`,
      }));
    }
  } else {
    throw new Error(`construct re-score: no offline stand-in for template ${ff.name}`);
  }
  return out;
}
