/**
 * v1.3 human labelling: the BLIND UNION sheet and its multi-rater agreement (Docs/v1.3/human-labelling-protocol.md).
 *
 * Items, per case (reference variant): manifest findings ∪ tool findings ∪ 1–2 decoys. A finding in both the manifest
 * and the tool output (matched by `compare.ts`) appears once, as `both`.
 *
 * - **Uniform, source-blind wording.** Every item's claim is written by `claimFor` from the same four facts (the
 *   rule's template name, the file, the target, the layers of the reference graph), whatever its source, so a rater
 *   cannot tell a tool row from a manifest row by its wording (a tool message carries class names a manifest row does
 *   not have). The line is computed the same way for every source: the line of the import of the target in the file,
 *   or none. Rule ids, template names and violation types are never shown.
 * - **Decoys** perturb a real finding so that its claim is false: `target-swap` (same file and rule wording, another
 *   target the file does not import), `direction-flip` (the edge reversed, when the target does not import the file)
 *   and, for a case with too few import-shaped findings, `graph-flip` (an edge of the reference graph between two
 *   layers, reversed, so that it reads as an inward-to-outward import) or else `graph-swap` (its target swapped). Falsity is checked on the materialised source: a candidate is rejected when any import specifier of the
 *   file could name it (relative path, a barrel directory above it, or an alias ending in its name).
 * - **Draw.** Strata are style × source. About `negativeShare` of the items are negatives (decoys, and tool-only rows
 *   on clean and near-miss variants, which the manifest expects to be `no`); each side is drawn round-robin over its
 *   strata in a seeded order, each stratum in a seeded order (as `selectAuditStratified`), then shuffled. A stratum
 *   with fewer items than its share is taken whole.
 * - **Key** in a separate file: item id -> case, source, rule, decoy recipe. The sheet holds none of it.
 *
 * Agreement (`unionAgreement`): every pair of raters (humans and the model labeller) gets the 3×3 table, κ and AC1
 * on the three-way and binary (`yes` vs not `yes`) labels and observed agreement with its Wilson interval; the gate
 * is Cohen's κ ≥ 0.60 on the binary split (point estimate, protocol §3, §6). Per rater: the decoy false-accept rate
 * (decoys answered `yes`), and the share of `yes` per source stratum, with Wilson intervals.
 */
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import ts from 'typescript';
import { compareVariant, cycleFileSet, CYCLE_RULE_IDS } from '../compare.js';
import type { ActualFinding } from '../compare.js';
import type { LoadedReference, VariantKind } from '../reference-model.js';
import { createRng, fleissKappa, shuffle, wilson } from '../../../lib/stats.js';
import { derivedSeed } from './sampler.js';
import type { SampledFinding } from './sampler.js';
import type { Finding } from './findings.js';
import { QUESTION, excerpt } from './meaningful-prompt.js';
import { stripComments } from './excerpt-scrub.js';
import { agreement } from './audit.js';
import type { Agreement } from './audit.js';

export type UnionSource = 'manifest-only' | 'tool-only' | 'both' | 'decoy';
export const UNION_SOURCES: readonly UnionSource[] = ['manifest-only', 'tool-only', 'both', 'decoy'];
export type DecoyKind = 'target-swap' | 'direction-flip' | 'graph-flip' | 'graph-swap';
export const DEFAULT_NEGATIVE_SHARE = 0.25;
export const UNION_SIZES = [60, 120] as const;
export const ANYTHING_ELSE_CASES = 20;
export const BINARY_KAPPA_GATE = 0.6;

export interface UnionItem {
  readonly key: string;
  readonly projectId: string;
  readonly style: string;
  readonly variant: string;
  readonly kind: VariantKind;
  readonly source: UnionSource;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly file: string;
  readonly target?: string;
  readonly line?: number;
  /** The claim without its line (the line is appended at rendering). */
  readonly claim: string;
  /** Decoys, and tool-only rows on clean or near-miss variants. */
  readonly expectedNegative: boolean;
  readonly decoy?: { readonly kind: DecoyKind; readonly perturbs: string; readonly check: string };
}

/** One case as the union builder needs it. */
export interface UnionCase {
  readonly ref: LoadedReference;
  readonly variant: string;
  /** The tool's rows for the variant (any rule; out-of-scope rows are dropped). */
  readonly tool: readonly ActualFinding[];
  /** Project-relative file -> source text of the materialised variant. */
  readonly sources: ReadonlyMap<string, string>;
  /** Files of the variant with a layer (the reference graph, then the tool's graph for files it does not list). */
  readonly layerOf: (file: string) => string | null;
}

// ── Wording ───────────────────────────────────────────────────────────────────

const L = (layerOf: (f: string) => string | null, f: string): string => layerOf(f) ?? 'unassigned';

/**
 * The claim of an item from its template (the compared rule's name), file and target. The wording follows the tool's
 * message for the template, with the names the tool takes from the graph (aggregate, class) left out.
 */
export function claimFor(ruleName: string, file: string, target: string | undefined, layerOf: (f: string) => string | null): string {
  const t = target ?? '?';
  switch (ruleName) {
    case 'dependency-direction':
      return `${file} (${L(layerOf, file)}) imports from ${t} (${L(layerOf, t)})`;
    case 'dependency-direction-graph':
      return `${file} (${L(layerOf, file)}) imports against the allowed direction from ${t} (${L(layerOf, t)})`;
    case 'no-domain-outward-dep':
      return `Domain file ${file} imports from ${t} in ${L(layerOf, t)}`;
    case 'core-isolation':
      return `Core file ${file} imports from ${t} in ${L(layerOf, t)}`;
    case 'no-layer-skip':
      return `${file} (${L(layerOf, file)}) skips layers to import ${t} (${L(layerOf, t)})`;
    case 'layer-skip-graph':
      return `${file} (${L(layerOf, file)}) imports ${t} (${L(layerOf, t)}) sideways, with no allowed dependency between the layers`;
    case 'no-cyclic-deps': {
      const files = cycleFileSet({ file, target });
      return `Circular dependency between ${files.split(',').join(', ')}`;
    }
    case 'domain-purity':
      return `Domain file ${file} imports forbidden package ${t}`;
    case 'domain-state-purity':
      return `A domain class in ${file} holds ${t} (${L(layerOf, t)})`;
    case 'repository-pattern':
      return `A repository class in ${file} implements no interface`;
    case 'port-adapter-pattern':
      return `An outbound adapter class in ${file} implements no port interface declared in the core or the application layer`;
    case 'dependency-inversion':
      return `A class in ${file} depends on a concrete implementation instead of an abstraction${target !== undefined ? ` (${target})` : ''}`;
    case 'port-dependency-inversion':
      return `A service in ${file} depends on a concrete class instead of a port${target !== undefined ? ` (${target})` : ''}`;
    case 'use-case-isolation':
      return `A use case in ${file} depends on another use case${target !== undefined ? ` (${target})` : ''}`;
    case 'controller-no-entity':
      return `Controller ${file} uses a domain entity directly${target !== undefined ? ` (${target})` : ''}`;
    case 'aggregate-boundary':
      return `${file} imports ${t}, an inner entity of an aggregate`;
    case 'repository-aggregate-root':
      return `Repository ${file} imports ${t}, an inner entity of an aggregate`;
    case 'context-isolation':
      return `${file} imports ${t}, which is not in the public API of its bounded context`;
    case 'bounded-context-modules':
      return `${file} lies in no declared bounded context`;
    case 'value-object-immutability':
      return `A value object in ${file} is mutable`;
    case 'domain-event-placement':
      return `A domain event is defined in ${file} outside the domain`;
    case 'application-service-thin':
      return `An application service in ${file} declares too many methods`;
    default:
      return target !== undefined ? `${file} depends on ${target}` : `${file} breaks a constraint of the style`;
  }
}

/** Templates whose claim is an import of `target` by `file` (decoys can perturb them). */
export const EDGE_TEMPLATES: ReadonlySet<string> = new Set([
  'dependency-direction', 'dependency-direction-graph', 'no-domain-outward-dep', 'core-isolation', 'no-layer-skip',
  'layer-skip-graph', 'aggregate-boundary', 'repository-aggregate-root', 'context-isolation', 'domain-state-purity',
]);
const PACKAGE_TEMPLATES: ReadonlySet<string> = new Set(['domain-purity']);
const DECOY_PACKAGES = ['typeorm', 'express', '@nestjs/common', 'mongoose', 'class-validator', 'prisma', 'sequelize', 'inversify'];

// ── Imports of a source file ──────────────────────────────────────────────────

interface Specifier { readonly text: string; readonly line: number }

export function importSpecifiers(source: string): Specifier[] {
  const info = ts.preProcessFile(source, true, true);
  const lineOf = (pos: number): number => source.slice(0, pos).split('\n').length;
  return info.importedFiles.map((f) => ({ text: f.fileName, line: lineOf(f.pos) }));
}

const stripExt = (p: string): string => p.replace(/\.(d\.ts|tsx?|jsx?|mjs|cjs)$/, '');

/** Could the import specifier `spec` of `file` name `candidate` (a project-relative file or a package)? Conservative. */
export function specifierMayName(file: string, spec: string, candidate: string): boolean {
  if (!candidate.startsWith('src/')) return spec === candidate || spec.startsWith(`${candidate}/`);
  const cand = stripExt(candidate);
  if (spec.startsWith('.')) {
    const r = stripExt(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    return r === cand || `${r}/index` === cand || cand.startsWith(`${r}/`);
  }
  const last = stripExt(spec.split('/').pop() ?? '');
  return last === path.posix.basename(cand) || path.posix.dirname(cand).split('/').includes(last);
}

/** Could one of `file`'s import specifiers name `candidate`? */
export function mayReference(file: string, source: string, candidate: string): boolean {
  return importSpecifiers(source).some((s) => specifierMayName(file, s.text, candidate));
}

/** The line of the first import in `source` that may name `target`, if any. */
export function importLine(file: string, source: string | undefined, target: string | undefined): number | undefined {
  if (source === undefined || target === undefined) return undefined;
  return importSpecifiers(source).find((s) => specifierMayName(file, s.text, target))?.line;
}

// ── Building the items ────────────────────────────────────────────────────────

function itemKey(parts: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}

export interface UnionBuildOptions {
  readonly seed: number;
  readonly decoysPerCase: 1 | 2;
  /** `blocking` (default): only the style's blocking rules; `all`: every compared rule. */
  readonly tiers: 'blocking' | 'all';
}

export function buildCaseItems(c: UnionCase, opts: UnionBuildOptions): { items: UnionItem[]; decoyShortfall: number } {
  const ref = c.ref;
  const v = ref.variants.find((x) => x.manifest.variant === c.variant);
  if (v === undefined) throw new Error(`${ref.style}: no variant ${c.variant}`);
  const inTier = (id: string): boolean => opts.tiers === 'all' || ref.descriptor.scopeRules.find((r) => r.ruleId === id)?.blockingCandidate === true;
  const scope = new Set(ref.descriptor.scopeRules.filter((r) => inTier(r.ruleId)).map((r) => r.ruleId));
  const nameOf = (id: string): string => ref.descriptor.scopeRules.find((r) => r.ruleId === id)?.ruleName ?? id;
  const manifest = { ...v.manifest, expectedFindings: v.manifest.expectedFindings.filter((f) => scope.has(f.ruleId)) };
  const tool = c.tool.filter((a) => scope.has(a.ruleId));
  const cmp = compareVariant(ref.style, manifest, tool, scope);
  const projectId = `${ref.style}/${c.variant}`;
  const items: UnionItem[] = [];
  const firstFile = (f: string): string => f.split(',')[0] ?? f;
  const make = (source: UnionSource, ruleId: string, fileRaw: string, target: string | undefined): UnionItem => {
    const cycle = CYCLE_RULE_IDS.has(ruleId);
    const files = cycle ? cycleFileSet({ file: fileRaw, target }).split(',') : [];
    const file = cycle ? (files[0] ?? firstFile(fileRaw)) : fileRaw;
    const tgt = cycle ? files.slice(1).join(',') || undefined : target;
    const line = importLine(file, c.sources.get(file), cycle ? files[1] : tgt);
    const ruleName = nameOf(ruleId);
    return {
      key: itemKey([projectId, source, ruleId, file, tgt ?? '']),
      projectId, style: ref.style, variant: c.variant, kind: v.manifest.kind, source, ruleId, ruleName, file,
      ...(tgt !== undefined && { target: tgt }), ...(line !== undefined && { line }),
      claim: claimFor(ruleName, file, tgt, c.layerOf),
      expectedNegative: source === 'tool-only' && v.manifest.kind !== 'violation',
    };
  };
  for (const e of cmp.matched) items.push(make('both', e.ruleId, e.file, e.target));
  for (const m of cmp.mismatches) items.push(make(m.kind === 'missed' ? 'manifest-only' : 'tool-only', m.ruleId, m.file, m.target));

  // Decoys.
  const rng = createRng(derivedSeed(opts.seed, 'union-decoys', projectId));
  const files = [...c.sources.keys()].filter((f) => f.startsWith('src/') && f.endsWith('.ts')).sort();
  const decoys: UnionItem[] = [];
  const taken = new Set(items.map((i) => `${i.file}|${i.target ?? ''}`));
  const addDecoy = (kind: DecoyKind, ruleName: string, ruleId: string, file: string, target: string, perturbs: string, check: string, line: number | undefined): void => {
    if (decoys.length >= opts.decoysPerCase || taken.has(`${file}|${target}`)) return;
    taken.add(`${file}|${target}`);
    decoys.push({
      key: itemKey([projectId, 'decoy', kind, file, target]),
      projectId, style: ref.style, variant: c.variant, kind: v.manifest.kind, source: 'decoy', ruleId, ruleName, file, target,
      ...(line !== undefined && { line }),
      claim: claimFor(ruleName, file, target, c.layerOf), expectedNegative: true, decoy: { kind, perturbs, check },
    });
  };
  const swapTarget = (ruleName: string, ruleId: string, file: string, target: string, kind: DecoyKind, perturbs: string): void => {
    const src = c.sources.get(file);
    if (src === undefined) return;
    const line = importLine(file, src, target);
    if (PACKAGE_TEMPLATES.has(ruleName) || !target.startsWith('src/')) {
      const pkgs = shuffle(DECOY_PACKAGES.filter((p) => p !== target), rng).filter((p) => !mayReference(file, src, p));
      const p = pkgs[0];
      if (p !== undefined) addDecoy(kind, ruleName, ruleId, file, p, perturbs, `no import specifier of ${file} names ${p}`, line);
      return;
    }
    const tl = c.layerOf(target);
    const fl = c.layerOf(file);
    const candidates = shuffle(files.filter((f) => f !== file && f !== target && !mayReference(file, src, f)), rng);
    const pick = candidates.find((f) => tl !== null && c.layerOf(f) === tl) ?? candidates.find((f) => c.layerOf(f) !== null && c.layerOf(f) !== fl);
    if (pick !== undefined) addDecoy(kind, ruleName, ruleId, file, pick, perturbs, `no import specifier of ${file} can name ${pick}`, line);
  };
  const edgeItems = shuffle(items.filter((i) => EDGE_TEMPLATES.has(i.ruleName) || PACKAGE_TEMPLATES.has(i.ruleName)).filter((i) => i.target !== undefined), rng);
  for (const it of edgeItems) {
    if (decoys.length >= opts.decoysPerCase) break;
    swapTarget(it.ruleName, it.ruleId, it.file, it.target ?? '', 'target-swap', `${it.ruleId} ${it.file} -> ${it.target ?? ''}`);
    if (decoys.length >= opts.decoysPerCase) break;
    const t = it.target ?? '';
    const tsrc = c.sources.get(t);
    if (EDGE_TEMPLATES.has(it.ruleName) && tsrc !== undefined && !mayReference(t, tsrc, it.file)) {
      const first = importSpecifiers(tsrc)[0]?.line;
      addDecoy('direction-flip', it.ruleName, it.ruleId, t, it.file, `${it.ruleId} ${it.file} -> ${t}`, `no import specifier of ${t} can name ${it.file}`, first);
    }
  }
  if (decoys.length < opts.decoysPerCase) {
    // No import-shaped finding (or too few): perturb an edge of the reference graph, worded as the style's
    // direction rule.
    const dir = ref.descriptor.scopeRules.find((r) => r.ruleName === 'dependency-direction' || r.ruleName === 'dependency-direction-graph');
    const present = new Set(files);
    const edges = shuffle(ref.graph.edges.filter((e) => present.has(e.from) && present.has(e.to)), rng);
    for (const e of edges) {
      if (decoys.length >= opts.decoysPerCase || dir === undefined) break;
      const lf = c.layerOf(e.from);
      const lt = c.layerOf(e.to);
      const tsrc = c.sources.get(e.to);
      if (lf === null || lt === null || lf === lt || tsrc === undefined || mayReference(e.to, tsrc, e.from)) continue;
      addDecoy('graph-flip', dir.ruleName, dir.ruleId, e.to, e.from, `graph edge ${e.from} -> ${e.to}`, `no import specifier of ${e.to} can name ${e.from}`, importSpecifiers(tsrc)[0]?.line);
    }
    for (const e of edges) {
      if (decoys.length >= opts.decoysPerCase || dir === undefined) break;
      swapTarget(dir.ruleName, dir.ruleId, e.from, e.to, 'graph-swap', `graph edge ${e.from} -> ${e.to}`);
    }
  }
  return { items: [...items, ...decoys], decoyShortfall: opts.decoysPerCase - decoys.length };
}

// ── The draw ──────────────────────────────────────────────────────────────────

export const stratumOf = (i: Pick<UnionItem, 'style' | 'source'>): string => `${i.style}/${i.source}`;

function roundRobin(pool: readonly UnionItem[], quota: number, seed: number, tag: string): UnionItem[] {
  const strata = new Map<string, UnionItem[]>();
  for (const it of [...pool].sort((a, b) => (a.key < b.key ? -1 : 1))) strata.set(stratumOf(it), [...(strata.get(stratumOf(it)) ?? []), it]);
  const queues = shuffle([...strata.keys()].sort(), createRng(derivedSeed(seed, `union-strata-${tag}`)))
    .map((k) => shuffle(strata.get(k) ?? [], createRng(derivedSeed(seed, 'union', tag, k))));
  const chosen: UnionItem[] = [];
  while (chosen.length < quota && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (next !== undefined && chosen.length < quota) chosen.push(next);
    }
  }
  return chosen;
}

export interface UnionDraw {
  readonly items: readonly UnionItem[];
  readonly negatives: number;
  readonly allocation: Readonly<Record<string, number>>;
  readonly warnings: readonly string[];
}

export function selectUnion(items: readonly UnionItem[], n: number, seed: number, negativeShare = DEFAULT_NEGATIVE_SHARE): UnionDraw {
  if (!Number.isInteger(n) || n <= 0) throw new Error('the union sheet size must be a positive integer');
  const warnings: string[] = [];
  const neg = items.filter((i) => i.expectedNegative);
  const pos = items.filter((i) => !i.expectedNegative);
  // Keep the negative share: when positives run short the sheet shrinks rather than filling with negatives; when
  // negatives run short the share drops (both are reported).
  let posQuota = Math.min(Math.round((1 - negativeShare) * n), pos.length);
  let negQuota = Math.min(n - posQuota, neg.length);
  if (posQuota < Math.round((1 - negativeShare) * n) && negativeShare < 1) {
    negQuota = Math.min(neg.length, Math.round((posQuota * negativeShare) / (1 - negativeShare)));
  } else if (negQuota < n - posQuota) {
    posQuota = Math.min(pos.length, n - negQuota);
  }
  const size = posQuota + negQuota;
  if (size < n) warnings.push(`only ${String(pos.length)} positive and ${String(neg.length)} negative candidates; the sheet has ${String(size)} items, not ${String(n)}`);
  if (size > 0 && Math.abs(negQuota / size - negativeShare) > 0.05) warnings.push(`negative share is ${(negQuota / size).toFixed(2)}, not ${negativeShare.toFixed(2)} (too few negatives)`);
  const chosen = [...roundRobin(neg, negQuota, seed, 'neg'), ...roundRobin(pos, posQuota, seed, 'pos')];
  const allocation: Record<string, number> = {};
  for (const c of chosen) allocation[stratumOf(c)] = (allocation[stratumOf(c)] ?? 0) + 1;
  return { items: shuffle(chosen, createRng(derivedSeed(seed, 'union-order'))), negatives: negQuota, allocation, warnings };
}

/** A seeded subsample of the cases on the sheet for the "anything else?" pass. */
export function selectCases(items: readonly UnionItem[], seed: number, k = ANYTHING_ELSE_CASES): string[] {
  const cases = [...new Set(items.map((i) => i.projectId))].sort();
  return shuffle(cases, createRng(derivedSeed(seed, 'union-cases'))).slice(0, k).sort();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export const unionId = (i: number): string => `U${String(i + 1).padStart(3, '0')}`;
export const caseId = (i: number): string => `K${String(i + 1).padStart(2, '0')}`;
const cell = (t: string): string => t.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function renderedClaim(i: Pick<UnionItem, 'claim' | 'line'>): string {
  return i.line !== undefined ? `${i.claim} (line ${String(i.line)})` : i.claim;
}

/** Opaque case labels (C01, C02, …) in a seeded order of the cases on the sheet; they carry no source or rule. */
export function caseLabels(chosen: readonly UnionItem[], seed: number): Map<string, string> {
  const cases = shuffle([...new Set(chosen.map((i) => i.projectId))].sort(), createRng(derivedSeed(seed, 'union-case-labels')));
  return new Map(cases.map((pid, i) => [pid, `C${String(i + 1).padStart(2, '0')}`]));
}

export function unionSheet(chosen: readonly UnionItem[], sourceOf: (i: UnionItem) => string | null, cases: ReadonlyMap<string, string> = new Map()): string {
  const parts = [
    '# v1.3 blind labelling sheet',
    '',
    `Question for every item: **${QUESTION}**`,
    '',
    'Answer for the style named on the row, from the code shown (codebook: Docs/v1.3/human-labelling-protocol.md,',
    'Appendix A; en español: Apéndice B). Write `yes`, `no` or `uncertain` in the `[Answer]` column; a one-line note is',
    'optional. Each item\'s code excerpt (comments removed) is under the table, in the section of the same id. Do not',
    'open the key file, the tool, the manifests or another rater\'s sheet. Items of the same case (one variant of a',
    'project) share a case label.',
    '',
    '| ID | Case | Style | Location | Claim | [Answer] | Note |',
    '|---|---|---|---|---|---|---|',
  ];
  chosen.forEach((it, i) => {
    const loc = `${it.file}${it.line !== undefined ? `:${String(it.line)}` : ''}`;
    parts.push(`| ${unionId(i)} | ${cases.get(it.projectId) ?? ''} | ${it.style} | \`${cell(loc)}\` | ${cell(renderedClaim(it))} |  |  |`);
  });
  parts.push('', '## Excerpts', '');
  chosen.forEach((it, i) => {
    const src = sourceOf(it);
    parts.push(`### ${unionId(i)}`, '', `${cases.get(it.projectId) ?? ''} ${it.style}, \`${it.file}\``.trim(), '', '```ts', src === null ? '(file not readable)' : excerpt(src, it.line), '```', '');
  });
  return parts.join('\n');
}

/** The "anything else?" pass: per sampled case, its file tree and the full (comment-free) files of its items. */
export function anythingElseSheet(chosen: readonly UnionItem[], cases: readonly string[], filesOf: (projectId: string) => readonly string[], read: (projectId: string, file: string) => string | null, labels: ReadonlyMap<string, string> = new Map()): string {
  const idOf = new Map(chosen.map((it, i) => [it.key, unionId(i)]));
  const parts = [
    '# v1.3 blind labelling: "anything else?" pass',
    '',
    'For each case below, read the whole case and list every violation of its style that is **not** already an item of',
    'the main sheet (the items of the case are listed). Write one violation per line under `[Other violations]`',
    '(file, what is wrong), or `none`.',
    '',
  ];
  cases.forEach((pid, ci) => {
    const its = chosen.filter((x) => x.projectId === pid);
    const style = its[0]?.style ?? pid.split('/')[0] ?? '';
    parts.push(`## ${labels.get(pid) ?? caseId(ci)} (${style})`, '', `Items of this case on the main sheet: ${its.map((x) => idOf.get(x.key) ?? '').join(', ')}`, '', 'Files:', '');
    for (const f of filesOf(pid)) parts.push(`- \`${f}\``);
    parts.push('');
    for (const f of [...new Set(its.map((x) => x.file))].sort()) {
      const src = read(pid, f);
      parts.push(`### ${labels.get(pid) ?? caseId(ci)}: \`${f}\``, '', '```ts', src === null ? '(file not readable)' : stripComments(src), '```', '');
    }
    parts.push('[Other violations]:', '', '');
  });
  return parts.join('\n');
}

export interface UnionKeyRow {
  readonly itemId: string;
  readonly key: string;
  readonly projectId: string;
  readonly style: string;
  readonly variant: string;
  readonly kind: VariantKind;
  readonly source: UnionSource;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly file: string;
  readonly target?: string;
  readonly expectedNegative: boolean;
  readonly decoy?: UnionItem['decoy'];
}

export function unionKeyRows(chosen: readonly UnionItem[]): UnionKeyRow[] {
  return chosen.map((it, i) => ({
    itemId: unionId(i), key: it.key, projectId: it.projectId, style: it.style, variant: it.variant, kind: it.kind,
    source: it.source, ruleId: it.ruleId, ruleName: it.ruleName, file: it.file, ...(it.target !== undefined && { target: it.target }),
    expectedNegative: it.expectedNegative, ...(it.decoy !== undefined && { decoy: it.decoy }),
  }));
}

/**
 * The items as labeller findings (`label-meaningful.ts --sample`): the claim is the message, the template and rule id
 * are blank, so the labeller's prompt shows exactly the sheet's claim and excerpt.
 */
export function unionAsSampled(chosen: readonly UnionItem[]): SampledFinding[] {
  return chosen.map((it): SampledFinding => {
    const f: Finding = {
      key: it.key, projectId: it.projectId, style: it.style, ruleId: '', template: '', type: 'UNION_ITEM', tier: 'blocking',
      file: it.file, ...(it.line !== undefined && { line: it.line }), discriminator: [], evidence: [], message: it.claim,
    };
    return { ...f, rule: 'union', inclusionProbability: 1 };
  });
}

// ── Answers ───────────────────────────────────────────────────────────────────

/** Answer rows (`itemId`, `answer`, `note`) from a filled sheet (Markdown table) or a CSV (`itemId,answer,note`). */
export function parseUnionAnswers(text: string, csv: boolean): { itemId: string; answer: string; note: string }[] {
  const norm = (s: string): string => s.replace(/[`*[\]]/g, '').trim().toLowerCase();
  if (csv) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    const header = (lines[0] ?? '').split(',').map((h) => h.trim());
    const ix = (n: string): number => header.indexOf(n);
    return lines.slice(1).map((l) => {
      const c = l.split(',');
      return { itemId: (c[ix('itemId')] ?? '').trim(), answer: norm(c[ix('answer')] ?? ''), note: c.slice(Math.max(ix('note'), 0)).join(',').trim() };
    });
  }
  const out: { itemId: string; answer: string; note: string }[] = [];
  for (const line of text.split('\n')) {
    if (!/^\|\s*U\d{3}\s*\|/.test(line)) continue;
    const cells = line.replace(/\\\|/g, '\uE000').split('|').slice(1, -1).map((c) => c.replace(/\uE000/g, '|').trim());
    // | ID | Case | Style | Location | Claim | [Answer] | Note |
    out.push({ itemId: cells[0] ?? '', answer: norm(cells[cells.length - 2] ?? ''), note: cells[cells.length - 1] ?? '' });
  }
  return out;
}

// ── Agreement ─────────────────────────────────────────────────────────────────

export interface ProportionCi { readonly k: number; readonly n: number; readonly share: number | null; readonly low: number | null; readonly high: number | null }

function prop(k: number, n: number): ProportionCi {
  if (n === 0) return { k, n, share: null, low: null, high: null };
  const ci = wilson(k, n);
  return { k, n, share: k / n, low: ci.low, high: ci.high };
}

export interface PairAgreement {
  readonly a: string;
  readonly b: string;
  readonly threeWay: Agreement;
  readonly binary: Agreement;
  readonly gate: { readonly threshold: number; readonly kappa: number | null; readonly pass: boolean };
}

export interface RaterSummary {
  readonly rater: string;
  readonly answered: number;
  readonly unanswered: readonly string[];
  readonly invalid: readonly string[];
  /** Decoys answered `yes` / decoys answered. */
  readonly decoyFalseAccept: ProportionCi;
  /** `yes` / answered, per source stratum and pooled over the non-decoy items. */
  readonly yesBySource: Readonly<Record<string, ProportionCi>>;
  /** `yes` among the tool's findings (tool-only + both): human *meaningful* precision. */
  readonly toolYes: ProportionCi;
  /** `yes` among the manifest's findings (manifest-only + both): manifest items confirmed. */
  readonly manifestYes: ProportionCi;
  readonly uncertain: number;
}

export interface UnionAgreementReport {
  readonly raters: readonly string[];
  readonly primary: string;
  readonly pairs: readonly PairAgreement[];
  readonly fleissKappaBinary: number | null;
  readonly fleissItems: number;
  readonly summaries: readonly RaterSummary[];
}

const LABELS = ['yes', 'no', 'uncertain'];

/**
 * `labels`: rater name -> item id -> label (`yes` / `no` / `uncertain`). The first rater is the primary human reference
 * (the second rater of protocol §4).
 */
export function unionAgreement(key: readonly UnionKeyRow[], labels: ReadonlyMap<string, ReadonlyMap<string, string>>): UnionAgreementReport {
  const raters = [...labels.keys()];
  if (raters.length < 2) throw new Error('agreement needs at least two raters');
  const pairs: PairAgreement[] = [];
  for (let i = 0; i < raters.length; i += 1) {
    for (let j = i + 1; j < raters.length; j += 1) {
      const a = raters[i] ?? '';
      const b = raters[j] ?? '';
      const la = labels.get(a);
      const lb = labels.get(b);
      const both: [string, string][] = [];
      for (const k of key) {
        const x = la?.get(k.itemId);
        const y = lb?.get(k.itemId);
        if (x !== undefined && y !== undefined && LABELS.includes(x) && LABELS.includes(y)) both.push([x, y]);
      }
      const threeWay = agreement(both, LABELS);
      const binary = agreement(both.map(([x, y]) => [x === 'yes' ? 'yes' : 'not-yes', y === 'yes' ? 'yes' : 'not-yes']), ['yes', 'not-yes']);
      pairs.push({ a, b, threeWay, binary, gate: { threshold: BINARY_KAPPA_GATE, kappa: binary.kappa, pass: binary.kappa !== null && binary.kappa >= BINARY_KAPPA_GATE } });
    }
  }
  // Fleiss' κ (binary) over the items every rater answered.
  const full = key.filter((k) => raters.every((r) => LABELS.includes(labels.get(r)?.get(k.itemId) ?? '')));
  let fleiss: number | null = null;
  if (full.length > 0) {
    const counts = full.map((k) => {
      const yes = raters.filter((r) => labels.get(r)?.get(k.itemId) === 'yes').length;
      return [yes, raters.length - yes];
    });
    const v = fleissKappa(counts);
    fleiss = Number.isFinite(v) ? v : null;
  }
  const summaries = raters.map((r): RaterSummary => {
    const l = labels.get(r) ?? new Map<string, string>();
    const unanswered = key.filter((k) => !l.has(k.itemId) || l.get(k.itemId) === '').map((k) => k.itemId);
    const invalid = key.filter((k) => l.has(k.itemId) && l.get(k.itemId) !== '' && !LABELS.includes(l.get(k.itemId) ?? '')).map((k) => k.itemId);
    const answered = key.filter((k) => LABELS.includes(l.get(k.itemId) ?? ''));
    const yesOf = (rows: readonly UnionKeyRow[]): ProportionCi => prop(rows.filter((k) => l.get(k.itemId) === 'yes').length, rows.length);
    const bySource: Record<string, ProportionCi> = {};
    for (const s of UNION_SOURCES) bySource[s] = yesOf(answered.filter((k) => k.source === s));
    bySource['pooled (non-decoy)'] = yesOf(answered.filter((k) => k.source !== 'decoy'));
    return {
      rater: r, answered: answered.length, unanswered, invalid,
      decoyFalseAccept: yesOf(answered.filter((k) => k.source === 'decoy')),
      yesBySource: bySource,
      toolYes: yesOf(answered.filter((k) => k.source === 'tool-only' || k.source === 'both')),
      manifestYes: yesOf(answered.filter((k) => k.source === 'manifest-only' || k.source === 'both')),
      uncertain: answered.filter((k) => l.get(k.itemId) === 'uncertain').length,
    };
  });
  return { raters, primary: raters[0] ?? '', pairs, fleissKappaBinary: fleiss, fleissItems: full.length, summaries };
}

const f3 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(3));
const pc = (p: ProportionCi): string => (p.share === null ? '0/0' : `${f3(p.share)} (${String(p.k)}/${String(p.n)}) [${f3(p.low)}, ${f3(p.high)}]`);

export function renderUnionAgreement(r: UnionAgreementReport): string {
  const out = ['# v1.3 blind union labelling: agreement', '', `Primary human reference: **${r.primary}** (protocol §4). Gate: Cohen's κ ≥ ${String(BINARY_KAPPA_GATE)} on the binary split (point estimate; interval reported beside it, protocol §3).`, ''];
  out.push('| Pair | n | Observed (binary) [95% Wilson] | κ binary | AC1 binary | κ three-way | AC1 three-way | Gate |', '|---|---|---|---|---|---|---|---|');
  for (const p of r.pairs) {
    out.push(`| ${p.a} – ${p.b} | ${String(p.binary.n)} | ${f3(p.binary.observed)} [${f3(p.binary.observedLow)}, ${f3(p.binary.observedHigh)}] | ${f3(p.binary.kappa)} | ${f3(p.binary.ac1)} | ${f3(p.threeWay.kappa)} | ${f3(p.threeWay.ac1)} | ${p.gate.pass ? 'pass' : 'below'} |`);
  }
  out.push('', `Fleiss' κ (binary, all ${String(r.raters.length)} raters, ${String(r.fleissItems)} items answered by all): ${f3(r.fleissKappaBinary)}`, '');
  for (const p of r.pairs) {
    out.push(`### ${p.a} (rows) × ${p.b} (columns), three-way`, '', `| | ${p.threeWay.categories.join(' | ')} |`, `|---|${p.threeWay.categories.map(() => '---').join('|')}|`);
    p.threeWay.table.forEach((row, i) => out.push(`| ${p.threeWay.categories[i] ?? ''} | ${row.join(' | ')} |`));
    out.push('');
  }
  out.push('## Per rater', '', '| Rater | Answered | Uncertain | Decoy false-accept | Tool findings `yes` (meaningful precision) | Manifest items confirmed | manifest-only | tool-only | both |', '|---|---|---|---|---|---|---|---|---|');
  for (const s of r.summaries) {
    const b = s.yesBySource;
    const g = (k: string): string => (b[k] === undefined ? 'n/a' : pc(b[k]));
    out.push(`| ${s.rater} | ${String(s.answered)} | ${String(s.uncertain)} | ${pc(s.decoyFalseAccept)} | ${pc(s.toolYes)} | ${pc(s.manifestYes)} | ${g('manifest-only')} | ${g('tool-only')} | ${g('both')} |`);
  }
  for (const s of r.summaries) {
    if (s.unanswered.length > 0) out.push(`- ${s.rater}: unanswered ${s.unanswered.join(', ')}`);
    if (s.invalid.length > 0) out.push(`- ${s.rater}: not yes/no/uncertain ${s.invalid.join(', ')}`);
  }
  return out.join('\n') + '\n';
}
