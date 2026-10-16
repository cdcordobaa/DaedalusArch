/**
 * Pure helpers of the human erosion-trajectory job (M1, Docs/DiagnosticRuns/v1.3-human-erosion-2026-10-16.md):
 * the commit sampling rule, finding identities (reused from the loop pilot, `pilot-outcome-memo.md` §3), new
 * identities per interval, the per-repository OLS slope, the exact two-sided sign test and the small-multiples SVG.
 * No I/O; the entry file is `scripts/v1.3/human-erosion.ts`.
 */
import { findingIdentity, olsSlope } from '../../lib/loop/pilot-metrics.js';
import type { BlockingFinding } from '../../lib/loop/types.js';
import { templateOf } from './labelling/findings.js';

export const SAMPLES = 8;
/** A repository's slope is computed only with at least this many evaluated sampled commits. */
export const MIN_POINTS = 4;

/**
 * Sampled positions on a chain of `n` commits (oldest first): `round(i * (n - 1) / (k - 1))` for i = 0..k-1, so the
 * first and the last (the pin) are always in. Duplicates (n < k) are dropped.
 */
export function sampleIndices(n: number, k: number = SAMPLES): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error(`sampleIndices: chain length must be a positive integer, got ${String(n)}`);
  if (n === 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.round((i * (n - 1)) / (k - 1));
    if (out[out.length - 1] !== idx) out.push(idx);
  }
  return out;
}

export interface ReportViolation {
  readonly id: string; readonly functionId: string; readonly type: string; readonly filePath?: string;
  readonly target?: string; readonly line?: number; readonly message: string;
}
export interface TierRule { readonly functionId: string; readonly name: string; readonly tier: string; readonly violationCount: number }
export interface EvalReport {
  readonly violations: readonly ReportViolation[];
  readonly tiers: { readonly verdict: string; readonly blocking: { readonly rules: readonly TierRule[] }; readonly advisory: { readonly rules: readonly TierRule[] } };
  readonly layerAnnotation?: { readonly mapped: number; readonly unmapped: number };
}

/** The blocking findings of a report: rules the report's own tier table calls blocking (as `external-sheet.ts`). */
export function blockingFindingsOf(r: EvalReport): BlockingFinding[] {
  const names = new Map(r.tiers.blocking.rules.map((t) => [t.functionId, t.name]));
  return r.violations
    .filter((v) => names.has(v.functionId))
    .map((v) => ({
      ruleId: v.functionId,
      ruleName: names.get(v.functionId) ?? v.functionId,
      template: templateOf(v.type, v.functionId),
      violationId: v.id,
      filePath: v.filePath ?? '',
      ...(v.line !== undefined ? { line: v.line } : {}),
      ...(v.target !== undefined ? { target: v.target } : {}),
      message: v.message,
    }));
}

export function identitiesOf(findings: readonly BlockingFinding[]): string[] {
  return [...new Set(findings.map(findingIdentity))].sort();
}

/**
 * Per sampled commit (in order; `null` = not evaluated), the identities that no earlier evaluated sample held
 * (`new`) and the earlier ones it no longer holds (`gone`, relative to the previous evaluated sample). The first
 * evaluated sample has `new = null`: everything is new there by construction, which says nothing about erosion.
 */
export function intervalChanges(series: readonly (readonly string[] | null)[]): { readonly new: number | null; readonly gone: number | null }[] {
  const seen = new Set<string>();
  let prev: Set<string> | null = null;
  return series.map((ids) => {
    if (ids === null) return { new: null, gone: null };
    const cur = new Set(ids);
    if (prev === null) {
      for (const id of cur) seen.add(id);
      prev = cur;
      return { new: null, gone: null };
    }
    let added = 0;
    for (const id of cur) if (!seen.has(id)) added++;
    let gone = 0;
    for (const id of prev) if (!cur.has(id)) gone++;
    for (const id of cur) seen.add(id);
    prev = cur;
    return { new: added, gone };
  });
}

/** OLS slope over the evaluated points only; null with fewer than `MIN_POINTS` of them. */
export function repoSlope(points: readonly { readonly x: number; readonly y: number | null }[]): number | null {
  const pts = points.filter((p): p is { x: number; y: number } => p.y !== null);
  if (pts.length < MIN_POINTS) return null;
  return olsSlope(pts);
}

/** Exact two-sided sign test: zeros and nulls dropped, p = min(1, 2 · P(X ≤ min(pos, neg))), X ~ Bin(n, 1/2). */
export function signTest(slopes: readonly (number | null)[]): { readonly positive: number; readonly negative: number; readonly zero: number; readonly missing: number; readonly n: number; readonly p: number | null } {
  const positive = slopes.filter((s) => s !== null && s > 0).length;
  const negative = slopes.filter((s) => s !== null && s < 0).length;
  const zero = slopes.filter((s) => s === 0).length;
  const missing = slopes.filter((s) => s === null).length;
  const n = positive + negative;
  if (n === 0) return { positive, negative, zero, missing, n, p: null };
  const k = Math.min(positive, negative);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += binom(n, i);
  const p = Math.min(1, (2 * tail) / 2 ** n);
  return { positive, negative, zero, missing, n, p: Math.round(p * 1e6) / 1e6 };
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export interface Panel {
  readonly id: string;
  readonly style: string;
  /** Per sampled commit: chain index and blocking per KLOC (null = not evaluated). */
  readonly points: readonly { readonly x: number; readonly y: number | null }[];
  readonly slope: number | null;
}

const fmt = (v: number): string => (Math.round(v * 100) / 100).toString();
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Deterministic small multiples (3 columns), blocking per KLOC over the commit index, one panel per repository. */
export function smallMultiplesSvg(panels: readonly Panel[]): string {
  const W = 220; const H = 150; const PAD = 30; const COLS = 3;
  const rows = Math.max(1, Math.ceil(panels.length / COLS));
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(W * COLS)}" height="${String(H * rows + 20)}" viewBox="0 0 ${String(W * COLS)} ${String(H * rows + 20)}" font-family="sans-serif" font-size="10">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="4" y="${String(H * rows + 14)}" fill="#555">x: first-parent commit index (first src/ commit = 0, pin = last); y: blocking findings per KLOC; open circle = not evaluated</text>`,
  ];
  panels.forEach((p, i) => {
    const ox = (i % COLS) * W; const oy = Math.floor(i / COLS) * H;
    const xs = p.points.map((q) => q.x);
    const ys = p.points.map((q) => q.y).filter((y): y is number => y !== null);
    const xMax = Math.max(1, ...xs);
    const yMax = Math.max(1, ...ys);
    const sx = (x: number): number => ox + PAD + (x / xMax) * (W - PAD - 10);
    const sy = (y: number): number => oy + H - PAD + 10 - (y / yMax) * (H - PAD - 25);
    out.push(`<g>`);
    out.push(`<text x="${fmt(ox + PAD)}" y="${fmt(oy + 12)}" font-weight="bold">${esc(p.id)} (${esc(p.style)})</text>`);
    out.push(`<text x="${fmt(ox + PAD)}" y="${fmt(oy + 24)}" fill="#555">slope ${p.slope === null ? 'n/a' : fmt(p.slope * 1000) + ' per 1000 commits'}; y max ${fmt(yMax)}</text>`);
    out.push(`<line x1="${fmt(sx(0))}" y1="${fmt(sy(0))}" x2="${fmt(sx(xMax))}" y2="${fmt(sy(0))}" stroke="#999"/>`);
    out.push(`<line x1="${fmt(sx(0))}" y1="${fmt(sy(0))}" x2="${fmt(sx(0))}" y2="${fmt(sy(yMax))}" stroke="#999"/>`);
    out.push(`<text x="${fmt(sx(0) - 4)}" y="${fmt(sy(yMax) + 3)}" text-anchor="end" fill="#555">${fmt(yMax)}</text>`);
    out.push(`<text x="${fmt(sx(0) - 4)}" y="${fmt(sy(0) + 3)}" text-anchor="end" fill="#555">0</text>`);
    out.push(`<text x="${fmt(sx(xMax))}" y="${fmt(sy(0) + 12)}" text-anchor="end" fill="#555">${String(xMax)}</text>`);
    const ev = p.points.filter((q): q is { x: number; y: number } => q.y !== null);
    if (ev.length > 1) out.push(`<polyline fill="none" stroke="#2a6fb0" stroke-width="1.5" points="${ev.map((q) => `${fmt(sx(q.x))},${fmt(sy(q.y))}`).join(' ')}"/>`);
    for (const q of p.points) {
      if (q.y === null) out.push(`<circle cx="${fmt(sx(q.x))}" cy="${fmt(sy(0))}" r="3" fill="none" stroke="#b03a2a"/>`);
      else out.push(`<circle cx="${fmt(sx(q.x))}" cy="${fmt(sy(q.y))}" r="2.5" fill="#2a6fb0"/>`);
    }
    out.push(`</g>`);
  });
  out.push('</svg>');
  return out.join('\n') + '\n';
}
