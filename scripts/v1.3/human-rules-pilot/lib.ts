/**
 * Human-rules pilot (v1.3): translate a project's own, human-written dependency-cruiser layer rules into a
 * DaedalusArch spec, and compare our verdicts with what dependency-cruiser reports under the same rules.
 *
 * Pure functions only; `run.ts` does the I/O. No LLM is called anywhere in this pilot.
 *
 * Translation ("resolved atoms"). A dependency-cruiser `forbidden` rule is a pair of path predicates
 * (`from.path`/`from.pathNot`, `to.path`/`to.pathNot`, regular expressions tested against the module path).
 * Path sets of different rules overlap (a file can be in "domain" and "infrastructure" at once), while a
 * DaedalusArch layer is a partition. So the translator resolves every rule against the file list at the pinned
 * commit and groups files by their signature, one bit per (rule, side). Each signature class (an "atom") becomes
 * one layer that lists its files. An import A -> B between atoms is forbidden iff some rule has A on its `from`
 * side and B on its `to` side. The spec is emitted in the hexagonal style, whose `allowed_dependencies` graph
 * takes every ordered atom pair that is not forbidden; FF-S01 (dependency-direction-graph) and FF-S03
 * (layer-skip-graph) together flag exactly the imports whose pair is not allowed. Imports inside one atom
 * that a rule would forbid (the file is on both sides of a rule) are not expressible: our layer rules ignore
 * same-layer imports. They are counted as a translation gap, never silently dropped.
 */

/** A path predicate as dependency-cruiser stores it in `summary.ruleSetUsed` (string or array of regexes). */
export interface DcSide {
  readonly path?: string | readonly string[];
  readonly pathNot?: string | readonly string[];
  readonly [k: string]: unknown;
}

export interface DcRule {
  readonly name: string;
  readonly severity?: string;
  readonly comment?: string;
  readonly from: DcSide;
  readonly to: DcSide;
}

export interface DcViolation {
  readonly from: string;
  readonly to: string;
  readonly rule: { readonly name: string; readonly severity?: string };
}

const PATH_KEYS = new Set(['path', 'pathNot']);

/** A layer rule constrains only module paths on both sides (no orphan, circular, dependencyTypes, ...). */
export function isLayerRule(r: DcRule): boolean {
  const sides = [r.from ?? {}, r.to ?? {}];
  if (sides.some((s) => Object.keys(s).some((k) => !PATH_KEYS.has(k)))) return false;
  // A rule with no path predicate on either side constrains every import; that is not a layer rule.
  return sides.some((s) => s.path !== undefined || s.pathNot !== undefined);
}

/**
 * Rule names that dependency-cruiser's `--init` writes from its 'recommended' preset. They are generic hygiene
 * rules the developers kept, not architecture they declared, so they are never translated (a recorded judgement call).
 */
export const PRESET_RULE_NAMES: ReadonlySet<string> = new Set([
  'no-circular', 'no-orphans', 'no-deprecated-core', 'not-to-deprecated', 'no-deprecated-npm', 'no-non-package-json',
  'not-to-unresolvable', 'no-duplicate-dep-types', 'not-to-spec', 'not-to-test', 'not-to-dev-dep', 'optional-deps-used',
  'peer-deps-used',
]);

export interface RuleSelection {
  readonly layer: DcRule[];
  readonly excluded: { name: string; reason: string }[];
}

/** Split a rule set into the layer rules we translate and the rest (with the reason each is left out). */
export function selectLayerRules(rules: readonly DcRule[]): RuleSelection {
  const layer: DcRule[] = [];
  const excluded: { name: string; reason: string }[] = [];
  for (const r of rules) {
    if (PRESET_RULE_NAMES.has(r.name)) excluded.push({ name: r.name, reason: 'dependency-cruiser recommended preset' });
    else if (isLayerRule(r)) layer.push(r);
    else {
      const keys = [...new Set([...Object.keys(r.from ?? {}), ...Object.keys(r.to ?? {})].filter((k) => !PATH_KEYS.has(k)))];
      excluded.push({ name: r.name, reason: keys.length > 0 ? `non-path condition: ${keys.sort().join(', ')}` : 'no path predicate' });
    }
  }
  return { layer, excluded };
}

function asList(v: string | readonly string[] | undefined): string[] {
  if (v === undefined) return [];
  return typeof v === 'string' ? [v] : [...v];
}

/** dependency-cruiser semantics: an array of regexes is their alternation; an absent predicate matches all. */
export function sideMatches(side: DcSide, file: string): boolean {
  const p = asList(side.path);
  const n = asList(side.pathNot);
  if (p.length > 0 && !new RegExp(p.join('|')).test(file)) return false;
  if (n.length > 0 && new RegExp(n.join('|')).test(file)) return false;
  return true;
}

/** Is the import from -> to forbidden by rule r (path semantics only)? */
export function ruleForbids(r: DcRule, from: string, to: string): boolean {
  return sideMatches(r.from ?? {}, from) && sideMatches(r.to ?? {}, to);
}

export interface Atom {
  readonly name: string;
  /** Signature: for each layer rule (in order), [on from side, on to side]. */
  readonly signature: string;
  readonly files: string[];
  /** Human-readable reading of the signature, e.g. "from:no-domain-to-api-deps; to:no-infra-to-api-deps". */
  readonly label: string;
}

export interface Translation {
  readonly atoms: Atom[];
  /** Ordered atom pairs a rule forbids (A !== B), with the rules that forbid them. */
  readonly forbidden: { from: string; to: string; rules: string[] }[];
  /** Ordered pairs we allow: every other ordered pair of atoms. */
  readonly allowed: { from: string; to: string }[];
  /** Atoms where some rule has the atom on both sides: same-atom imports that rule forbids are not expressible. */
  readonly selfForbidden: { atom: string; rules: string[] }[];
  /** Files on no side of any layer rule: left unlayered (no rule can apply to them). */
  readonly unconstrained: string[];
}

function signatureOf(rules: readonly DcRule[], file: string): string {
  return rules.map((r) => `${sideMatches(r.from ?? {}, file) ? 'F' : '-'}${sideMatches(r.to ?? {}, file) ? 'T' : '-'}`).join('');
}

function labelOf(rules: readonly DcRule[], sig: string): string {
  const parts: string[] = [];
  rules.forEach((r, i) => {
    const s = sig.slice(i * 2, i * 2 + 2);
    if (s[0] === 'F') parts.push(`from:${r.name}`);
    if (s[1] === 'T') parts.push(`to:${r.name}`);
  });
  return parts.join('; ');
}

/** Group the files by rule signature and derive the forbidden and allowed atom pairs. */
export function translate(rules: readonly DcRule[], files: readonly string[]): Translation {
  const bySig = new Map<string, string[]>();
  const unconstrained: string[] = [];
  const empty = rules.map(() => '--').join('');
  for (const f of [...files].sort()) {
    const sig = signatureOf(rules, f);
    if (sig === empty) { unconstrained.push(f); continue; }
    const list = bySig.get(sig) ?? [];
    list.push(f);
    bySig.set(sig, list);
  }
  // Stable atom names: ordered by signature so the same rules and files always give the same spec.
  const sigs = [...bySig.keys()].sort();
  const atoms: Atom[] = sigs.map((sig, i) => ({
    name: `atom-${String(i + 1).padStart(2, '0')}`, signature: sig, files: bySig.get(sig) ?? [], label: labelOf(rules, sig),
  }));
  const forbidden: { from: string; to: string; rules: string[] }[] = [];
  const allowed: { from: string; to: string }[] = [];
  const selfForbidden: { atom: string; rules: string[] }[] = [];
  const on = (a: Atom, i: number, side: 0 | 1): boolean => a.signature[i * 2 + side] !== '-';
  for (const a of atoms) {
    const self = rules.filter((_, i) => on(a, i, 0) && on(a, i, 1)).map((r) => r.name);
    if (self.length > 0) selfForbidden.push({ atom: a.name, rules: self });
    for (const b of atoms) {
      if (a === b) continue;
      const by = rules.filter((_, i) => on(a, i, 0) && on(b, i, 1)).map((r) => r.name);
      if (by.length > 0) forbidden.push({ from: a.name, to: b.name, rules: by });
      else allowed.push({ from: a.name, to: b.name });
    }
  }
  return { atoms, forbidden, allowed, selfForbidden, unconstrained };
}

/** Escape picomatch metacharacters so a literal file path matches only itself. */
export function globLiteral(file: string): string {
  return file.replace(/[\\*?[\]{}()!+@|^$]/g, (c) => `\\${c}`);
}

/** Required by the spec schema; the pilot reads findings only, never the score. Copied from presets/hexagonal.yaml. */
const SCORING_BLOCK = [
  'scoring:', '  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }',
  '  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }',
  'confidence_thresholds: { high: 0.85, medium: 0.60, icc_minimum: 0.70 }',
];

const DUMMY_KINDS = ['domain', 'application', 'presentation', 'infrastructure'] as const;

/**
 * Emit the hexagonal spec. The hexagonal binder needs one layer of each kind; the atoms carry no kind of their
 * own, so four empty placeholder layers (matching no file, with no allowed edge) satisfy it. Kinds only bind the
 * pattern rules; only FF-S01 and FF-S03 are enabled, and those read nothing but `allowed_dependencies`.
 */
export interface BuiltIn { readonly id: string; readonly name: string; readonly dimension: string; readonly severity: string; readonly route: string }

export function toSpecYaml(t: Translation, header: readonly string[], builtIns: readonly BuiltIn[] = []): string {
  const out: string[] = header.map((h) => `# ${h}`);
  out.push('', 'spec_version: "1.0.0"', '', 'architecture:', '  style: hexagonal', '  layers:');
  for (const k of DUMMY_KINDS) {
    out.push(`    - name: placeholder-${k}`, `      kind: ${k}`, '      directories:', `        - "__no_such_dir__/${k}/**"`, '      roles: [placeholder]');
  }
  for (const a of t.atoms) {
    out.push(`    # ${a.label}`, `    - name: ${a.name}`, '      kind: application', '      roles: [atom]', '      directories:');
    for (const f of a.files) out.push(`        - ${JSON.stringify(globLiteral(f))}`);
  }
  out.push('  allowed_dependencies:');
  const byFrom = new Map<string, string[]>();
  for (const e of t.allowed) byFrom.set(e.from, [...(byFrom.get(e.from) ?? []), e.to]);
  // A placeholder edge keeps the list non-empty when every atom pair is forbidden (never the case in practice).
  if (byFrom.size === 0) byFrom.set('placeholder-application', ['placeholder-domain']);
  for (const [from, tos] of [...byFrom.entries()].sort()) out.push(`    - from: ${from}`, `      to: [${tos.sort().join(', ')}]`);
  out.push(...specTail(builtIns));
  return out.join('\n');
}

/**
 * The part of every pilot spec after `architecture`: FF-S01 and FF-S03 on, every other built-in function of the
 * style off (the parser merges them in otherwise), and the scoring blocks the schema requires.
 */
export function specTail(builtIns: readonly BuiltIn[]): string[] {
  const out: string[] = [
    '', 'fitness_functions:',
    '  - id: FF-S01', '    name: dependency-direction-graph', '    dimension: structural', '    severity: critical', '    route: symbolic', '    validated: false',
    '  - id: FF-S03', '    name: layer-skip-graph', '    dimension: structural', '    severity: critical', '    route: symbolic', '    validated: false',
  ];
  for (const f of builtIns) {
    if (f.id === 'FF-S01' || f.id === 'FF-S03') continue;
    out.push(`  - id: ${f.id}`, `    name: ${f.name}`, `    dimension: ${f.dimension}`, `    severity: ${f.severity}`, `    route: ${f.route}`,
      '    enabled: false', '    reason: "human-rules pilot: only the layer rules are compared"');
  }
  out.push('', ...SCORING_BLOCK, '');
  return out;
}

/** Complete a hand-written idiomatic spec (its `architecture` section only) into a runnable pilot spec. */
export function completeSpec(architectureYaml: string, builtIns: readonly BuiltIn[]): string {
  if (/^(fitness_functions|scoring|spec_version):/m.test(architectureYaml)) {
    throw new Error('an idiomatic spec holds the architecture section only; the pilot adds the rest');
  }
  return ['spec_version: "1.0.0"', '', architectureYaml.trimEnd(), ...specTail(builtIns)].join('\n');
}

/** Key of one forbidden import, tool-neutral. */
export function edgeKey(from: string, to: string): string {
  return `${from}|${to}`;
}

export interface Confusion {
  readonly both: number;
  readonly oursOnly: number;
  readonly theirsOnly: number;
  readonly neither: number;
  readonly kappa: number | null;
  readonly observedAgreement: number;
}

/** Cohen's kappa over a universe of edges, each labelled positive or not by each tool. */
export function confusion(universe: ReadonlySet<string>, ours: ReadonlySet<string>, theirs: ReadonlySet<string>): Confusion {
  let both = 0; let oursOnly = 0; let theirsOnly = 0; let neither = 0;
  const all = new Set([...universe, ...ours, ...theirs]);
  for (const e of all) {
    const o = ours.has(e); const t = theirs.has(e);
    if (o && t) both++; else if (o) oursOnly++; else if (t) theirsOnly++; else neither++;
  }
  const n = all.size;
  const po = n === 0 ? 1 : (both + neither) / n;
  const pOurs = n === 0 ? 0 : (both + oursOnly) / n;
  const pTheirs = n === 0 ? 0 : (both + theirsOnly) / n;
  const pe = pOurs * pTheirs + (1 - pOurs) * (1 - pTheirs);
  // Kappa is undefined when chance agreement is 1 (both tools constant on the universe, e.g. no positives at all).
  const kappa = pe === 1 ? null : (po - pe) / (1 - pe);
  return { both, oursOnly, theirsOnly, neither, kappa, observedAgreement: po };
}

/** dependency-cruiser's layer-rule violations as edge keys, restricted to files in scope. */
export function theirKeys(violations: readonly DcViolation[], layerRuleNames: ReadonlySet<string>, scope: ReadonlySet<string>): Set<string> {
  const keys = new Set<string>();
  for (const v of violations) {
    if (!layerRuleNames.has(v.rule.name)) continue;
    if (!scope.has(v.from) || !scope.has(v.to)) continue;
    keys.add(edgeKey(v.from, v.to));
  }
  return keys;
}

export interface OursViolation {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly isTypeOnly?: boolean;
  readonly metadata?: Record<string, unknown>;
}

/** Our FF-S01/FF-S03 findings as edge keys, restricted to files in scope. */
export function ourKeys(violations: readonly OursViolation[], scope: ReadonlySet<string>, opts: { dropTypeOnly?: boolean } = {}): Set<string> {
  const keys = new Set<string>();
  for (const v of violations) {
    if (v.functionId !== 'FF-S01' && v.functionId !== 'FF-S03') continue;
    const target = v.target ?? '';
    if (!scope.has(v.filePath) || !scope.has(target)) continue;
    const typeOnly = v.isTypeOnly === true || v.metadata?.isTypeOnly === true;
    if (opts.dropTypeOnly === true && typeOnly) continue;
    keys.add(edgeKey(v.filePath, target));
  }
  return keys;
}

/** Same-atom edges that a human rule forbids: what the translation cannot express, counted from the edge list. */
export function inexpressibleEdges(rules: readonly DcRule[], t: Translation, edges: Iterable<string>): string[] {
  const atomOf = new Map<string, string>();
  for (const a of t.atoms) for (const f of a.files) atomOf.set(f, a.name);
  const out: string[] = [];
  for (const e of edges) {
    const [from, to] = e.split('|') as [string, string];
    const a = atomOf.get(from);
    if (a === undefined || a !== atomOf.get(to)) continue;
    if (rules.some((r) => ruleForbids(r, from, to))) out.push(e);
  }
  return out.sort();
}

export interface Seed {
  readonly from: string;
  readonly to: string;
  /** true: some human layer rule forbids the import (a seeded violation); false: no rule does (a control). */
  readonly forbidden: boolean;
  readonly rules: string[];
}

function spread<T>(xs: readonly T[], k: number): T[] {
  if (xs.length <= k) return [...xs];
  return Array.from({ length: k }, (_, i) => xs[Math.floor((i * xs.length) / k)] as T);
}

/**
 * Choose imports to seed, deterministically (no randomness): for each layer rule, up to `perRule` file pairs the
 * rule forbids, evenly spread over the sorted candidates; and as many controls, pairs between two constrained
 * files in different directories that no rule forbids. Pairs that already have an import are skipped.
 */
export function chooseSeeds(rules: readonly DcRule[], files: readonly string[], existing: ReadonlySet<string>, perRule: number): Seed[] {
  const sorted = [...files].sort();
  const dir = (f: string): string => f.slice(0, f.lastIndexOf('/'));
  const constrained = sorted.filter((f) => rules.some((r) => sideMatches(r.from ?? {}, f) || sideMatches(r.to ?? {}, f)));
  const taken = new Set<string>();
  const seeds: Seed[] = [];
  for (const r of rules) {
    const cands: [string, string][] = [];
    for (const f of sorted) {
      if (!sideMatches(r.from ?? {}, f)) continue;
      for (const t of sorted) if (t !== f && sideMatches(r.to ?? {}, t) && !existing.has(edgeKey(f, t))) cands.push([f, t]);
    }
    for (const [f, t] of spread(cands.filter(([f, t]) => !taken.has(edgeKey(f, t))), perRule)) {
      taken.add(edgeKey(f, t));
      seeds.push({ from: f, to: t, forbidden: true, rules: rules.filter((x) => ruleForbids(x, f, t)).map((x) => x.name) });
    }
  }
  const positives = seeds.length;
  const controls: [string, string][] = [];
  for (const f of constrained) {
    for (const t of constrained) {
      if (t === f || dir(t) === dir(f) || existing.has(edgeKey(f, t)) || taken.has(edgeKey(f, t))) continue;
      if (!rules.some((r) => ruleForbids(r, f, t))) controls.push([f, t]);
    }
  }
  for (const [f, t] of spread(controls, positives)) seeds.push({ from: f, to: t, forbidden: false, rules: [] });
  return seeds;
}

/** The module specifier `from` uses to import `to` (relative, extension dropped). */
export function importSpecifier(from: string, to: string): string {
  const fromParts = from.split('/').slice(0, -1);
  const toParts = to.replace(/\.(d\.)?tsx?$/, '').split('/');
  let i = 0;
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) i++;
  const up = fromParts.length - i;
  const rest = toParts.slice(i).join('/');
  return up === 0 ? `./${rest}` : `${'../'.repeat(up)}${rest}`;
}
