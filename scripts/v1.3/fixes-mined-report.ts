/**
 * v1.3 validity from developer behaviour: aggregate the walks (`scripts/v1.3/fixes-mined-run.ts`) into the statistics
 * and tables of Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md. Entry file: no exports.
 *
 * Usage (repository root): node --import tsx scripts/v1.3/fixes-mined-report.ts
 * Reads results/v1.3-fixes-mined/{corpus.json, repos/<id>/*}; writes results/v1.3-fixes-mined/summary.json and
 * results/v1.3-fixes-mined/tables.md (the report's tables, regenerated verbatim).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import {
  clusterBootstrap, cohenH, kaplanMeier, median, mentionsArchitecture, rateRatio, seededRandom, signTest, wilson,
  type Interval, type SurvivalObs,
} from './lib/fixes-mined.js';
import { ruleTier } from '../../src/scoring-engine/rule-tiers.js';

const OUT = path.join(process.cwd(), 'results/v1.3-fixes-mined');
const readGz = <T>(p: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8')) as T;

interface CorpusEntry { id: string; repo: string; sha: string; root: string; style: string; source: string; historyPath?: string }
interface PairFinding { key: string; functionId: string; tier: 'blocking' | 'advisory'; edgeShaped: boolean; layers?: string; cause?: string; filePath: string; target?: string; line?: number; message: string }
interface EdgeStats { exposed: number; causes: Record<string, number> }
interface PairRecord {
  sha: string; parent: string; date: string; author: string; bot: boolean; mass: boolean; changed: number; message: string;
  parentOk: boolean; childOk: boolean;
  exposedByRule: Record<string, number>; exposedEdgeByRule: Record<string, number>; childByRule: Record<string, number>;
  disappeared: PairFinding[]; introduced: PairFinding[];
  baseline: Record<'all' | 'layered' | 'crossLayer', EdgeStats>; baselineFixedSample: string[];
}
interface Lineage { key: string; kind: 'finding' | 'edge'; functionId?: string; tier?: 'blocking' | 'advisory'; edgeShaped?: boolean; edgeKind?: string; born: number; ended: number | null; filesStay?: boolean }
interface Walk { id: string; firstParentCommitsTouchingRoot: number; sampled: number; snapshotsEvaluated: number; snapshotErrors: number; atLastSample: { files: number; layeredFiles: number; imports: number; findings: number } | null; firstSampled?: { date: string }; lastSampled?: { date: string }; wallSeconds: number }

const S02_CAP = 100;
const FIX = 'FIXED-BY-DEV';
const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(x < 0.001 && x > 0 ? 3 : 2)}%` : 'n/a');
const ci = (w: Interval): string => (Number.isFinite(w.p) ? `${pct(w.p)} [${pct(w.lo)}, ${pct(w.hi)}]` : 'n/a');
const num = (x: number, d = 2): string => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const days = (a: string, b: string): number => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const subject = (m: string): string => (m.split('\n')[0] ?? '').slice(0, 110).replace(/\|/g, '/');
/** For a merge commit the PR title is the first body line; show it after the subject. */
const shownMessage = (m: string): string => {
  const lines = m.split('\n').map((l) => l.trim()).filter(Boolean);
  const s = lines[0] ?? '';
  return (s.startsWith('Merge pull request') || s.startsWith('Merge branch')) && lines[1] !== undefined ? `${subject(s)} — ${subject(lines[1])}` : subject(s);
};

interface Counter { exposed: number; fixed: number; causes: Record<string, number>; introduced: number; fixCommits: Set<string>; archCommits: Set<string> }
const counter = (): Counter => ({ exposed: 0, fixed: 0, causes: {}, introduced: 0, fixCommits: new Set(), archCommits: new Set() });

interface RepoAgg {
  id: string;
  pairs: number; validPairs: number; botPairs: number; massPairs: number; s02Truncated: number;
  byRule: Map<string, Counter & { tier: string; edgeExposed: number }>;
  blockingEdge: Counter; advisoryEdge: Counter; advisoryFile: Counter; blockingFile: Counter;
  base: Record<'all' | 'layered' | 'crossLayer', Counter>;
  allCommits: number; allArch: number;
}

function aggregateRepo(id: string, style: string, pairs: readonly PairRecord[]): RepoAgg {
  const tierOf = (rule: string): 'blocking' | 'advisory' => ruleTier(rule, style).tier;
  // FF-S03 is blocking only under `layered` (rule-tiers.md): its rows are kept apart by tier.
  const ruleKey = (rule: string): string => (rule === 'FF-S03' ? `FF-S03 (${tierOf(rule)})` : rule);
  const a: RepoAgg = {
    id, pairs: pairs.length, validPairs: 0, botPairs: 0, massPairs: 0, s02Truncated: 0, byRule: new Map(),
    blockingEdge: counter(), advisoryEdge: counter(), advisoryFile: counter(), blockingFile: counter(),
    base: { all: counter(), layered: counter(), crossLayer: counter() }, allCommits: 0, allArch: 0,
  };
  for (const p of pairs) {
    if (!p.parentOk || !p.childOk) continue;
    a.validPairs++;
    if (p.bot) a.botPairs++;
    if (p.mass) a.massPairs++;
    if (!p.bot) { a.allCommits++; if (mentionsArchitecture(p.message)) a.allArch++; }
    const trunc = (p.exposedByRule['FF-S02'] ?? 0) >= S02_CAP || (p.childByRule['FF-S02'] ?? 0) >= S02_CAP;
    if (trunc) a.s02Truncated++;
    const skip = (rule: string): boolean => rule === 'FF-S02' && trunc;
    for (const [rule, n] of Object.entries(p.exposedByRule)) {
      if (skip(rule)) continue;
      const r = a.byRule.get(ruleKey(rule)) ?? { ...counter(), tier: tierOf(rule), edgeExposed: 0 };
      r.exposed += n;
      r.edgeExposed += p.exposedEdgeByRule[rule] ?? 0;
      a.byRule.set(ruleKey(rule), r);
    }
    for (const f of p.disappeared) {
      if (skip(f.functionId)) continue;
      const r = a.byRule.get(ruleKey(f.functionId)) ?? { ...counter(), tier: tierOf(f.functionId), edgeExposed: 0 };
      r.causes[f.cause ?? '?'] = (r.causes[f.cause ?? '?'] ?? 0) + 1;
      const ft = tierOf(f.functionId);
      const group = f.edgeShaped ? (ft === 'blocking' ? a.blockingEdge : a.advisoryEdge) : (ft === 'blocking' ? a.blockingFile : a.advisoryFile);
      group.causes[f.cause ?? '?'] = (group.causes[f.cause ?? '?'] ?? 0) + 1;
      const credited = f.edgeShaped ? f.cause === FIX : f.cause === 'RESOLVED-IN-PLACE';
      if (credited) {
        if (f.edgeShaped) r.fixed++;
        group.fixed++;
        group.fixCommits.add(p.sha);
        if (mentionsArchitecture(p.message)) group.archCommits.add(p.sha);
        if (f.edgeShaped) { r.fixCommits.add(p.sha); if (mentionsArchitecture(p.message)) r.archCommits.add(p.sha); }
      }
      a.byRule.set(ruleKey(f.functionId), r);
    }
    for (const f of p.introduced) {
      if (skip(f.functionId)) continue;
      const r = a.byRule.get(ruleKey(f.functionId)) ?? { ...counter(), tier: tierOf(f.functionId), edgeExposed: 0 };
      r.introduced++;
      a.byRule.set(ruleKey(f.functionId), r);
      const it = tierOf(f.functionId);
      (f.edgeShaped ? (it === 'blocking' ? a.blockingEdge : a.advisoryEdge) : (it === 'blocking' ? a.blockingFile : a.advisoryFile)).introduced++;
    }
    // Exposure per group: from the per-rule exposure split; the tier of a rule comes from its findings in any pair.
    for (const [rule, n] of Object.entries(p.exposedByRule)) {
      if (skip(rule)) continue;
      const tier = tierOf(rule);
      const e = p.exposedEdgeByRule[rule] ?? 0;
      (tier === 'blocking' ? a.blockingEdge : a.advisoryEdge).exposed += e;
      (tier === 'blocking' ? a.blockingFile : a.advisoryFile).exposed += n - e;
    }
    for (const k of ['all', 'layered', 'crossLayer'] as const) {
      const b = p.baseline[k];
      a.base[k].exposed += b.exposed;
      const fx = b.causes[FIX] ?? 0;
      a.base[k].fixed += fx;
      for (const [c, n] of Object.entries(b.causes)) a.base[k].causes[c] = (a.base[k].causes[c] ?? 0) + n;
      if (fx > 0) { a.base[k].fixCommits.add(p.sha); if (mentionsArchitecture(p.message)) a.base[k].archCommits.add(p.sha); }
    }
  }
  return a;
}

function survival(lin: readonly Lineage[], grid: readonly { date: string }[], pick: (l: Lineage) => boolean): { obs: SurvivalObs[]; inPlace: number; ended: number } {
  const last = grid.at(-1)?.date ?? '';
  const obs: SurvivalObs[] = [];
  let inPlace = 0;
  let ended = 0;
  for (const l of lin) {
    if (l.born === 0 || !pick(l)) continue;
    const b = grid[l.born]?.date;
    if (b === undefined) continue;
    if (l.ended !== null) {
      const e = grid[l.ended]?.date ?? last;
      obs.push({ t: Math.max(0, days(b, e)), event: true });
      ended++;
      if (l.filesStay === true) inPlace++;
    } else obs.push({ t: Math.max(0, days(b, last)), event: false });
  }
  return { obs, inPlace, ended };
}

function main(): void {
  const corpus = (JSON.parse(fs.readFileSync(path.join(OUT, 'corpus.json'), 'utf8')) as { entries: CorpusEntry[] }).entries;
  const have = corpus.filter((e) => fs.existsSync(path.join(OUT, 'repos', e.id, 'walk.json')));
  const pairsBy = new Map<string, PairRecord[]>();
  const linBy = new Map<string, { grid: { sha: string; date: string }[]; lineages: Lineage[] }>();
  const walkBy = new Map<string, Walk>();
  for (const e of have) {
    const dir = path.join(OUT, 'repos', e.id);
    walkBy.set(e.id, JSON.parse(fs.readFileSync(path.join(dir, 'walk.json'), 'utf8')) as Walk);
    const pairs = readGz<PairRecord[]>(path.join(dir, 'pairs.json.gz'));
    pairsBy.set(e.id, pairs);
    linBy.set(e.id, readGz(path.join(dir, 'lineages.json.gz')));
  }
  const aggs = have.map((e) => aggregateRepo(e.id, e.style, pairsBy.get(e.id) ?? []));
  const long = new Set(have.filter((e) => (walkBy.get(e.id)?.firstParentCommitsTouchingRoot ?? 0) >= 300).map((e) => e.id));

  const sum = (xs: readonly RepoAgg[], f: (a: RepoAgg) => Counter): { exposed: number; fixed: number; fixCommits: number; archCommits: number; causes: Record<string, number>; introduced: number } => {
    const out = { exposed: 0, fixed: 0, fixCommits: 0, archCommits: 0, causes: {} as Record<string, number>, introduced: 0 };
    for (const a of xs) {
      const c = f(a);
      out.exposed += c.exposed; out.fixed += c.fixed; out.fixCommits += c.fixCommits.size; out.archCommits += c.archCommits.size; out.introduced += c.introduced;
      for (const [k, n] of Object.entries(c.causes)) out.causes[k] = (out.causes[k] ?? 0) + n;
    }
    return out;
  };
  const rnd = seededRandom(20261016);
  const ratioStat = (num: (a: RepoAgg) => Counter, den: (a: RepoAgg) => Counter) => (cs: readonly RepoAgg[]): number => {
    const n = sum(cs, num);
    const d = sum(cs, den);
    return n.exposed > 0 && d.exposed > 0 && d.fixed > 0 ? (n.fixed / n.exposed) / (d.fixed / d.exposed) : Number.NaN;
  };

  const groups: [string, (a: RepoAgg) => Counter][] = [
    ['blocking, edge-shaped', (a) => a.blockingEdge],
    ['advisory, edge-shaped', (a) => a.advisoryEdge],
    ['advisory, file-level (resolved in place)', (a) => a.advisoryFile],
    ['blocking, file-level (resolved in place)', (a) => a.blockingFile],
    ['baseline: unflagged cross-layer import edges', (a) => a.base.crossLayer],
    ['baseline: unflagged layered import edges', (a) => a.base.layered],
    ['baseline: all unflagged internal import edges', (a) => a.base.all],
  ];
  const lines: string[] = [];
  const summary: Record<string, unknown> = { generated: new Date().toISOString(), repos: have.length };

  // ── Corpus table ──
  lines.push('## Corpus', '', '| id | source | style | commits on path | sampled | valid pairs | files (last sample) | blocking findings (last) | bot / mass pairs | wall s |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  const corpusRows: unknown[] = [];
  for (const e of have) {
    const w = walkBy.get(e.id) as Walk;
    const a = aggs.find((x) => x.id === e.id) as RepoAgg;
    const pairs = pairsBy.get(e.id) ?? [];
    const lastValid = [...pairs].reverse().find((p) => p.childOk);
    const blockingLast = lastValid !== undefined ? Object.entries(lastValid.childByRule).filter(([r]) => ruleTier(r, e.style).tier === 'blocking').reduce((s, [, n]) => s + n, 0) : 0;
    lines.push(`| ${e.id} | ${e.source.split(' ')[0] ?? ''} | ${e.style} | ${String(w.firstParentCommitsTouchingRoot)} | ${String(w.sampled)} | ${String(a.validPairs)} | ${String(w.atLastSample?.files ?? 0)} | ${String(blockingLast)} | ${String(a.botPairs)} / ${String(a.massPairs)} | ${String(w.wallSeconds)} |`);
    corpusRows.push({ id: e.id, repo: e.repo, commits: w.firstParentCommitsTouchingRoot, sampled: w.sampled, validPairs: a.validPairs, snapshotsEvaluated: w.snapshotsEvaluated, snapshotErrors: w.snapshotErrors, files: w.atLastSample?.files ?? 0, blockingLast, bot: a.botPairs, mass: a.massPairs, s02Truncated: a.s02Truncated, from: w.firstSampled?.date, to: w.lastSampled?.date });
  }
  summary.corpus = corpusRows;
  lines.push('');

  // ── Headline: groups, pooled ──
  const headline = (subset: readonly RepoAgg[], label: string): void => {
    lines.push(`## Removal rate per exposure (${label})`, '', 'Exposure = a finding (or unflagged edge) present at the parent of a sampled commit. Credited = FIXED-BY-DEV for edge-shaped findings and baseline edges; RESOLVED-IN-PLACE for file-level findings (not an edge removal; shown for comparison only).', '',
      '| group | exposures | credited removals | rate [Wilson 95%] | vs cross-layer baseline: rate ratio [95%] | repo-bootstrap 95% | Cohen h | fix commits | with architecture words |', '|---|---:|---:|---|---|---|---:|---:|---|');
    const base = sum(subset, (a) => a.base.crossLayer);
    const pBase = base.exposed > 0 ? base.fixed / base.exposed : Number.NaN;
    const out: unknown[] = [];
    for (const [name, f] of groups) {
      const s = sum(subset, f);
      const w = wilson(s.fixed, s.exposed);
      const isBase = name.startsWith('baseline: unflagged cross-layer');
      const rr = isBase ? undefined : rateRatio(s.fixed, s.exposed, base.fixed, base.exposed);
      const boot = isBase ? undefined : clusterBootstrap(subset, ratioStat(f, (a) => a.base.crossLayer), 2000, rnd);
      const h = isBase ? Number.NaN : cohenH(w.p, pBase);
      const arch = wilson(s.archCommits, s.fixCommits);
      lines.push(`| ${name} | ${String(s.exposed)} | ${String(s.fixed)} | ${ci(w)} | ${rr !== undefined ? `${num(rr.p)} [${num(rr.lo)}, ${num(rr.hi)}]` : '—'} | ${boot !== undefined ? `[${num(boot.lo)}, ${num(boot.hi)}]` : '—'} | ${isBase ? '—' : num(h, 3)} | ${String(s.fixCommits)} | ${String(s.archCommits)} (${ci(arch)}) |`);
      out.push({ group: name, ...s, rate: w, rateRatioVsCrossLayer: rr, bootstrap: boot, cohenH: h, archShare: arch });
    }
    const allC = subset.reduce((x, a) => x + a.allCommits, 0);
    const allA = subset.reduce((x, a) => x + a.allArch, 0);
    lines.push('', `Base rate of architecture words over every non-bot sampled commit: ${String(allA)} / ${String(allC)} = ${ci(wilson(allA, allC))}.`, '');
    summary[`groups:${label}`] = out;
    summary[`archBase:${label}`] = { commits: allC, arch: allA };
  };
  headline(aggs, 'all repositories');
  headline(aggs.filter((a) => long.has(a.id)), 'repositories with >= 300 commits on the path');

  // ── Per repository sign test ──
  lines.push('## Per repository', '', 'Blocking edge-shaped removal rate against the cross-layer baseline rate, per repository with at least one blocking edge-shaped exposure.', '',
    '| id | blocking exposures | blocking FIXED-BY-DEV | rate | cross-layer exposures | cross-layer FIXED-BY-DEV | rate | blocking > baseline |', '|---|---:|---:|---|---:|---:|---|---|');
  let pos = 0;
  let nonTied = 0;
  const repoRows: unknown[] = [];
  for (const a of aggs) {
    if (a.blockingEdge.exposed === 0) continue;
    const rb = a.blockingEdge.fixed / a.blockingEdge.exposed;
    const r0 = a.base.crossLayer.exposed > 0 ? a.base.crossLayer.fixed / a.base.crossLayer.exposed : Number.NaN;
    const cmp = !Number.isFinite(r0) ? 'n/a' : rb > r0 ? 'yes' : rb < r0 ? 'no' : 'tie';
    if (cmp === 'yes' || cmp === 'no') { nonTied++; if (cmp === 'yes') pos++; }
    lines.push(`| ${a.id} | ${String(a.blockingEdge.exposed)} | ${String(a.blockingEdge.fixed)} | ${pct(rb)} | ${String(a.base.crossLayer.exposed)} | ${String(a.base.crossLayer.fixed)} | ${pct(r0)} | ${cmp} |`);
    repoRows.push({ id: a.id, blockingExposed: a.blockingEdge.exposed, blockingFixed: a.blockingEdge.fixed, baseExposed: a.base.crossLayer.exposed, baseFixed: a.base.crossLayer.fixed, cmp });
  }
  const sp = signTest(pos, nonTied);
  lines.push('', `Sign test: ${String(pos)} of ${String(nonTied)} non-tied repositories have a higher blocking rate than their cross-layer baseline; two-sided p = ${num(sp, 4)}.`, '');
  summary.perRepo = { rows: repoRows, pos, nonTied, signTestP: sp };

  // ── Per rule ──
  const rules = new Map<string, Counter & { tier: string; edgeExposed: number }>();
  for (const a of aggs) for (const [k, r] of a.byRule) {
    const t = rules.get(k) ?? { ...counter(), tier: r.tier, edgeExposed: 0 };
    t.exposed += r.exposed; t.edgeExposed += r.edgeExposed; t.fixed += r.fixed; t.introduced += r.introduced;
    for (const s of r.fixCommits) t.fixCommits.add(`${a.id}:${s}`);
    for (const s of r.archCommits) t.archCommits.add(`${a.id}:${s}`);
    for (const [c, n] of Object.entries(r.causes)) t.causes[c] = (t.causes[c] ?? 0) + n;
    rules.set(k, t);
  }
  // Survival per rule, pooled over repositories.
  const survBy = (pick: (l: Lineage) => boolean): { obs: SurvivalObs[]; inPlace: number; ended: number } => {
    const out = { obs: [] as SurvivalObs[], inPlace: 0, ended: 0 };
    for (const [, g] of linBy) {
      const s = survival(g.lineages, g.grid, pick);
      out.obs.push(...s.obs); out.inPlace += s.inPlace; out.ended += s.ended;
    }
    return out;
  };
  const base = sum(aggs, (a) => a.base.crossLayer);
  lines.push('## Per rule', '', 'Pair level (exposures, FIXED-BY-DEV among edge-shaped exposures, Wilson 95%), and grid level (lineages born after the first sampled commit: Kaplan-Meier median survival in days, share of endings with every named file still in place). Rate ratio against the unflagged cross-layer baseline.', '',
    '| rule | tier | exposures (edge-shaped) | FIXED-BY-DEV | rate [Wilson 95%] | RR vs baseline [95%] | introduced | other causes | lineages (ended) | KM median days | ended in place | fix commits with arch words |', '|---|---|---:|---:|---|---|---:|---|---:|---:|---|---|');
  const ruleRows: unknown[] = [];
  for (const [rule, r] of [...rules].sort((x, y) => (x[1].tier === y[1].tier ? x[0].localeCompare(y[0]) : x[1].tier === 'blocking' ? -1 : 1))) {
    const w = wilson(r.fixed, r.edgeExposed);
    const rr = r.edgeExposed > 0 ? rateRatio(r.fixed, r.edgeExposed, base.fixed, base.exposed) : undefined;
    const baseRule = rule.split(' ')[0] ?? rule;
    const sv = survBy((l) => l.kind === 'finding' && l.functionId === baseRule && (baseRule !== 'FF-S03' || l.tier === r.tier));
    const km = kaplanMeier(sv.obs);
    const other = Object.entries(r.causes).filter(([c]) => c !== FIX).map(([c, n]) => `${c.toLowerCase()} ${String(n)}`).join(', ');
    lines.push(`| ${rule} | ${r.tier} | ${String(r.exposed)} (${String(r.edgeExposed)}) | ${String(r.fixed)} | ${r.edgeExposed > 0 ? ci(w) : 'file-level'} | ${rr !== undefined ? `${num(rr.p)} [${num(rr.lo)}, ${num(rr.hi)}]` : '—'} | ${String(r.introduced)} | ${other || '—'} | ${String(km.n)} (${String(km.events)}) | ${km.median !== null ? String(Math.round(km.median)) : '> obs.'} | ${sv.ended > 0 ? pct(sv.inPlace / sv.ended) : 'n/a'} | ${String(r.archCommits.size)} / ${String(r.fixCommits.size)} |`);
    ruleRows.push({ rule, tier: r.tier, exposed: r.exposed, edgeExposed: r.edgeExposed, fixed: r.fixed, rate: w, rateRatio: rr, introduced: r.introduced, causes: r.causes, km, endedInPlace: sv.ended > 0 ? sv.inPlace / sv.ended : null, fixCommits: r.fixCommits.size, archCommits: r.archCommits.size });
  }
  summary.perRule = ruleRows;
  lines.push('');

  // ── Survival by group ──
  lines.push('## Survival (grid level)', '', '| group | lineages | ended | KM median days | S(365 d) | ended with files in place |', '|---|---:|---:|---:|---:|---|');
  const survRows: unknown[] = [];
  const sg: [string, (l: Lineage) => boolean][] = [
    ['blocking, edge-shaped findings', (l) => l.kind === 'finding' && l.tier === 'blocking' && l.edgeShaped === true],
    ['advisory, edge-shaped findings', (l) => l.kind === 'finding' && l.tier === 'advisory' && l.edgeShaped === true],
    ['advisory, file-level findings', (l) => l.kind === 'finding' && l.tier === 'advisory' && l.edgeShaped !== true],
    ['unflagged cross-layer import edges', (l) => l.kind === 'edge' && l.edgeKind === 'crossLayer'],
    ['unflagged same-layer import edges', (l) => l.kind === 'edge' && l.edgeKind === 'layered'],
    ['unflagged import edges, unlayered file', (l) => l.kind === 'edge' && l.edgeKind === 'other'],
  ];
  for (const [name, pick] of sg) {
    const s = survBy(pick);
    const km = kaplanMeier(s.obs);
    lines.push(`| ${name} | ${String(km.n)} | ${String(km.events)} | ${km.median !== null ? String(Math.round(km.median)) : '> obs.'} | ${num(km.s365, 3)} | ${s.ended > 0 ? pct(s.inPlace / s.ended) : 'n/a'} |`);
    survRows.push({ group: name, km, endedInPlace: s.ended > 0 ? s.inPlace / s.ended : null, medianObservedDays: median(s.obs.map((o) => o.t)) });
  }
  summary.survival = survRows;
  lines.push('');

  // ── Examples: blocking FIXED-BY-DEV commits, spread over repositories and rules ──
  interface Ex { id: string; repo: string; sha: string; rule: string; file: string; target: string; message: string; arch: boolean; date: string }
  const pool: Ex[] = [];
  for (const e of have) {
    const seen = new Set<string>();
    for (const p of pairsBy.get(e.id) ?? []) {
      if (!p.parentOk || !p.childOk) continue;
      const trunc = (p.exposedByRule['FF-S02'] ?? 0) >= S02_CAP || (p.childByRule['FF-S02'] ?? 0) >= S02_CAP;
      for (const f of p.disappeared) {
        if (f.tier !== 'blocking' || f.cause !== FIX || (f.functionId === 'FF-S02' && trunc) || seen.has(p.sha)) continue;
        seen.add(p.sha);
        pool.push({ id: e.id, repo: e.repo, sha: p.sha, rule: f.functionId, file: f.filePath, target: f.target ?? '', message: shownMessage(p.message), arch: mentionsArchitecture(p.message), date: p.date.slice(0, 10) });
      }
    }
  }
  const picked: Ex[] = [];
  const byRepo = new Map<string, Ex[]>();
  for (const x of pool) byRepo.set(x.id, [...(byRepo.get(x.id) ?? []), x]);
  // Round-robin over repositories, preferring an unseen rule in each round.
  const usedRules = new Set<string>();
  while (picked.length < 20 && [...byRepo.values()].some((l) => l.length > 0)) {
    for (const [, l] of byRepo) {
      if (picked.length >= 20 || l.length === 0) continue;
      const i = Math.max(0, l.findIndex((x) => !usedRules.has(x.rule)));
      const [x] = l.splice(i, 1);
      if (x !== undefined) { picked.push(x); usedRules.add(x.rule); }
    }
  }
  lines.push('## Example fix commits (blocking tier, FIXED-BY-DEV)', '', `${String(pool.length)} distinct commits in the pool; 20 shown, round-robin over repositories.`, '',
    '| # | repository | commit | date | rule | finding (file -> target) | commit message | arch words |', '|---:|---|---|---|---|---|---|---|');
  picked.forEach((x, i) => {
    const tgt = x.rule === 'FF-S02' ? `cycle ${x.file.split(',').length - 1} files` : x.target;
    lines.push(`| ${String(i + 1)} | ${x.repo} | [${x.sha.slice(0, 10)}](https://github.com/${x.repo}/commit/${x.sha}) | ${x.date} | ${x.rule} | \`${x.rule === 'FF-S02' ? (x.file.split(',')[0] ?? '') : x.file}\` -> \`${tgt}\` | ${x.message} | ${x.arch ? 'yes' : 'no'} |`);
  });
  summary.examples = picked;
  summary.examplePool = pool.length;
  lines.push('');

  fs.writeFileSync(path.join(OUT, 'tables.md'), `${lines.join('\n')}\n`);
  fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
  process.stdout.write(`${String(have.length)} repositories aggregated -> results/v1.3-fixes-mined/{summary.json,tables.md}\n`);
}

main();
