/**
 * Scoring of the one-time hold-out run (Docs/v1.3/holdout-prespec.md §3–§5). Pure; no I/O.
 *
 * Inputs: the hold-out references (loaded and id-mapped), the tool's rows per variant (the `raw/` files of
 * `validate-reference.ts`), optionally the tool's graph per variant (`ue-graph.ts`), the correctness checker's results
 * (`check-correct.ts`) and a graph adjudication file.
 *
 * - **Matching** is `compare.ts` (`compareVariant`), the matcher frozen in prespec §1. It is the primary view, and the
 *   only one the pass checks use. Two declared normalisations are reported next to it and never decide a claim:
 *   `strictKey` (rule + file + target, the cycle file-set reading of compare.ts switched off) and the *distinct*
 *   precision (a false alarm that the clean variant also has is counted once, on the clean variant).
 * - **Blocking** is the v1.3 tier `blocking` under the style (the loader sets `blockingCandidate`), minus the rules
 *   whose tier is still deferred at the freeze (`deferredRules`, e.g. FF-DS01 under Q15): their counts are reported
 *   on their own and kept out of M1 and M2.
 * - **Claim levels** per metric and style: `validated` (point estimate and 95% Wilson lower bound both meet the
 *   target), `validated at point estimate` (only the point estimate does), `characterised` (the point estimate
 *   misses), and `no data` (n = 0). Graph agreement with undecided disagreements is `pending adjudication`.
 */
import { compareVariant, cycleFileSet, CYCLE_RULE_IDS } from './compare.js';
import type { ActualFinding, VariantComparison } from './compare.js';
import type { ExpectedFinding, LoadedReference, VariantKind } from './reference-model.js';
import { wilson } from '../../lib/stats.js';

// ── Targets ───────────────────────────────────────────────────────────────────

export const RECALL_TARGET = 0.9;
export const PRECISION_TARGET = 0.9;
export const GRAPH_TARGET = 0.95;

export type ClaimLevel = 'validated' | 'validated at point estimate' | 'characterised' | 'no data' | 'pending adjudication';

const CLAIM_ORDER: readonly ClaimLevel[] = ['no data', 'pending adjudication', 'characterised', 'validated at point estimate', 'validated'];

export interface Proportion {
  readonly k: number;
  readonly n: number;
  readonly point: number | null;
  readonly low: number | null;
  readonly high: number | null;
}

export function proportion(k: number, n: number): Proportion {
  if (n === 0) return { k, n, point: null, low: null, high: null };
  const ci = wilson(k, n);
  return { k, n, point: k / n, low: ci.low, high: ci.high };
}

export interface TargetCheck {
  readonly metric: string;
  readonly target: number;
  readonly value: Proportion;
  readonly pointPass: boolean | null;
  readonly lowerBoundPass: boolean | null;
  readonly claim: ClaimLevel;
  /** The smallest n at which a perfect result's Wilson lower bound reaches the target. */
  readonly minPerfectN: number;
  /** False when even a perfect result at this n could not pass the lower-bound check. */
  readonly lowerBoundReachable: boolean | null;
}

/** The smallest n with wilson(n, n).low >= target. */
export function minPerfectN(target: number): number {
  for (let n = 1; n < 100_000; n += 1) if (wilson(n, n).low >= target) return n;
  return Infinity;
}

const MIN_N_CACHE = new Map<number, number>();
function minN(target: number): number {
  let v = MIN_N_CACHE.get(target);
  if (v === undefined) {
    v = minPerfectN(target);
    MIN_N_CACHE.set(target, v);
  }
  return v;
}

export function checkTarget(metric: string, value: Proportion, target: number): TargetCheck {
  const reach = value.n === 0 ? null : wilson(value.n, value.n).low >= target;
  if (value.point === null || value.low === null) {
    return { metric, target, value, pointPass: null, lowerBoundPass: null, claim: 'no data', minPerfectN: minN(target), lowerBoundReachable: reach };
  }
  const pointPass = value.point >= target;
  const lowerBoundPass = value.low >= target;
  const claim: ClaimLevel = pointPass && lowerBoundPass ? 'validated' : pointPass ? 'validated at point estimate' : 'characterised';
  return { metric, target, value, pointPass, lowerBoundPass, claim, minPerfectN: minN(target), lowerBoundReachable: reach };
}

/** The weakest of several claim levels (`no data` and `pending adjudication` are weaker than `characterised`). */
export function weakestClaim(levels: readonly ClaimLevel[]): ClaimLevel {
  if (levels.length === 0) return 'no data';
  return levels.reduce((a, b) => (CLAIM_ORDER.indexOf(a) <= CLAIM_ORDER.indexOf(b) ? a : b));
}

// ── Finding counts ────────────────────────────────────────────────────────────

export interface Counts {
  tp: number;
  fn: number;
  fp: number;
  fpDistinct: number;
}

const zero = (): Counts => ({ tp: 0, fn: 0, fp: 0, fpDistinct: 0 });
const addInto = (a: Counts, b: Counts): void => {
  a.tp += b.tp;
  a.fn += b.fn;
  a.fp += b.fp;
  a.fpDistinct += b.fpDistinct;
};

export interface RatedCounts extends Counts {
  readonly recall: Proportion;
  readonly precision: Proportion;
  readonly precisionDistinct: Proportion;
}

export function rate(c: Counts): RatedCounts {
  return { ...c, recall: proportion(c.tp, c.tp + c.fn), precision: proportion(c.tp, c.tp + c.fp), precisionDistinct: proportion(c.tp, c.tp + c.fpDistinct) };
}

/** One-to-one matching on the strict key (rule + file + target when both carry one), exact pairs first. */
export function strictMatch(expected: readonly ExpectedFinding[], actual: readonly ActualFinding[]): { tp: number; fnRules: string[]; fpIdx: number[] } {
  const used = new Array<boolean>(actual.length).fill(false);
  const m = new Array<number>(expected.length).fill(-1);
  for (const exactOnly of [true, false]) {
    expected.forEach((e, ei) => {
      if (m[ei] !== -1) return;
      const ai = actual.findIndex((a, i) => {
        if (used[i] || a.ruleId !== e.ruleId || a.file !== e.file) return false;
        const et = e.target ?? '';
        const at = a.target ?? '';
        if (et !== '' && at !== '') return et === at;
        return !exactOnly;
      });
      if (ai >= 0) {
        used[ai] = true;
        m[ei] = ai;
      }
    });
  }
  return {
    tp: m.filter((x) => x >= 0).length,
    fnRules: expected.filter((_, i) => (m[i] ?? -1) < 0).map((e) => e.ruleId),
    fpIdx: actual.flatMap((_, i) => (used[i] ? [] : [i])),
  };
}

const rowKey = (f: { ruleId: string; file: string; target?: string | undefined }): string =>
  CYCLE_RULE_IDS.has(f.ruleId) ? `${f.ruleId}|{${cycleFileSet(f)}}` : `${f.ruleId}|${f.file}|${f.target ?? ''}`;

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface CorrectnessRow {
  /** `<style>/<variant>` (reference jobs). */
  readonly projectId: string;
  readonly ruleId: string;
  readonly tier: string;
  readonly file: string;
  readonly verdict: 'correct' | 'incorrect' | 'not-checkable';
  readonly reason: string;
}

/** A tool graph per variant (`ue-graph.ts` output, one style). */
export interface ToolGraph {
  readonly files: readonly { readonly file: string; readonly layer: string | null }[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
}

/**
 * Adjudication of graph disagreements (validation protocol §2), per style. For an edge `"a -> b"` or a file, the
 * value names the side that is right: `tool` or `reference`.
 */
export interface GraphAdjudication {
  readonly styles: Readonly<Record<string, {
    readonly edges?: Readonly<Record<string, 'tool' | 'reference'>>;
    readonly layers?: Readonly<Record<string, 'tool' | 'reference'>>;
  }>>;
}

export interface ScoreInputs {
  readonly refs: readonly LoadedReference[];
  readonly actualOf: (style: string, variant: string) => readonly ActualFinding[];
  /** Absent: M7 is not scored. */
  readonly toolGraphOf?: (style: string, variant: string) => ToolGraph | undefined;
  /** Absent: M3 is not scored. */
  readonly correctness?: readonly CorrectnessRow[];
  readonly deferredRules?: readonly string[];
  readonly graphAdjudication?: GraphAdjudication;
}

// ── Outputs ───────────────────────────────────────────────────────────────────

export interface FindingRow {
  readonly variant: string;
  readonly kind: VariantKind;
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
  readonly reason?: string;
  readonly alsoOnClean?: boolean;
}

export interface RuleScore {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly tier: 'blocking' | 'advisory' | 'deferred';
  readonly counts: RatedCounts;
}

export interface GraphScore {
  readonly kind: 'every edge' | 'key edges only';
  readonly literal: { readonly edgeRecall: Proportion; readonly edgePrecision: Proportion | null; readonly layerAccuracy: Proportion };
  readonly adjudicated: { readonly edgeRecall: Proportion | null; readonly edgePrecision: Proportion | null; readonly layerAccuracy: Proportion | null; readonly pending: number };
  readonly onlyTool: readonly string[];
  readonly onlyReference: readonly string[];
  readonly layerMismatches: readonly string[];
}

export interface StyleScore {
  readonly style: string;
  readonly variants: { readonly total: number; readonly violation: number; readonly nearMiss: number; readonly clean: number };
  /** M1 and M2 (compare.ts matching), blocking rules minus deferred. */
  readonly blocking: RatedCounts;
  /** Normalisation views (reported only). */
  readonly blockingStrictKey: RatedCounts;
  readonly deferred: RatedCounts;
  /** M3: reported blocking findings the checker labels `correct` / its checkable findings. */
  readonly correct: { readonly value: Proportion; readonly notCheckable: readonly { variant: string; ruleId: string; file: string; reason: string }[]; readonly incorrect: readonly { variant: string; ruleId: string; file: string; reason: string }[] } | null;
  /** M4, per rule (advisory rules never enter a pass or fail). */
  readonly rules: readonly RuleScore[];
  readonly advisory: RatedCounts;
  /** M5: the clean variant. */
  readonly negativeControl: { readonly cleanVariants: number; readonly withFalseAlarm: number; readonly falseAlarms: readonly FindingRow[] };
  /** M6. */
  readonly nearMiss: { readonly value: Proportion; readonly falseAlarms: readonly FindingRow[] };
  readonly misses: readonly FindingRow[];
  readonly falseAlarms: readonly FindingRow[];
  readonly plantedDetected: Proportion;
  readonly graph: GraphScore | null;
  readonly checks: readonly TargetCheck[];
  readonly claim: ClaimLevel;
  readonly comparisons: readonly VariantComparison[];
}

export interface HoldoutScores {
  readonly styles: readonly StyleScore[];
  readonly pooled: {
    readonly blocking: RatedCounts;
    readonly blockingStrictKey: RatedCounts;
    readonly deferred: RatedCounts;
    readonly correct: Proportion | null;
    readonly advisory: RatedCounts;
    readonly negativeControl: { readonly cleanVariants: number; readonly withFalseAlarm: number; readonly falseAlarms: number };
    readonly nearMiss: Proportion;
    readonly graph: { readonly edgeRecall: Proportion; readonly edgePrecision: Proportion | null; readonly layerAccuracy: Proportion } | null;
    readonly checks: readonly TargetCheck[];
  };
  readonly deferredRules: readonly string[];
  readonly lowerBoundNote: string;
}

// ── Graph ─────────────────────────────────────────────────────────────────────

const ek = (f: string, t: string): string => `${f} -> ${t}`;

export function scoreGraph(ref: LoadedReference, tool: ToolGraph, adj: GraphAdjudication['styles'][string] | undefined): GraphScore {
  const toolE = new Set(tool.edges.map((e) => ek(e.from, e.to)));
  const refE = new Set(ref.graph.edges.map((e) => ek(e.from, e.to)));
  const every = ref.format === 'patch';
  const both = [...refE].filter((e) => toolE.has(e));
  const onlyRef = [...refE].filter((e) => !toolE.has(e));
  // The overlay format lists key edges only, so a tool edge outside them is not a disagreement.
  const onlyTool = every ? [...toolE].filter((e) => !refE.has(e)) : [];
  const toolLayer = new Map(tool.files.map((f) => [f.file, f.layer]));
  const layerMismatches: string[] = [];
  let layerAgree = 0;
  for (const f of ref.graph.files) {
    if (toolLayer.has(f.path) && (toolLayer.get(f.path) ?? null) === f.layer) layerAgree += 1;
    else layerMismatches.push(`${f.path}: reference ${String(f.layer)}, tool ${toolLayer.has(f.path) ? String(toolLayer.get(f.path)) : 'absent'}`);
  }
  const literal = {
    edgeRecall: proportion(both.length, refE.size),
    edgePrecision: every ? proportion(both.length, toolE.size) : null,
    layerAccuracy: proportion(layerAgree, ref.graph.files.length),
  };
  // Adjudication: a tool-only edge judged `tool` joins the reference (a true positive); a reference-only edge judged
  // `tool` (the edge is not in the code) leaves it. Undecided disagreements leave the adjudicated figure pending.
  const ed = adj?.edges ?? {};
  const ld = adj?.layers ?? {};
  let pending = 0;
  let tp = both.length;
  let fn = 0;
  let fp = 0;
  for (const e of onlyTool) {
    const v = ed[e];
    if (v === undefined) pending += 1;
    else if (v === 'tool') tp += 1;
    else fp += 1;
  }
  for (const e of onlyRef) {
    const v = ed[e];
    if (v === undefined) pending += 1;
    else if (v === 'reference') fn += 1;
  }
  let lAgree = layerAgree;
  let lTotal = layerAgree;
  for (const m of layerMismatches) {
    const file = m.slice(0, m.indexOf(':'));
    const v = ld[file];
    if (v === undefined) pending += 1;
    else {
      lTotal += 1;
      if (v === 'tool') lAgree += 1;
    }
  }
  const done = pending === 0;
  return {
    kind: every ? 'every edge' : 'key edges only',
    literal,
    adjudicated: {
      edgeRecall: done ? proportion(tp, tp + fn) : null,
      edgePrecision: done && every ? proportion(tp, tp + fp) : null,
      layerAccuracy: done ? proportion(lAgree, lTotal) : null,
      pending,
    },
    onlyTool, onlyReference: onlyRef, layerMismatches,
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function tierOf(ref: LoadedReference, ruleId: string, deferred: ReadonlySet<string>): 'blocking' | 'advisory' | 'deferred' {
  if (deferred.has(ruleId)) return 'deferred';
  return ref.descriptor.scopeRules.find((r) => r.ruleId === ruleId)?.blockingCandidate === true ? 'blocking' : 'advisory';
}

export function scoreHoldout(inputs: ScoreInputs): HoldoutScores {
  const deferred = new Set(inputs.deferredRules ?? []);
  const styles: StyleScore[] = [];
  for (const ref of inputs.refs) styles.push(scoreStyle(ref, inputs, deferred));

  const pool = (sel: (s: StyleScore) => Counts): RatedCounts => {
    const c = zero();
    for (const s of styles) addInto(c, sel(s));
    return rate(c);
  };
  const withCorrect = styles.filter((s) => s.correct !== null);
  const correct = withCorrect.length === 0 ? null
    : proportion(withCorrect.reduce((a, s) => a + (s.correct?.value.k ?? 0), 0), withCorrect.reduce((a, s) => a + (s.correct?.value.n ?? 0), 0));
  const blocking = pool((s) => s.blocking);
  const graphs = styles.map((s) => s.graph).filter((g): g is GraphScore => g !== null);
  const sum = (xs: readonly (Proportion | null)[]): Proportion | null => {
    const ys = xs.filter((x): x is Proportion => x !== null);
    return ys.length === 0 ? null : proportion(ys.reduce((a, x) => a + x.k, 0), ys.reduce((a, x) => a + x.n, 0));
  };
  const nm = styles.reduce((a, s) => ({ k: a.k + s.nearMiss.value.k, n: a.n + s.nearMiss.value.n }), { k: 0, n: 0 });
  const pooledChecks = [
    checkTarget('M2 blocking precision (manifest)', blocking.precision, PRECISION_TARGET),
    ...(correct !== null ? [checkTarget('M3 blocking precision (correct)', correct, PRECISION_TARGET)] : []),
  ];
  return {
    styles,
    pooled: {
      blocking,
      blockingStrictKey: pool((s) => s.blockingStrictKey),
      deferred: pool((s) => s.deferred),
      correct,
      advisory: pool((s) => s.advisory),
      negativeControl: {
        cleanVariants: styles.reduce((a, s) => a + s.negativeControl.cleanVariants, 0),
        withFalseAlarm: styles.reduce((a, s) => a + s.negativeControl.withFalseAlarm, 0),
        falseAlarms: styles.reduce((a, s) => a + s.negativeControl.falseAlarms.length, 0),
      },
      nearMiss: proportion(nm.k, nm.n),
      graph: graphs.length === 0 ? null : {
        edgeRecall: sum(graphs.map((g) => g.literal.edgeRecall)) ?? proportion(0, 0),
        edgePrecision: sum(graphs.map((g) => g.literal.edgePrecision)),
        layerAccuracy: sum(graphs.map((g) => g.literal.layerAccuracy)) ?? proportion(0, 0),
      },
      checks: pooledChecks,
    },
    deferredRules: [...deferred].sort(),
    lowerBoundNote: `A perfect result's 95% Wilson lower bound reaches ${String(RECALL_TARGET)} only at n >= ${String(minN(RECALL_TARGET))} and ${String(GRAPH_TARGET)} only at n >= ${String(minN(GRAPH_TARGET))}; below that, the lower-bound check cannot pass even with no error (prespec §5).`,
  };
}

function scoreStyle(ref: LoadedReference, inputs: ScoreInputs, deferred: ReadonlySet<string>): StyleScore {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
  const cleanActual = clean === undefined ? undefined : inputs.actualOf(ref.style, clean.manifest.variant);
  const per = new Map<string, Counts>(ref.descriptor.scopeRules.map((r) => [r.ruleId, zero()]));
  const strict = zero();
  const comparisons: VariantComparison[] = [];
  const misses: FindingRow[] = [];
  const falseAlarms: FindingRow[] = [];
  const cleanAlarms: FindingRow[] = [];
  const nearMissAlarms: FindingRow[] = [];
  let nearMissWith = 0;
  let nearMisses = 0;
  let planted = 0;
  let violations = 0;
  const isBlocking = (id: string): boolean => tierOf(ref, id, deferred) === 'blocking';
  const cleanKeys = new Set((cleanActual ?? []).filter((a) => scope.has(a.ruleId)).map(rowKey));

  for (const v of ref.variants) {
    const actual = v === clean && cleanActual !== undefined ? cleanActual : inputs.actualOf(ref.style, v.manifest.variant);
    const c = compareVariant(ref.style, v.manifest, actual, scope, cleanActual);
    comparisons.push(c);
    for (const m of c.matched) {
      const r = per.get(m.ruleId);
      if (r !== undefined) r.tp += 1;
    }
    let nmHit = false;
    for (const x of c.mismatches) {
      const r = per.get(x.ruleId);
      if (r === undefined) continue;
      const row: FindingRow = {
        variant: v.manifest.variant, kind: v.manifest.kind, ruleId: x.ruleId, file: x.file,
        ...(x.target !== undefined ? { target: x.target } : {}), ...(x.reason !== undefined ? { reason: x.reason } : {}),
        ...(x.alsoOnClean !== undefined ? { alsoOnClean: x.alsoOnClean } : {}),
      };
      if (x.kind === 'missed') {
        r.fn += 1;
        if (isBlocking(x.ruleId)) misses.push(row);
      } else {
        r.fp += 1;
        if (x.alsoOnClean !== true) r.fpDistinct += 1;
        if (isBlocking(x.ruleId)) {
          falseAlarms.push(row);
          if (v.manifest.kind === 'clean') cleanAlarms.push(row);
          if (v.manifest.kind === 'near-miss') {
            nearMissAlarms.push(row);
            nmHit = true;
          }
        }
      }
    }
    if (v.manifest.kind === 'near-miss') {
      nearMisses += 1;
      if (nmHit) nearMissWith += 1;
    }
    if (v.manifest.kind === 'violation') {
      violations += 1;
      if (c.plantedDetected === true) planted += 1;
    }
    // Strict-key view, blocking rules only.
    const exp = v.manifest.expectedFindings.filter((e) => scope.has(e.ruleId) && isBlocking(e.ruleId));
    const act = actual.filter((a) => scope.has(a.ruleId) && isBlocking(a.ruleId));
    const sm = strictMatch(exp, act);
    strict.tp += sm.tp;
    strict.fn += sm.fnRules.length;
    strict.fp += sm.fpIdx.length;
    strict.fpDistinct += sm.fpIdx.filter((i) => v.manifest.kind === 'clean' || !cleanKeys.has(rowKey(act[i] as ActualFinding))).length;
  }

  const rules: RuleScore[] = ref.descriptor.scopeRules.map((r) => ({ ruleId: r.ruleId, ruleName: r.ruleName, tier: tierOf(ref, r.ruleId, deferred), counts: rate(per.get(r.ruleId) ?? zero()) }));
  const poolTier = (t: RuleScore['tier']): RatedCounts => {
    const c = zero();
    for (const r of rules) if (r.tier === t) addInto(c, r.counts);
    return rate(c);
  };
  const blocking = poolTier('blocking');

  // M3: correctness of the reported blocking findings (non-deferred).
  let correct: StyleScore['correct'] = null;
  if (inputs.correctness !== undefined) {
    const rows = inputs.correctness.filter((r) => r.projectId.split('/')[0] === ref.style && isBlocking(r.ruleId));
    const strip = (r: CorrectnessRow): { variant: string; ruleId: string; file: string; reason: string } => ({ variant: r.projectId.split('/').slice(1).join('/'), ruleId: r.ruleId, file: r.file, reason: r.reason });
    const ok = rows.filter((r) => r.verdict === 'correct').length;
    const bad = rows.filter((r) => r.verdict === 'incorrect');
    correct = { value: proportion(ok, ok + bad.length), incorrect: bad.map(strip), notCheckable: rows.filter((r) => r.verdict === 'not-checkable').map(strip) };
  }

  // M7.
  let graph: GraphScore | null = null;
  if (inputs.toolGraphOf !== undefined && clean !== undefined) {
    const tg = inputs.toolGraphOf(ref.style, clean.manifest.variant);
    if (tg !== undefined) graph = scoreGraph(ref, tg, inputs.graphAdjudication?.styles[ref.style]);
  }

  const checks: TargetCheck[] = [
    checkTarget('M1 blocking recall', blocking.recall, RECALL_TARGET),
    checkTarget('M2 blocking precision (manifest)', blocking.precision, PRECISION_TARGET),
  ];
  if (correct !== null) checks.push(checkTarget('M3 blocking precision (correct)', correct.value, PRECISION_TARGET));
  if (graph !== null) {
    const graphCheck = (metric: string, adjudicated: Proportion | null, literal: Proportion | null): void => {
      if (literal === null) return;
      if (adjudicated === null) {
        const c = checkTarget(metric, literal, GRAPH_TARGET);
        checks.push({ ...c, claim: 'pending adjudication' });
      } else checks.push(checkTarget(metric, adjudicated, GRAPH_TARGET));
    };
    graphCheck('M7 import-edge recall (adjudicated)', graph.adjudicated.edgeRecall, graph.literal.edgeRecall);
    graphCheck('M7 import-edge precision (adjudicated)', graph.adjudicated.edgePrecision, graph.literal.edgePrecision);
    graphCheck('M7 file-to-layer accuracy (adjudicated)', graph.adjudicated.layerAccuracy, graph.literal.layerAccuracy);
  }

  return {
    style: ref.style,
    variants: {
      total: ref.variants.length,
      violation: ref.variants.filter((v) => v.manifest.kind === 'violation').length,
      nearMiss: nearMisses,
      clean: ref.variants.filter((v) => v.manifest.kind === 'clean').length,
    },
    blocking,
    blockingStrictKey: rate(strict),
    deferred: poolTier('deferred'),
    correct,
    rules,
    advisory: poolTier('advisory'),
    negativeControl: { cleanVariants: clean === undefined ? 0 : 1, withFalseAlarm: cleanAlarms.length > 0 ? 1 : 0, falseAlarms: cleanAlarms },
    nearMiss: { value: proportion(nearMissWith, nearMisses), falseAlarms: nearMissAlarms },
    misses, falseAlarms,
    plantedDetected: proportion(planted, violations),
    graph,
    checks,
    claim: weakestClaim(checks.map((c) => c.claim)),
    comparisons,
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const f2 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(3));
export const fmt = (p: Proportion | null): string =>
  p === null ? 'n/a' : p.point === null ? `0/0` : `${f2(p.point)} (${String(p.k)}/${String(p.n)}) [${f2(p.low)}, ${f2(p.high)}]`;
const yn = (b: boolean | null): string => (b === null ? 'n/a' : b ? 'pass' : 'FAIL');
const cell = (s: string): string => s.replace(/\|/g, '\\|');

export function claimLines(scores: HoldoutScores): string[] {
  return scores.styles.map((s) => `${s.style}: ${s.claim} (${s.checks.map((c) => `${c.metric.split(' ')[0] ?? ''} ${c.claim}`).join('; ')})`);
}

export function renderHoldoutMarkdown(scores: HoldoutScores, header: string): string {
  const out: string[] = [header, ''];
  out.push('## Claim levels (prespec §5)', '', '| Style | Metric | Value x/n [95% Wilson] | Target | Point estimate | Lower bound | n for a perfect pass | Claim |', '|---|---|---|---|---|---|---|---|');
  for (const s of scores.styles) {
    for (const c of s.checks) out.push(`| ${s.style} | ${c.metric} | ${fmt(c.value)} | ${String(c.target)} | ${yn(c.pointPass)} | ${yn(c.lowerBoundPass)}${c.lowerBoundReachable === false ? ' (unreachable at this n)' : ''} | ${String(c.minPerfectN)} | ${c.claim} |`);
    out.push(`| **${s.style}** | **overall (weakest)** | | | | | | **${s.claim}** |`);
  }
  for (const c of scores.pooled.checks) out.push(`| pooled | ${c.metric} | ${fmt(c.value)} | ${String(c.target)} | ${yn(c.pointPass)} | ${yn(c.lowerBoundPass)} | ${String(c.minPerfectN)} | ${c.claim} |`);
  out.push('', scores.lowerBoundNote, '');
  if (scores.deferredRules.length > 0) out.push(`Deferred rules, kept out of M1 and M2 and reported apart: ${scores.deferredRules.join(', ')}.`, '');

  out.push('## M1, M2 (compare.ts matching, primary) and the normalisation views', '', '| Style | Variants (v/n/c) | M1 blocking recall | M2 blocking precision | Precision distinct (normalisation) | Strict-key recall | Strict-key precision | Planted detected | Deferred TP/FN/FP |', '|---|---|---|---|---|---|---|---|---|');
  for (const s of scores.styles) {
    out.push(`| ${s.style} | ${String(s.variants.violation)}/${String(s.variants.nearMiss)}/${String(s.variants.clean)} | ${fmt(s.blocking.recall)} | ${fmt(s.blocking.precision)} | ${fmt(s.blocking.precisionDistinct)} | ${fmt(s.blockingStrictKey.recall)} | ${fmt(s.blockingStrictKey.precision)} | ${fmt(s.plantedDetected)} | ${String(s.deferred.tp)}/${String(s.deferred.fn)}/${String(s.deferred.fp)} |`);
  }
  const p = scores.pooled;
  out.push(`| **pooled** | | ${fmt(p.blocking.recall)} | ${fmt(p.blocking.precision)} | ${fmt(p.blocking.precisionDistinct)} | ${fmt(p.blockingStrictKey.recall)} | ${fmt(p.blockingStrictKey.precision)} | | ${String(p.deferred.tp)}/${String(p.deferred.fn)}/${String(p.deferred.fp)} |`, '');

  out.push('## M3 blocking precision (correct, check-correct.ts)', '');
  if (p.correct === null) out.push('Not scored (no correctness results).', '');
  else {
    out.push('| Style | Correct / checkable | Not checkable |', '|---|---|---|');
    for (const s of scores.styles) if (s.correct !== null) out.push(`| ${s.style} | ${fmt(s.correct.value)} | ${String(s.correct.notCheckable.length)} |`);
    out.push(`| **pooled** | ${fmt(p.correct)} | |`, '');
    for (const s of scores.styles) {
      for (const r of s.correct?.incorrect ?? []) out.push(`- ${s.style}/${r.variant}: ${r.ruleId} ${r.file}: **incorrect**: ${r.reason}`);
      for (const r of s.correct?.notCheckable ?? []) out.push(`- ${s.style}/${r.variant}: ${r.ruleId} ${r.file}: not checkable: ${r.reason}`);
    }
    out.push('');
  }

  out.push('## M4 advisory rules (reported separately; never a pass or fail) and per-rule figures (descriptive)', '', '| Style | Rule | Tier | TP | FN | FP | Recall | Precision |', '|---|---|---|---|---|---|---|---|');
  for (const s of scores.styles) {
    for (const r of s.rules) {
      const c = r.counts;
      if (c.tp + c.fn + c.fp === 0) continue;
      out.push(`| ${s.style} | ${r.ruleId} ${r.ruleName} | ${r.tier} | ${String(c.tp)} | ${String(c.fn)} | ${String(c.fp)} | ${fmt(c.recall)} | ${fmt(c.precision)} |`);
    }
  }
  out.push('');

  out.push('## M5 negative control (clean variants) and M6 near-miss false alarms', '', '| Style | Clean variants with a blocking false alarm | Blocking false alarms on clean | Near-misses with a blocking false alarm |', '|---|---|---|---|');
  for (const s of scores.styles) out.push(`| ${s.style} | ${String(s.negativeControl.withFalseAlarm)}/${String(s.negativeControl.cleanVariants)} | ${String(s.negativeControl.falseAlarms.length)} | ${fmt(s.nearMiss.value)} |`);
  out.push(`| **pooled** | ${String(p.negativeControl.withFalseAlarm)}/${String(p.negativeControl.cleanVariants)} | ${String(p.negativeControl.falseAlarms)} | ${fmt(p.nearMiss)} |`, '');

  out.push('## M7 graph agreement (expected graph of the clean variant)', '');
  if (p.graph === null) out.push('Not scored (no tool graphs).', '');
  else {
    out.push('| Style | Edges | Edge recall (literal) | Edge precision (literal) | Layer accuracy (literal) | Adjudicated recall | Adjudicated precision | Adjudicated layer accuracy | Pending |', '|---|---|---|---|---|---|---|---|---|');
    for (const s of scores.styles) {
      const g = s.graph;
      if (g === null) continue;
      out.push(`| ${s.style} | ${g.kind} | ${fmt(g.literal.edgeRecall)} | ${fmt(g.literal.edgePrecision)} | ${fmt(g.literal.layerAccuracy)} | ${fmt(g.adjudicated.edgeRecall)} | ${fmt(g.adjudicated.edgePrecision)} | ${fmt(g.adjudicated.layerAccuracy)} | ${String(g.adjudicated.pending)} |`);
    }
    out.push(`| **pooled (literal)** | | ${fmt(p.graph.edgeRecall)} | ${fmt(p.graph.edgePrecision)} | ${fmt(p.graph.layerAccuracy)} | | | | |`, '');
    for (const s of scores.styles) {
      const g = s.graph;
      if (g === null) continue;
      for (const e of g.onlyTool) out.push(`- ${s.style}: tool only: ${e}`);
      for (const e of g.onlyReference) out.push(`- ${s.style}: reference only: ${e}`);
      for (const e of g.layerMismatches) out.push(`- ${s.style}: layer: ${e}`);
    }
    out.push('');
  }

  out.push('## Every blocking miss and false alarm', '', '| Style | Variant | Kind | Mismatch | Rule | File | Target | Note |', '|---|---|---|---|---|---|---|---|');
  for (const s of scores.styles) {
    for (const r of s.misses) out.push(`| ${s.style} | ${r.variant} | ${r.kind} | missed | ${r.ruleId} | ${r.file} | ${r.target ?? ''} | ${cell(r.reason ?? '')} |`);
    for (const r of s.falseAlarms) out.push(`| ${s.style} | ${r.variant} | ${r.kind} | false alarm | ${r.ruleId} | ${r.file} | ${r.target ?? ''} | ${r.alsoOnClean === true ? 'also on the clean variant' : ''} |`);
  }
  return out.join('\n') + '\n';
}

/** The scores without the per-variant comparisons (for the JSON file, which keeps them under their own key). */
export function scoresJson(scores: HoldoutScores): unknown {
  return {
    ...scores,
    styles: scores.styles.map(({ comparisons, ...rest }) => ({ ...rest, comparisons: comparisons.filter((c) => c.mismatches.length > 0) })),
  };
}

