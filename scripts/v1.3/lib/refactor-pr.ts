/**
 * Pure helpers of the declared-refactor validity study (Docs/DiagnosticRuns/v1.3-validity-refactor-pr-plan.md):
 * the fixed refactor-statement patterns (families A-G), the control filter, size matching, and the matched-difference
 * statistics with the plan's decision rule. No I/O.
 */
import { clusterBootstrap, median, seededRandom, signTest, wilson, type Interval } from './fixes-mined.js';

// ── Text ────────────────────────────────────────────────────────────────────

/** Message text that is a statement: merge lines naming branches and trailer lines removed (plan §4). */
export function statementText(message: string): string {
  return message
    .split('\n')
    .filter((l) => !/^\s*(co-authored-by|signed-off-by|reviewed-by|change-id)\s*:/i.test(l))
    .map((l) => l
      .replace(/^\s*Merge pull request #\d+ from \S+/i, ' ')
      .replace(/^\s*Merge (remote-tracking )?branch\b.*$/i, ' '))
    .join('\n');
}

/** PR number and kind from a first-parent commit message. */
export function prOf(message: string): { kind: 'merge' | 'squash' | 'direct'; pr?: number } {
  const subject = message.split('\n')[0] ?? '';
  const m = /^Merge pull request #(\d+)/i.exec(subject);
  if (m) return { kind: 'merge', pr: Number(m[1]) };
  const s = /\(#(\d+)\)\s*$/.exec(subject);
  if (s) return { kind: 'squash', pr: Number(s[1]) };
  return { kind: 'direct' };
}

/** Up to `n` filler words between two parts of a phrase. */
const gap = (n = 3): string => `\\W+(?:[\\w'-]+\\W+){0,${String(n)}}`;

export type Family = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

const A_VERB = '(?:remov|fix|break|broke|resolv|eliminat|avoid|get\\s+rid\\s+of|untangl|prevent|solv)\\w*';
const A_OBJ = '(?:(?:circular|cyclic)\\W+(?:dep\\w*|import\\w*|referenc\\w*|require\\w*)|(?:dependency|import)\\W+cycles?)';

/** Families A-D: the phrase is itself a refactor statement. */
const INTRINSIC: Record<'A' | 'B' | 'C' | 'D', RegExp[]> = {
  A: [
    new RegExp(`\\b${A_VERB}${gap()}${A_OBJ}\\b`, 'i'),
    /\bcircular\W+dep\w*\W+(?:fix|removal)\b/i,
  ],
  B: [/\b(?:decoupl|untangl|disentangl)\w*/i],
  C: [
    new RegExp(
      `\\b(?:move|moved|moves|moving|extract\\w*|pull\\w*|lift\\w*)${gap(4)}` +
        `(?:logic|code|quer(?:y|ies)|calls?|db\\s+access|database\\s+access|persistence)${gap()}` +
        `(?:out\\s+of|from)${gap()}(?:controller|route|router|resolver|handler|model|entit|view|component)\\w*`,
      'i',
    ),
    /\b(?:thin|thinner|slim)\w*\W+(?:controller|route|resolver|handler)s?\b/i,
  ],
  D: [
    /\b(?:layer|module|package|domain|context|architectur\w*)\W+boundar(?:y|ies)\b/i,
    /\blayer(?:ing)?\W+violation\w*/i,
    /\bdependency\W+(?:rule|direction|inversion)\b/i,
    /\binversion\W+of\W+control\b/i,
    /\bseparation\W+of\W+concerns\b/i,
    /\b(?:hexagonal|onion|clean)\W+architecture\b/i,
    /\bports?\W+(?:and|&)\W+adapters?\b/i,
  ],
};

/** Families E-G: the phrase needs a refactor verb elsewhere in the message. */
const NEEDS_VERB: Record<'E' | 'F' | 'G', RegExp[]> = {
  E: [/\b(?:service|domain|application|infrastructure|persistence|data[- ]access|repository|presentation|business)\W+layers?\b/i],
  F: [
    /\b(?:repository|adapter|port)\W+pattern\b/i,
    /\b(?:introduc|add|extract)\w*\W+(?:an?\W+)?(?:repository|repositories|ports?|adapters?|use[- ]?cases?|service\W+layer)\b/i,
  ],
  G: [/\b(?:architect\w*|restructur\w*|reorgani[sz]\w*|re-organi[sz]\w*)/i],
};

export const REFACTOR_VERB = /\b(?:refactor\w*|restructur\w*|reorgani[sz]\w*|move[ds]?|moving|extract\w*|split\w*|separat\w*|isolat\w*|decoupl\w*|clean\w*[- ]?up|remov\w*|enforc\w*|introduc\w*)/i;

export interface RefactorMatch {
  readonly families: Family[];
  /** The first matched phrase per family. */
  readonly phrases: Partial<Record<Family, string>>;
}

/** Families A-G the message matches (plan §4); empty = not a declared architecture refactor. */
export function classifyRefactor(message: string): RefactorMatch {
  const text = statementText(message);
  const families: Family[] = [];
  const phrases: Partial<Record<Family, string>> = {};
  for (const f of ['A', 'B', 'C', 'D'] as const) {
    for (const re of INTRINSIC[f]) {
      const m = re.exec(text);
      if (m) { families.push(f); phrases[f] = m[0]; break; }
    }
  }
  for (const f of ['E', 'F', 'G'] as const) {
    for (const re of NEEDS_VERB[f]) {
      const m = re.exec(text);
      if (!m) continue;
      // The verb must stand outside every occurrence of the phrase itself.
      const rest = text.replace(new RegExp(re.source, 'gi'), ' ');
      if (REFACTOR_VERB.test(rest)) { families.push(f); phrases[f] = m[0]; break; }
    }
  }
  return { families, phrases };
}

/** The loose word list: a commit matching it (or any family) is never a control. */
export const LOOSE_ARCH = /\b(?:refactor|restructur|reorgani|architect|layer|decoupl|circular|cycl|boundar|dependenc|adapter|domain|module)\w*|\bports?\b/i;

export function isControlCandidate(message: string): boolean {
  const text = statementText(message);
  return !LOOSE_ARCH.test(text) && classifyRefactor(message).families.length === 0;
}

export const isRevert = (message: string): boolean => /^\s*revert/i.test(message.split('\n')[0] ?? '');

// ── Selection ───────────────────────────────────────────────────────────────

export function capEvenly<T>(items: readonly T[], cap: number): T[] {
  if (items.length <= cap) return [...items];
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(items[Math.round((i * (items.length - 1)) / (cap - 1))] as T);
  return out;
}

export interface SizedCommit {
  readonly sha: string;
  /** First-parent order (0 = oldest). */
  readonly index: number;
  /** Committer date, epoch seconds. */
  readonly time: number;
  readonly files: number;
  readonly lines: number;
}

export const sizeDistance = (a: SizedCommit, b: SizedCommit): number =>
  Math.abs(Math.log1p(a.files) - Math.log1p(b.files)) + Math.abs(Math.log1p(a.lines) - Math.log1p(b.lines));

export const CALIPER = 1.5;
export const K_CONTROLS = 3;

export interface MatchedSet { readonly refactor: string; readonly controls: { sha: string; distance: number }[] }

/**
 * Greedy matching (plan §4): refactors in first-parent order, each takes up to `k` unused controls by smallest size
 * distance within the caliper, ties by closer commit date.
 */
export function matchControls(refactors: readonly SizedCommit[], pool: readonly SizedCommit[], k = K_CONTROLS, caliper = CALIPER): MatchedSet[] {
  const used = new Set<string>();
  const out: MatchedSet[] = [];
  for (const r of [...refactors].sort((a, b) => a.index - b.index)) {
    const cands = pool
      .filter((c) => !used.has(c.sha) && c.sha !== r.sha)
      .map((c) => ({ c, d: sizeDistance(r, c), t: Math.abs(c.time - r.time) }))
      .filter((x) => x.d <= caliper + 1e-12)
      .sort((x, y) => x.d - y.d || x.t - y.t || x.c.index - y.c.index)
      .slice(0, k);
    for (const x of cands) used.add(x.c.sha);
    out.push({ refactor: r.sha, controls: cands.map((x) => ({ sha: x.c.sha, distance: Math.round(x.d * 1e4) / 1e4 })) });
  }
  return out;
}

// ── Statistics and decision ─────────────────────────────────────────────────

export interface MatchedObs {
  readonly repo: string;
  readonly sha: string;
  /** Δ blocking of the refactor. */
  readonly dR: number;
  /** Δ blocking of each valid control. */
  readonly dC: readonly number[];
}

export const matchedDiff = (o: MatchedObs): number => o.dR - o.dC.reduce((s, x) => s + x, 0) / o.dC.length;

export interface Summary {
  readonly n: number;
  readonly repos: number;
  readonly mean: number;
  readonly median: number;
  readonly meanCi: { lo: number; hi: number };
  readonly medianCi: { lo: number; hi: number };
  readonly neg: number;
  readonly pos: number;
  readonly zero: number;
  readonly negShare: Interval;
  readonly signP: number;
}

const mean = (xs: readonly number[]): number => (xs.length === 0 ? Number.NaN : xs.reduce((s, x) => s + x, 0) / xs.length);

export function summarise(obs: readonly MatchedObs[], reps = 10000, seed = 20261016): Summary {
  const d = obs.map(matchedDiff);
  const byRepo = new Map<string, number[]>();
  for (const [i, o] of obs.entries()) byRepo.set(o.repo, [...(byRepo.get(o.repo) ?? []), d[i]!]);
  const clusters = [...byRepo.values()];
  const neg = d.filter((x) => x < 0).length;
  const pos = d.filter((x) => x > 0).length;
  return {
    n: obs.length,
    repos: clusters.length,
    mean: mean(d),
    median: median(d),
    meanCi: clusterBootstrap(clusters, (cs) => mean(cs.flat()), reps, seededRandom(seed)),
    medianCi: clusterBootstrap(clusters, (cs) => median(cs.flat()), reps, seededRandom(seed)),
    neg, pos, zero: d.length - neg - pos,
    negShare: wilson(neg, neg + pos),
    signP: signTest(pos, neg + pos),
  };
}

export interface LoroRow { readonly repo: string; readonly n: number; readonly mean: number; readonly median: number; readonly neg: number; readonly pos: number; readonly signP: number }

export function loro(obs: readonly MatchedObs[]): LoroRow[] {
  const repos = [...new Set(obs.map((o) => o.repo))].sort();
  return repos.map((repo) => {
    const d = obs.filter((o) => o.repo !== repo).map(matchedDiff);
    const neg = d.filter((x) => x < 0).length;
    const pos = d.filter((x) => x > 0).length;
    return { repo, n: d.length, mean: mean(d), median: median(d), neg, pos, signP: signTest(pos, neg + pos) };
  });
}

/** The observations without the one of largest |d| (first in input order on a tie). */
export function withoutLargest(obs: readonly MatchedObs[]): { dropped: MatchedObs | undefined; rest: MatchedObs[] } {
  let k = -1;
  let best = -1;
  obs.forEach((o, i) => { const a = Math.abs(matchedDiff(o)); if (a > best) { best = a; k = i; } });
  return { dropped: obs[k], rest: obs.filter((_, i) => i !== k) };
}

export type Verdict = 'SUPPORTED' | 'NOT ROBUST' | 'CONTRADICTED' | 'NULL';

export interface Decision {
  readonly verdict: Verdict;
  readonly underpowered: boolean;
  readonly checks: Record<string, boolean>;
}

/** The plan's §7 decision rule. */
export function decide(obs: readonly MatchedObs[], reps = 10000, seed = 20261016): Decision {
  const s = summarise(obs, reps, seed);
  const lo = loro(obs);
  const g = summarise(withoutLargest(obs).rest, reps, seed);
  const checks = {
    n30: s.n >= 30,
    signNeg: s.signP < 0.05 && s.neg > s.pos,
    ciBelow0: s.meanCi.hi < 0,
    loroHolds: lo.every((r) => r.mean < 0 && r.neg > r.pos),
    guardHolds: g.signP < 0.05 && g.neg > g.pos && g.meanCi.hi < 0,
    contradicted: s.signP < 0.05 && s.pos > s.neg && s.meanCi.lo > 0,
  };
  let verdict: Verdict;
  if (checks.signNeg && checks.ciBelow0) verdict = checks.loroHolds && checks.guardHolds && checks.n30 ? 'SUPPORTED' : 'NOT ROBUST';
  else if (checks.contradicted) verdict = 'CONTRADICTED';
  else verdict = 'NULL';
  return { verdict, underpowered: !checks.n30, checks };
}
