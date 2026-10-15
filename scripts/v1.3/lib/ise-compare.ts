/**
 * ISE prototype measurement: the comparisons behind (a)-(d) of the ISE diagnostic run. Pure; no I/O.
 * This is evaluation code: it reads the ground truth (expected layers, the true spec, expected findings), which the
 * inferrer (src/ise) never sees.
 */
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { compareVariant, cycleFileSet } from './compare.js';
import type { ActualFinding } from './compare.js';
import type { ExpectedFinding, VariantKind } from './reference-model.js';

// ── (b) per-file layer accuracy ──────────────────────────────────────────────

export interface LayerAccuracy {
  readonly correct: number;
  readonly total: number;
  readonly accuracy: number;
  readonly wrong: readonly { file: string; inferred: string | null; expected: string | null; confidence: number }[];
  /** Accuracy within confidence buckets (>= 0.85, 0.55-0.85, < 0.55). */
  readonly byConfidence: Readonly<Record<'high' | 'medium' | 'low', { correct: number; total: number }>>;
}

export function layerAccuracy(
  inferred: readonly { file: string; layer: string | null; confidence: number }[],
  expected: readonly { path: string; layer: string | null }[],
): LayerAccuracy {
  const exp = new Map(expected.map((e) => [e.path, e.layer]));
  const byConfidence = { high: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, low: { correct: 0, total: 0 } };
  const wrong: LayerAccuracy['wrong'][number][] = [];
  let correct = 0;
  let total = 0;
  for (const f of inferred) {
    if (!exp.has(f.file)) continue;
    const e = exp.get(f.file) ?? null;
    const ok = e === f.layer;
    total += 1;
    const bucket = f.confidence >= 0.85 ? byConfidence.high : f.confidence >= 0.55 ? byConfidence.medium : byConfidence.low;
    bucket.total += 1;
    if (ok) {
      correct += 1;
      bucket.correct += 1;
    } else wrong.push({ file: f.file, inferred: f.layer, expected: e, confidence: f.confidence });
  }
  for (const e of expected) {
    if (!inferred.some((f) => f.file === e.path)) {
      total += 1;
      wrong.push({ file: e.path, inferred: null, expected: e.layer, confidence: 0 });
    }
  }
  return { correct, total, accuracy: total === 0 ? 1 : correct / total, wrong, byConfidence };
}

// ── (c) spec equivalence ─────────────────────────────────────────────────────

export interface GlobDiff {
  readonly layer: string;
  readonly onlyInferred: readonly string[];
  readonly onlyTrue: readonly string[];
}

export function globDiff(
  inferred: readonly { name: string; directories: readonly string[]; filePatterns?: readonly string[] }[],
  truth: readonly { name: string; directories: readonly string[]; filePatterns?: readonly string[] }[],
): GlobDiff[] {
  const names = [...new Set([...truth.map((l) => l.name), ...inferred.map((l) => l.name)])];
  return names.map((layer) => {
    const a = inferred.find((l) => l.name === layer);
    const b = truth.find((l) => l.name === layer);
    const ga = new Set([...(a?.directories ?? []), ...(a?.filePatterns ?? []).map((p) => `pattern:${p}`)]);
    const gb = new Set([...(b?.directories ?? []), ...(b?.filePatterns ?? []).map((p) => `pattern:${p}`)]);
    return { layer, onlyInferred: [...ga].filter((g) => !gb.has(g)).sort(), onlyTrue: [...gb].filter((g) => !ga.has(g)).sort() };
  });
}

export interface FileSpecDiff {
  readonly files: number;
  readonly differing: readonly { file: string; inferred: string | null; truth: string | null }[];
}

/** Files whose layer differs between two assignments over the same files. */
export function fileSpecDiff(
  inferred: ReadonlyMap<string, string | null>,
  truth: ReadonlyMap<string, string | null>,
): FileSpecDiff {
  const files = [...new Set([...inferred.keys(), ...truth.keys()])].sort();
  const differing = files
    .map((f) => ({ file: f, inferred: inferred.get(f) ?? null, truth: truth.get(f) ?? null }))
    .filter((d) => d.inferred !== d.truth);
  return { files: files.length, differing };
}

/** Field-by-field set comparison of two `architecture.ddd` blocks (as plain objects). */
export function dddBlockDiff(inferred: Record<string, unknown> | undefined, truth: Record<string, unknown> | undefined): { field: string; onlyInferred: string[]; onlyTrue: string[] }[] {
  const flat = (o: Record<string, unknown> | undefined, field: string): string[] => {
    const v = o?.[field];
    if (v === undefined) return [];
    if (!Array.isArray(v)) return [JSON.stringify(v)];
    return v.map((x) => JSON.stringify(normaliseKeys(x))).sort();
  };
  const fields = [...new Set([...Object.keys(inferred ?? {}), ...Object.keys(truth ?? {})])].sort();
  return fields
    .map((field) => {
      const a = flat(inferred, field);
      const b = flat(truth, field);
      return { field, onlyInferred: a.filter((x) => !b.includes(x)), onlyTrue: b.filter((x) => !a.includes(x)) };
    })
    .filter((d) => d.onlyInferred.length > 0 || d.onlyTrue.length > 0);
}

function normaliseKeys(x: unknown): unknown {
  if (Array.isArray(x)) return (x as unknown[]).map(normaliseKeys).sort();
  if (x !== null && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, normaliseKeys(v)]));
  }
  return x;
}

// ── (d) downstream: findings under the inferred spec vs the true spec ────────

export const findingKey = (f: ActualFinding): string =>
  f.ruleId === 'FF-S02' ? `${f.ruleId}|{${cycleFileSet(f)}}` : `${f.ruleId}|${f.file}|${f.target ?? ''}`;

export interface BlockingAgreement {
  readonly inferredBlocking: number;
  readonly trueBlocking: number;
  readonly both: number;
  /** |both| / |union|; 1 when both are empty. */
  readonly jaccard: number;
  /** Both specs give the same verdict: some blocking finding vs none. */
  readonly verdictAgrees: boolean;
  readonly onlyInferred: readonly string[];
  readonly onlyTrue: readonly string[];
}

/** Blocking findings (v1.3 tiers under each spec's own style) of the two runs compared by finding key. */
export function blockingAgreement(inferred: readonly ActualFinding[], inferredStyle: string, truth: readonly ActualFinding[], trueStyle: string): BlockingAgreement {
  const blocking = (fs: readonly ActualFinding[], style: string): Set<string> =>
    new Set(fs.filter((f) => ruleTier(f.ruleId, style).tier === 'blocking').map(findingKey));
  const a = blocking(inferred, inferredStyle);
  const b = blocking(truth, trueStyle);
  const both = [...a].filter((k) => b.has(k));
  const union = new Set([...a, ...b]);
  return {
    inferredBlocking: a.size,
    trueBlocking: b.size,
    both: both.length,
    jaccard: union.size === 0 ? 1 : both.length / union.size,
    verdictAgrees: (a.size > 0) === (b.size > 0),
    onlyInferred: [...a].filter((k) => !b.has(k)).sort(),
    onlyTrue: [...b].filter((k) => !a.has(k)).sort(),
  };
}

export interface PlantedResult {
  readonly variant: string;
  readonly kind: VariantKind;
  readonly plants: string | null;
  /** Rule-exact (the comparison of validate-reference): the planted rule's expected finding matched. */
  readonly plantedDetected: boolean | null;
  /** Expected findings matched / expected findings. */
  readonly matched: number;
  readonly expected: number;
  /** File-touch: some finding not on the clean variant names a file of an expected finding. */
  readonly touched: boolean | null;
}

/** Files named by an expected finding (a cycle's files split). */
export function expectedFiles(findings: readonly ExpectedFinding[]): Set<string> {
  const out = new Set<string>();
  for (const f of findings) for (const p of [...f.file.split(','), ...(f.target ?? '').split(',')]) if (p.trim() !== '') out.add(p.trim());
  return out;
}

/** Recall of the planted violation under one spec's findings (see PlantedResult). */
export function plantedResult(
  style: string,
  manifest: { variant: string; kind: VariantKind; plants: string | null; expectedFindings: readonly ExpectedFinding[] },
  actual: readonly ActualFinding[],
  cleanActual: readonly ActualFinding[],
  scope: ReadonlySet<string>,
): PlantedResult {
  const c = compareVariant(style, manifest, actual, scope, cleanActual);
  return {
    variant: manifest.variant,
    kind: manifest.kind,
    plants: manifest.plants,
    plantedDetected: c.plantedDetected,
    matched: c.matched.length,
    expected: manifest.expectedFindings.length,
    touched: manifest.kind === 'violation' ? touches(actual, cleanActual, manifest.expectedFindings) : null,
  };
}

/** Any row of `now` absent from `clean` (by finding key) naming a file of `expected`. */
export function touches(now: readonly { file: string; target?: string; ruleId?: string; rule?: string }[], clean: readonly { file: string; target?: string; ruleId?: string; rule?: string }[], expected: readonly ExpectedFinding[]): boolean {
  const files = expectedFiles(expected);
  const k = (f: { file: string; target?: string; ruleId?: string; rule?: string }): string => `${f.ruleId ?? f.rule ?? ''}|${f.file}|${f.target ?? ''}`;
  const old = new Set(clean.map(k));
  return now.some((f) => !old.has(k(f)) && [...f.file.split(','), ...(f.target ?? '').split(',')].some((p) => files.has(p.trim())));
}

/** New rows of `now` (not on clean) on a clean or near-miss variant: false alarms. */
export function newRows<T extends { file: string; target?: string; ruleId?: string; rule?: string }>(now: readonly T[], clean: readonly T[]): T[] {
  const k = (f: T): string => `${f.ruleId ?? f.rule ?? ''}|${f.file}|${f.target ?? ''}`;
  const old = new Set(clean.map(k));
  return now.filter((f) => !old.has(k(f)));
}
