/**
 * Per-file IMPORTS metric predicates on the import graph (FR-v1.2E-24; BR-U5a-14 ii; `business-logic-model.md` §2.5).
 *
 * Mirror of the compiled templates (`cypher-templates.ts`, with U1's BR-U1-34 orphan edge types and BR-U1-36
 * IMPORTS-only metrics). Counts are of distinct File neighbours; Package targets are not File edges.
 *
 * | Template | Files considered | Value | Violates when |
 * |---|---|---|---|
 * | `domain-stability` (FF-C01) | `layer = domainLayer` with `inNon + outNon > 0` | `outNon / (inNon + outNon)`; neighbours whose layer is set and is not the domain layer (Cypher `<>` drops a null layer) | value > threshold (0.3) |
 * | `module-fan-out` (FF-C02) | any File with an outgoing `IMPORTS` edge | distinct targets | value > threshold (10) |
 * | `component-instability` (FF-C03) | `layer ≠ null`, `fanIn + fanOut > 0` | `fanOut / (fanIn + fanOut)` | value > threshold (0.8) |
 * | `no-orphan-files` (FF-C04) | `layer ≠ null`, not a barrel | distinct File neighbours over `IMPORTS ∪ RE_EXPORTS`, in and out | value = 0 (threshold reported as 0) |
 * | `max-fan-in` (FF-C05) | any File with an incoming `IMPORTS` edge | distinct sources | value > threshold (15) |
 *
 * If a later U1/U3 change alters a predicate, this table, the code and its test change in the same patch (OI-U5a-13).
 */
import type { ImportGraph, MetricTemplate } from './types.js';

/** The five per-file templates, in catalogue order. */
export const METRIC_TEMPLATES: readonly MetricTemplate[] = [
  'domain-stability',
  'module-fan-out',
  'component-instability',
  'no-orphan-files',
  'max-fan-in',
];

/** Registry defaults used when the spec gives no threshold (`no-orphan-files` has none: 0 is its reported bound). */
export const METRIC_DEFAULT_THRESHOLDS: Readonly<Record<MetricTemplate, number>> = {
  'domain-stability': 0.3,
  'module-fan-out': 10,
  'component-instability': 0.8,
  'no-orphan-files': 0,
  'max-fan-in': 15,
};

export function isMetricTemplate(name: string): name is MetricTemplate {
  return (METRIC_TEMPLATES as readonly string[]).includes(name);
}

interface Neighbours {
  readonly importsIn: Map<string, Set<string>>;
  readonly importsOut: Map<string, Set<string>>;
  readonly anyIn: Map<string, Set<string>>;
  readonly anyOut: Map<string, Set<string>>;
}

function add(m: Map<string, Set<string>>, k: string, v: string): void {
  let s = m.get(k);
  if (s === undefined) {
    s = new Set();
    m.set(k, s);
  }
  s.add(v);
}

function neighbours(g: ImportGraph): Neighbours {
  const n: Neighbours = { importsIn: new Map(), importsOut: new Map(), anyIn: new Map(), anyOut: new Map() };
  for (const e of g.edges) {
    if (!g.files.has(e.source) || !g.files.has(e.target)) continue;
    add(n.anyOut, e.source, e.target);
    add(n.anyIn, e.target, e.source);
    if (e.type === 'IMPORTS') {
      add(n.importsOut, e.source, e.target);
      add(n.importsIn, e.target, e.source);
    }
  }
  return n;
}

function size(m: Map<string, Set<string>>, k: string): number {
  return m.get(k)?.size ?? 0;
}

/** Value of every **considered** file of one template (violating or not), in file order. */
export function metricValues(g: ImportGraph, template: MetricTemplate, domainLayer: string | null): Map<string, number> {
  const n = neighbours(g);
  const out = new Map<string, number>();
  for (const f of g.files.values()) {
    const p = f.filePath;
    switch (template) {
      case 'domain-stability': {
        if (domainLayer === null || f.layer !== domainLayer) break;
        const nonDomain = (s: Set<string> | undefined): number =>
          [...(s ?? [])].filter((x) => {
            const layer = g.files.get(x)?.layer ?? null;
            return layer !== null && layer !== domainLayer;
          }).length;
        const inNon = nonDomain(n.importsIn.get(p));
        const outNon = nonDomain(n.importsOut.get(p));
        if (inNon + outNon > 0) out.set(p, outNon / (inNon + outNon));
        break;
      }
      case 'module-fan-out': {
        const v = size(n.importsOut, p);
        if (v > 0) out.set(p, v);
        break;
      }
      case 'component-instability': {
        if (f.layer === null) break;
        const fanIn = size(n.importsIn, p);
        const fanOut = size(n.importsOut, p);
        if (fanIn + fanOut > 0) out.set(p, fanOut / (fanIn + fanOut));
        break;
      }
      case 'no-orphan-files': {
        if (f.layer === null || f.isBarrel) break;
        out.set(p, size(n.anyIn, p) + size(n.anyOut, p));
        break;
      }
      case 'max-fan-in': {
        const v = size(n.importsIn, p);
        if (v > 0) out.set(p, v);
        break;
      }
      default: {
        const never: never = template;
        throw new Error(`metrics: unknown template ${String(never)}`);
      }
    }
  }
  return out;
}

/** True when a considered value violates the template's predicate under `threshold`. */
export function violates(template: MetricTemplate, value: number, threshold: number): boolean {
  return template === 'no-orphan-files' ? value === 0 : value > threshold;
}

/**
 * Violating files of one template: file → value (design §2.4 signature). `threshold` undefined → registry default.
 */
export function metricViolations(
  g: ImportGraph,
  template: MetricTemplate,
  threshold: number | undefined,
  domainLayer: string | null,
): Map<string, number> {
  const t = threshold ?? METRIC_DEFAULT_THRESHOLDS[template];
  const out = new Map<string, number>();
  for (const [file, value] of metricValues(g, template, domainLayer)) {
    if (violates(template, value, t)) out.set(file, value);
  }
  return out;
}
