/**
 * Rule mining, emission: the mined rules as a spec that compiles to the EXISTING templates (never new Cypher).
 *
 * The base is the ISE-inferred spec (the style's canonical preset with the inferred layer globs). The emitter changes
 * only what the mined rules decide:
 * - hexagonal / ddd: `architecture.allowed_dependencies` becomes the mined allowed layer graph (an edge per observed
 *   layer pair that no selected rule forbids), which `dependency-direction-graph` and `layer-skip-graph` read;
 * - the linear styles: the order of `architecture.layers` becomes a topological order of the mined allowed graph,
 *   which `dependency-direction` (and, for layered, `no-layer-skip`) read;
 * - `fitness_functions` keeps only the functions a mined rule compiles to, each annotated with its rule ids,
 *   confidence and exception count; `domain-purity`'s `forbidden_imports` becomes the mined package list; APG v2
 *   functions are appended for component and public-API rules (they run on a graph extracted with APG v2).
 * Rules that no existing template expresses are listed in the header comment only. Every rule is a proposal.
 */
import YAML from 'yaml';
import { resolveTemplate } from '../spec-parser/template-registry.js';
import type { MinedRule, MiningResult } from './types.js';

export interface EmitOptions {
  /** Rules below this confidence are left out of the spec (still reported). Default 0: every rule is emitted. */
  readonly minConfidence?: number;
}

/** The emitted rules (at or above the confidence floor, with a compile target). */
export function emittedRules(result: MiningResult, opts: EmitOptions = {}): MinedRule[] {
  return result.rules.filter((r) => r.compilesTo !== null && r.confidence >= (opts.minConfidence ?? 0));
}

/**
 * A topological order of `layers` (innermost first) under `allowed` ("from>to": from may import to, so `to` comes
 * first); ties keep the given order. `null` when the allowed graph has a cycle between layers.
 */
export function topologicalOrder(layers: readonly string[], allowed: readonly string[]): string[] | null {
  const deps = new Map(layers.map((l) => [l, new Set<string>()]));
  for (const a of allowed) {
    const [from, to] = a.split('>') as [string, string];
    if (deps.has(from) && deps.has(to)) deps.get(from)?.add(to);
  }
  const out: string[] = [];
  const placed = new Set<string>();
  while (out.length < layers.length) {
    const next = layers.find((l) => !placed.has(l) && [...(deps.get(l) ?? [])].every((d) => placed.has(d)));
    if (next === undefined) return null;
    out.push(next);
    placed.add(next);
  }
  return out;
}

/** The allowed layer pairs a linear order implies under `style` (outer imports inner; layered: adjacent only). */
export function linearAllowed(order: readonly string[], style: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < i; j++) {
      if (style === 'layered' && j !== i - 1) continue;
      out.push(`${String(order[i])}>${String(order[j])}`);
    }
  }
  return out.sort();
}

const NOT_MINED = 'not mined: rule mining proposes only the rules the code follows';

const APG2_IDS: Readonly<Record<string, string>> = {
  'component-adp-cycle': 'FF-A01',
  'deep-import-inferred-api': 'FF-A02',
  'deep-import-declared-api': 'FF-A03',
};

const ruleNote = (rs: readonly MinedRule[]): string =>
  ` mined: ${rs.map((r) => `${r.id} ${r.level} ${r.confidence.toFixed(2)}, ${String(r.exceptions.length)} exception${r.exceptions.length === 1 ? '' : 's'}`).join('; ')}`;

/** Emits the mined spec from the ISE spec text. `header` lines go first in the leading comment. */
export function emitMinedSpec(iseSpecYaml: string, result: MiningResult, header: readonly string[], opts: EmitOptions = {}): string {
  const doc = YAML.parseDocument(iseSpecYaml);
  const rules = emittedRules(result, opts);
  const notes: string[] = [];
  const present = result.layers.filter((l) => (result.layerFiles[l] ?? 0) > 0);
  const graphStyle = result.style === 'hexagonal' || result.style === 'ddd';
  // The allowed graph of the emitted rules only (rules under the floor do not forbid anything).
  const forbidden = new Set(rules.filter((r) => r.kind.startsWith('layer-')).map((r) => `${r.subject}>${String(r.object)}`));
  const allowed = result.pairs.filter((p) => p.edges > 0 && !forbidden.has(`${p.from}>${p.to}`)).map((p) => `${p.from}>${p.to}`).sort();

  if (graphStyle) {
    const seq = doc.createNode(
      present
        .map((from) => ({ from, to: allowed.filter((a) => a.startsWith(`${from}>`)).map((a) => a.slice(from.length + 1)) }))
        .filter((e) => e.to.length > 0),
    ) as YAML.YAMLSeq;
    for (const item of seq.items as YAML.YAMLMap[]) {
      const from = String(item.get('from'));
      const parts = allowed.filter((a) => a.startsWith(`${from}>`)).map((a) => {
        const p = result.pairs.find((x) => `${x.from}>${x.to}` === a);
        return `${a.replace('>', ' -> ')} ${String(p?.importingFiles ?? 0)}/${String(p?.fromFiles ?? 0)} files`;
      });
      item.commentBefore = ` observed: ${parts.join('; ')}`;
    }
    doc.setIn(['architecture', 'allowed_dependencies'], seq);
  } else {
    const layersNode = doc.getIn(['architecture', 'layers']) as YAML.YAMLSeq;
    const items = layersNode.items as YAML.YAMLMap[];
    const names = items.map((i) => String(i.get('name')));
    const order = topologicalOrder(names, allowed);
    if (order === null) {
      notes.push('the mined allowed graph has a cycle between layers: the layer order is left as inferred');
    } else {
      layersNode.items = order.flatMap((n) => items.filter((_, i) => names[i] === n));
      const implied = new Set(linearAllowed(order.filter((l) => present.includes(l)), result.style));
      const notAllowed = allowed.filter((a) => !implied.has(a));
      const extra = [...implied].filter((a) => !allowed.includes(a));
      if (notAllowed.length > 0) notes.push(`mined as allowed but forbidden by the ${result.style} order: ${notAllowed.join(', ')}`);
      if (extra.length > 0) notes.push(`not mined as allowed but allowed by the ${result.style} order: ${extra.join(', ')}`);
    }
  }

  // fitness_functions: the preset functions a mined rule compiles to, then the APG v2 ones.
  const byTemplate = new Map<string, MinedRule[]>();
  for (const r of rules) {
    const t = r.compilesTo?.template ?? '';
    byTemplate.set(t, [...(byTemplate.get(t) ?? []), r]);
  }
  // The direction templates carry the layer graph itself: kept whenever the layer graph was mined.
  const structural = graphStyle ? ['dependency-direction-graph', 'layer-skip-graph'] : ['dependency-direction', ...(result.style === 'layered' ? ['no-layer-skip'] : [])];
  const fns = doc.getIn(['fitness_functions']) as YAML.YAMLSeq;
  const kept: YAML.YAMLMap[] = [];
  const disabled: YAML.YAMLMap[] = [];
  const disable = (item: YAML.YAMLMap): void => {
    item.set('enabled', false);
    item.set('reason', NOT_MINED);
    item.commentBefore = null;
    disabled.push(item);
  };
  const ids = new Set<string>();
  for (const item of fns.items as YAML.YAMLMap[]) {
    const name = String(item.get('name'));
    ids.add(String(item.get('id')));
    const rs = byTemplate.get(name);
    if (rs === undefined && !structural.includes(name)) {
      disable(item);
      continue;
    }
    item.commentBefore = rs !== undefined ? ruleNote(rs) : ' mined: the layer graph above (no forbidding rule of this template)';
    if (name === 'domain-purity' && rs !== undefined) {
      const pkgs = [...new Set(rs.flatMap((r) => r.params?.forbidden_imports ?? []))].sort();
      item.set('forbidden_imports', doc.createNode(pkgs));
    }
    kept.push(item);
    byTemplate.delete(name);
  }
  for (const [template, rs] of [...byTemplate].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const id = APG2_IDS[template];
    if (id === undefined) {
      notes.push(`${rs.map((r) => r.id).join(', ')}: ${template} is not among the inferred preset's functions; not emitted`);
      continue;
    }
    const node = doc.createNode({ id, name: template, dimension: 'structural', severity: 'advisory', route: 'symbolic', validated: false }) as YAML.YAMLMap;
    node.commentBefore = `${ruleNote(rs)} (APG v2: evaluated on a graph extracted with V13_APG2_OPTIONS)`;
    kept.push(node);
  }
  // The style's built-in template merges its own functions into the parsed spec: switch off every one not mined.
  for (const f of resolveTemplate(result.style)?.functions ?? []) {
    if (ids.has(String(f.id))) continue;
    disable(doc.createNode({ id: String(f.id), name: f.name, dimension: f.dimension, severity: f.severity, route: f.route }));
  }
  if (disabled[0] !== undefined) disabled[0].commentBefore = ' not mined: switched off (the style template would otherwise add them)';
  fns.items = [...kept, ...disabled];

  const lines = [
    ' PROPOSED rules, mined from the code (daedalus mine-rules; src/rule-mining). Not a reviewed spec: review before use.',
    ...header.map((h) => ` ${h}`),
    ` mined rules: ${String(result.rules.length)} (${String(rules.length)} emitted${(opts.minConfidence ?? 0) > 0 ? ` at confidence >= ${String(opts.minConfidence)}` : ''})`,
    ...result.rules.map((r) => ` ${r.id} [${r.kind}, ${r.level} ${r.confidence.toFixed(2)}] ${r.statement}${r.exceptions.length > 0 ? ` -- ${String(r.exceptions.length)} exception(s): ${r.exceptions.slice(0, 3).map((e) => `${e.file}${e.target !== undefined ? ` -> ${e.target}` : ''}`).join(', ')}${r.exceptions.length > 3 ? ', ...' : ''}` : ''}${r.compilesTo === null ? ` -- not emitted: ${r.notRepresentable ?? 'no template'}` : ''}`),
    ...notes.map((n) => ` note: ${n}`),
  ];
  doc.commentBefore = lines.join('\n');
  return doc.toString({ lineWidth: 0 });
}
