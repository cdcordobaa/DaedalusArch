/**
 * Judge v2.2 layer model section (v1.3 development; see `judge-v22.ts`). v1's `renderLayerModel` and the v2.1 prompt
 * are untouched.
 *
 * The section states the architecture style and, per layer, the layers it may depend on, read from the evaluation
 * spec only (CTX-07):
 * - a spec with `allowedDependencies` (hexagonal, ddd): those edges, as declared;
 * - a closed-layering style (`layered`): layers are listed bottom-up and each may depend on the one listed directly
 *   before it (the `no-layer-skip` transitions, `fitness-compiler.ts`);
 * - any other style (clean-architecture, nestjs, unspecified): the layer order, inner to outer; a layer may depend on
 *   every layer listed before it (the `dependency-direction` order).
 * Lists keep the spec's layer order; no path is absolute (CTX-08).
 */
import type { AllowedDependency, LayerDefinition } from '../shared/types/spec.js';
import { CLOSED_LAYERING_STYLES, LAYER_MODEL_V22_TEXT } from './judge-v22.js';

/** What the v2.2 layer model section reads from the evaluation spec. */
export interface LayerModelV22Input {
  readonly layers: readonly LayerDefinition[];
  readonly style?: string;
  readonly allowedDependencies?: readonly AllowedDependency[];
}

export type DependencyRule = 'graph' | 'closed' | 'ordered';

export function dependencyRuleOf(input: LayerModelV22Input): DependencyRule {
  if ((input.allowedDependencies ?? []).length > 0) return 'graph';
  if (input.style !== undefined && CLOSED_LAYERING_STYLES.includes(input.style)) return 'closed';
  return 'ordered';
}

/** Per layer name, the layers it may depend on, in the spec's layer order. */
export function allowedDependenciesOf(input: LayerModelV22Input): Map<string, string[]> {
  const names = input.layers.map((l) => l.name);
  const out = new Map<string, string[]>(names.map((n) => [n, []]));
  const rule = dependencyRuleOf(input);
  if (rule === 'graph') {
    const edges = new Set((input.allowedDependencies ?? []).map((d) => `${d.from}>${d.to}`));
    for (const from of names) out.set(from, names.filter((to) => to !== from && edges.has(`${from}>${to}`)));
  } else if (rule === 'closed') {
    names.forEach((n, i) => out.set(n, names.slice(Math.max(0, i - 1), i)));
  } else {
    names.forEach((n, i) => out.set(n, names.slice(0, i)));
  }
  return out;
}

function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
}

/** The v2.2 `## Layer model` body: a style line, the dependency rule, then one line per layer. */
export function renderLayerModelV22(input: LayerModelV22Input): string {
  if (input.layers.length === 0) return '(none)';
  const t = LAYER_MODEL_V22_TEXT;
  const allowed = allowedDependenciesOf(input);
  const lines = [
    `${fill(t.styleLine, { style: input.style ?? t.unspecifiedStyle })} ${t[dependencyRuleOf(input)]}`,
    ...input.layers.map((l) => {
      const deps = allowed.get(l.name) ?? [];
      const patterns = l.filePatterns ?? [];
      const files = patterns.length > 0 ? fill(t.filePatterns, { patterns: patterns.join(', ') }) : '';
      return fill(t.layerLine, {
        name: l.name,
        kind: l.kind ?? 'unspecified',
        allowed: deps.length === 0 ? t.noDependency : deps.join(', '),
        directories: l.directories.join(', '),
      }) + files;
    }),
  ];
  return lines.join('\n');
}
