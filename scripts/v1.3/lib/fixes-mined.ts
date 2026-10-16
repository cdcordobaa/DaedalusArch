/**
 * v1.3 validity from developer behaviour ("fixes mined"): pure helpers shared by `scripts/v1.3/fixes-mined-run.ts`
 * and `scripts/v1.3/fixes-mined-report.ts` (Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md).
 *
 * The idea: no human rater says whether a finding matters. If the project's own maintainers later remove the exact
 * dependency the tool flags, in a commit that keeps both files in place and is not a mass change, that is evidence
 * the finding pointed at something they also considered wrong. The baseline is the same statistic for random
 * internal import edges the tool does not flag.
 *
 * - `evenlySpaced`: the commit sample (up to n, evenly spaced over the first-parent history, oldest first).
 * - `violationKey`, `violationEdges`: a finding's identity across snapshots and the file edges it rests on.
 * - `classifyDisappearance`: why a finding (or a baseline edge) present at a parent is absent at the child.
 * - `isBotAuthor`, `isMassChange`, `mentionsArchitecture`: the threat filters and the commit-message signal.
 * - `wilson`, `rateRatio`, `cohenH`, `kaplanMeier`, `clusterBootstrap`, `seededRandom`: the statistics.
 */

// ── Sampling ────────────────────────────────────────────────────────────────

/** Up to `n` items spread evenly over `items` (first and last included when n >= 2), in input order. */
export function evenlySpaced<T>(items: readonly T[], n: number): T[] {
  if (n <= 0 || items.length === 0) return [];
  if (items.length <= n) return [...items];
  if (n === 1) return [items[items.length - 1] as T];
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (items.length - 1)) / (n - 1));
    if (!seen.has(idx)) { seen.add(idx); out.push(items[idx] as T); }
  }
  return out;
}

/** Mulberry32: a small seeded PRNG (the baseline edge sample and the bootstrap). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded sample of k items without replacement (Fisher-Yates prefix), order of the shuffle. */
export function sampleWithout<T>(items: readonly T[], k: number, rnd: () => number): T[] {
  const a = [...items];
  const m = Math.min(k, a.length);
  for (let i = 0; i < m; i++) {
    const j = i + Math.floor(rnd() * (a.length - i));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, m);
}

// ── Finding identity ────────────────────────────────────────────────────────

/** The fields of a report violation the miner keeps (`EvaluationReport.violations[]`). */
export interface MinedViolation {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string | undefined;
  readonly discriminator?: readonly string[] | undefined;
}

/** A file edge `source|target`, both repo-root-relative to the analysis root. */
export const edgeKey = (s: string, t: string): string => `${s}|${t}`;

/**
 * The file edges a finding rests on:
 * - a cycle (`FF-S02`, `filePath` a comma list or a JSON path discriminator): its consecutive pairs;
 * - a finding with a `target` file: the one edge `filePath -> target`;
 * - otherwise (metric, proxy, convention, a package import): none, the finding is file-level.
 * Package targets (no `/` and no extension, e.g. `@nestjs/common`) are not file edges.
 */
export function violationEdges(v: MinedViolation): string[] {
  const path = cyclePath(v);
  if (path !== undefined) {
    const out: string[] = [];
    for (let i = 0; i + 1 < path.length; i++) out.push(edgeKey(path[i] as string, path[i + 1] as string));
    return [...new Set(out)];
  }
  if (v.target !== undefined && looksLikeFile(v.target) && !v.filePath.includes(',')) return [edgeKey(v.filePath, v.target)];
  return [];
}

function looksLikeFile(p: string): boolean {
  return /\.(c|m)?tsx?$|\.(c|m)?jsx?$/.test(p);
}

function cyclePath(v: MinedViolation): string[] | undefined {
  if (v.functionId !== 'FF-S02' && !v.filePath.includes(',')) return undefined;
  const d = v.discriminator?.[0];
  if (d !== undefined && d.startsWith('[')) {
    try {
      const arr = JSON.parse(d) as unknown;
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr;
    } catch { /* fall through */ }
  }
  return v.filePath.includes(',') ? v.filePath.split(',') : undefined;
}

/**
 * A finding's identity across snapshots: rule, file and target (or the cycle's node set, rotation-free, so the same
 * cycle reported from another start node keeps its identity). Line numbers are not part of it: an edit above the
 * import moves the line, not the finding.
 */
export function violationKey(v: MinedViolation): string {
  const path = cyclePath(v);
  if (path !== undefined) return `${v.functionId}#cycle#${canonicalCycle(path).join('>')}`;
  const disc = (v.discriminator ?? []).filter((d) => d !== 'IMPORTS').join(';');
  return `${v.functionId}#${v.filePath}#${v.target ?? ''}#${disc}`;
}

/** A cycle path `[a, b, c, a]` as its node list rotated to start at the smallest node (`[a, b, c]`). */
export function canonicalCycle(path: readonly string[]): string[] {
  const nodes = path.length > 1 && path[0] === path[path.length - 1] ? path.slice(0, -1) : [...path];
  if (nodes.length === 0) return [];
  let best = 0;
  for (let i = 1; i < nodes.length; i++) if ((nodes[i] as string) < (nodes[best] as string)) best = i;
  return [...nodes.slice(best), ...nodes.slice(0, best)];
}

/** The files a finding names (the source file, the target file, every cycle member). */
export function violationFiles(v: MinedViolation): string[] {
  const path = cyclePath(v);
  if (path !== undefined) return [...new Set(path)];
  const out = [v.filePath];
  if (v.target !== undefined && looksLikeFile(v.target)) out.push(v.target);
  return out;
}

// ── Disappearance classification ────────────────────────────────────────────

export type Disappearance =
  /** Every file the finding names is still at its path, the change is not a mass change, and a file edge it rests on is gone. */
  | 'FIXED-BY-DEV'
  /** A named file was deleted. */
  | 'FILE-DELETED'
  /** A named file was renamed or moved (git rename detection). */
  | 'RENAMED'
  /** The commit is a mass change (see `isMassChange`) or by a bot. */
  | 'MASS-OR-BOT'
  /** Files and edges are still there; the finding went away for another reason (a layer, metric or cycle elsewhere). */
  | 'OTHER'
  /** A file-level finding (no edge) gone while its file stays: resolved in place, not an edge removal. */
  | 'RESOLVED-IN-PLACE';

export interface DisappearanceInput {
  /** The files the finding (or baseline edge) names. */
  readonly files: readonly string[];
  /** The file edges it rests on (empty for a file-level finding). */
  readonly edges: readonly string[];
  /** Files present at the child (analysis-root relative). */
  readonly childFiles: ReadonlySet<string>;
  /** File edges present at the child. */
  readonly childEdges: ReadonlySet<string>;
  /** Old paths git reports as renamed or copied-and-deleted in parent..child. */
  readonly renamedFrom: ReadonlySet<string>;
  readonly massOrBot: boolean;
}

export function classifyDisappearance(x: DisappearanceInput): Disappearance {
  if (x.files.some((f) => x.renamedFrom.has(f))) return 'RENAMED';
  if (x.files.some((f) => !x.childFiles.has(f))) return 'FILE-DELETED';
  if (x.massOrBot) return 'MASS-OR-BOT';
  if (x.edges.length === 0) return 'RESOLVED-IN-PLACE';
  if (x.edges.some((e) => !x.childEdges.has(e))) return 'FIXED-BY-DEV';
  return 'OTHER';
}

// ── Threat filters and the message signal ───────────────────────────────────

/** Bot authors (dependency bumps, CI, formatting bots), by name or e-mail. */
export function isBotAuthor(name: string, email: string): boolean {
  const s = `${name} ${email}`.toLowerCase();
  return /\[bot\]|dependabot|renovate|github-actions|greenkeeper|snyk-bot|semantic-release|allcontributors|mergify|weblate|crowdin|imgbot|pre-commit-ci|deepsource/.test(s);
}

export interface ChangeShape {
  /** Files under the analysis root changed (added, modified, deleted, renamed) in parent..child. */
  readonly changed: number;
  /** Of those, renamed or deleted. */
  readonly renamedOrDeleted: number;
  /** Source files under the analysis root at the parent. */
  readonly rootFiles: number;
}

/** Mass-change thresholds (fixed before any run; Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md §2). */
export const MASS_CHANGED_FILES = 100;
export const MASS_CHANGED_SHARE = 0.25;
export const MASS_MOVED_FILES = 20;
export const MASS_MOVED_SHARE = 0.10;

/**
 * A mass change: at least 100 files or a quarter of the root's files changed, or at least 20 files or a tenth of them
 * renamed or deleted (a restructuring, a formatter run, a framework migration). A finding that disappears in one is not
 * credited to a deliberate fix.
 */
export function isMassChange(c: ChangeShape): boolean {
  const n = Math.max(1, c.rootFiles);
  return c.changed >= MASS_CHANGED_FILES || c.changed / n >= MASS_CHANGED_SHARE
    || c.renamedOrDeleted >= MASS_MOVED_FILES || c.renamedOrDeleted / n >= MASS_MOVED_SHARE;
}

/** The architecture vocabulary of the task (word stems, case-insensitive, whole-word start). */
export const ARCH_WORDS = ['layer', 'dependenc', 'decoupl', 'refactor', 'port', 'adapter', 'domain'] as const;
const ARCH_RE = /\b(layer|dependenc|decoupl|refactor|ports?\b|adapter|domain)/i;

/** Whether a commit message (subject and body) uses an architecture word. `port` must be the whole word (not "import", "report", "support"). */
export function mentionsArchitecture(message: string): boolean {
  return ARCH_RE.test(message);
}

// ── Statistics ──────────────────────────────────────────────────────────────

export interface Interval { readonly p: number; readonly lo: number; readonly hi: number }

/** Wilson score interval for k successes in n trials (95% by default). n = 0 gives NaN bounds. */
export function wilson(k: number, n: number, z = 1.959964): Interval {
  if (n <= 0) return { p: Number.NaN, lo: Number.NaN, hi: Number.NaN };
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/** Rate ratio (k1/n1)/(k0/n0) with the log-normal 95% interval; a zero count gets the 0.5 continuity correction. */
export function rateRatio(k1: number, n1: number, k0: number, n0: number, z = 1.959964): Interval {
  if (n1 <= 0 || n0 <= 0) return { p: Number.NaN, lo: Number.NaN, hi: Number.NaN };
  const cc = k1 === 0 || k0 === 0 ? 0.5 : 0;
  const a = k1 + cc;
  const b = k0 + cc;
  const rr = (a / (n1 + cc)) / (b / (n0 + cc));
  const se = Math.sqrt(1 / a - 1 / (n1 + cc) + 1 / b - 1 / (n0 + cc));
  return { p: rr, lo: Math.exp(Math.log(rr) - z * se), hi: Math.exp(Math.log(rr) + z * se) };
}

/** Cohen's h for two proportions (arcsine difference; 0.2 small, 0.5 medium, 0.8 large). */
export function cohenH(p1: number, p0: number): number {
  return 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p0));
}

export interface SurvivalObs {
  /** Time to the event or to censoring (days). */
  readonly t: number;
  /** true: the event (the finding disappeared); false: still present at the last observation (censored). */
  readonly event: boolean;
}

export interface KmResult {
  readonly n: number;
  readonly events: number;
  /** Median survival time (days), or null when the curve never reaches 0.5 (more than half still alive). */
  readonly median: number | null;
  /** S(t) at 365 days. */
  readonly s365: number;
}

/** Kaplan-Meier estimate: median and one-year survival. */
export function kaplanMeier(obs: readonly SurvivalObs[]): KmResult {
  const sorted = [...obs].sort((a, b) => a.t - b.t || Number(b.event) - Number(a.event));
  let atRisk = sorted.length;
  let s = 1;
  let median: number | null = null;
  let s365 = 1;
  let i = 0;
  while (i < sorted.length) {
    const t = (sorted[i] as SurvivalObs).t;
    let d = 0;
    let c = 0;
    while (i < sorted.length && (sorted[i] as SurvivalObs).t === t) {
      if ((sorted[i] as SurvivalObs).event) d++; else c++;
      i++;
    }
    if (d > 0 && atRisk > 0) s *= 1 - d / atRisk;
    if (t <= 365) s365 = s;
    if (median === null && s <= 0.5) median = t;
    atRisk -= d + c;
  }
  return { n: obs.length, events: obs.filter((o) => o.event).length, median, s365 };
}

/**
 * Percentile bootstrap over clusters (repositories): resample clusters with replacement, recompute `stat`, return
 * the 2.5% and 97.5% quantiles. Findings in one repository are not independent; this keeps that in the interval.
 */
export function clusterBootstrap<C>(clusters: readonly C[], stat: (cs: readonly C[]) => number, reps: number, rnd: () => number): { lo: number; hi: number } {
  const vals: number[] = [];
  for (let r = 0; r < reps; r++) {
    const pick: C[] = [];
    for (let i = 0; i < clusters.length; i++) pick.push(clusters[Math.floor(rnd() * clusters.length)] as C);
    const v = stat(pick);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  if (vals.length === 0) return { lo: Number.NaN, hi: Number.NaN };
  const q = (p: number): number => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * (vals.length - 1))))] as number;
  return { lo: q(0.025), hi: q(0.975) };
}

/** Median of a list (NaN when empty). */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Exact two-sided sign test p-value for `pos` positives out of `n` non-tied pairs. */
export function signTest(pos: number, n: number): number {
  if (n === 0) return 1;
  const k = Math.min(pos, n - pos);
  let tail = 0;
  let c = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i <= k) tail += c;
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}
