/**
 * v1.3 APG v2 from developer behaviour: aggregate the walks (`scripts/v1.3/apg2-fixes-mined-run.ts`) into the
 * statistics and tables of Docs/DiagnosticRuns/v1.3-apg2-fixes-mined-2026-10-16.md. Entry file: no exports.
 *
 * Usage (repository root): node --import tsx scripts/v1.3/apg2-fixes-mined-report.ts
 * Reads results/v1.3-fixes-mined/corpus.json and results/v1.3-apg2-fixes-mined/repos/<id>/*; writes
 * results/v1.3-apg2-fixes-mined/{summary.json, tables.md}.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import {
  clusterBootstrap, cohenH, kaplanMeier, mentionsArchitecture, rateRatio, sampleWithout, seededRandom, signTest, wilson,
  type Interval, type SurvivalObs,
} from './lib/fixes-mined.js';
import { CREDITED, importGraphInvisible, type ItemCause } from './lib/apg2-fixes-mined.js';
import { APG2_TEMPLATE_TIERS } from '../../src/fitness-compiler/apg2-templates.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-apg2-fixes-mined');
const readGz = <T>(p: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8')) as T;

interface CorpusEntry { id: string; repo: string; url: string; sha: string; style: string; source: string }
interface Exposure { exposed: number; touched: number; causes: Record<string, number>; causesTouched: Record<string, number> }
interface PairItem { key: string; family: 'apg2' | 'cheap'; rule: string; tier: string; shape: string; importGraphSees: boolean | null; cause: ItemCause; memberStays?: boolean; touched: boolean; files: string[]; line?: number; message: string }
interface PairRecord {
  sha: string; parent: string; date: string; author: string; bot: boolean; mass: boolean; changed: number; message: string;
  parentOk: boolean; childOk: boolean; exposure: Record<string, Exposure>; disappeared: PairItem[]; introduced: number;
  baseline: Record<'all' | 'layered' | 'crossLayer' | 'pkg', Exposure>;
}
interface Lineage { kind: 'item' | 'edge'; rule?: string; vis?: string; edgeKind?: string; born: number; ended: number | null; filesStay?: boolean }
interface Walk { id: string; url: string; firstParentCommitsTouchingRoot: number; sampled: number; snapshotsEvaluated: number; snapshotErrors: number; msMedian: number | null; wallSeconds: number; atLastSample: { files: number; items: number; byRule: Record<string, number> } | null }

const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(x < 0.001 && x > 0 ? 3 : 2)}%` : 'n/a');
const ci = (w: Interval): string => (Number.isFinite(w.p) ? `${pct(w.p)} [${pct(w.lo)}, ${pct(w.hi)}]` : 'n/a');
const num = (x: number, d = 2): string => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const rr = (w: Interval): string => (Number.isFinite(w.p) ? `${num(w.p)} [${num(w.lo)}, ${num(w.hi)}]` : 'n/a');
const days = (a: string, b: string): number => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const cell = (s: string): string => s.replace(/\|/g, '/').replace(/\n/g, ' ');
const subject = (m: string): string => cell((m.split('\n')[0] ?? '').slice(0, 100));
const shownMessage = (m: string): string => {
  const lines = m.split('\n').map((l) => l.trim()).filter(Boolean);
  const s = lines[0] ?? '';
  return (s.startsWith('Merge pull request') || s.startsWith('Merge branch')) && lines[1] !== undefined ? `${subject(s)} — ${subject(lines[1])}` : subject(s);
};
const isCredited = (c: string): boolean => CREDITED.has(c as ItemCause);
const sumCredited = (causes: Record<string, number>): number => Object.entries(causes).reduce((s, [c, n]) => s + (isCredited(c) ? n : 0), 0);

/** A group's counts in one repository. */
interface Counter {
  exposed: number; credited: number; touched: number; creditedTouched: number;
  causes: Record<string, number>;
  /** Credited removals per commit. */
  commits: Map<string, number>;
}
const counter = (): Counter => ({ exposed: 0, credited: 0, touched: 0, creditedTouched: 0, causes: {}, commits: new Map() });

type GroupPred = (rule: string, vis: string) => boolean;
const tierOf = (rule: string): 'blocking' | 'advisory' => APG2_TEMPLATE_TIERS.get(rule)?.tier ?? 'advisory';
const isApg2 = (rule: string): boolean => APG2_TEMPLATE_TIERS.has(rule);
const visBool = (vis: string): boolean | null => (vis === 'na' ? null : vis === 'seen');
const invisible = (rule: string, vis: string): boolean => importGraphInvisible(rule, visBool(vis));

const ITEM_GROUPS: [string, GroupPred][] = [
  ['APG v2, blocking-tier templates', (r) => isApg2(r) && tierOf(r) === 'blocking'],
  ['APG v2, advisory-tier templates', (r) => isApg2(r) && tierOf(r) === 'advisory'],
  ['cheap proxies (all advisory)', (r) => !isApg2(r)],
  ['APG v2, import-graph-invisible', (r, v) => isApg2(r) && invisible(r, v)],
  ['APG v2, import-graph-visible', (r, v) => isApg2(r) && !invisible(r, v)],
  ['proxies, import-graph-invisible', (r, v) => !isApg2(r) && invisible(r, v)],
  ['proxies, import-graph-visible', (r, v) => !isApg2(r) && !invisible(r, v)],
  ['all import-graph-invisible items', (r, v) => invisible(r, v)],
];
const BASES = ['crossLayer', 'layered', 'all', 'pkg'] as const;
const BASE_LABEL: Record<(typeof BASES)[number], string> = {
  crossLayer: 'baseline (a): unflagged cross-layer import edges',
  layered: 'baseline (a): unflagged layered import edges',
  all: 'baseline (a): all unflagged internal import edges',
  pkg: 'baseline (b): file -> package imports',
};

interface RepoAgg {
  id: string; validPairs: number; botPairs: number; massPairs: number; allCommits: number; allArch: number;
  rules: Map<string, Counter>; ruleVis: Map<string, Counter>; groups: Map<string, Counter>; base: Map<string, Counter>;
  memberStay: Map<string, { stays: number; gone: number }>;
  messages: Map<string, string>;
}

function add(c: Counter, ex: Exposure): void {
  c.exposed += ex.exposed;
  c.touched += ex.touched;
  c.credited += sumCredited(ex.causes);
  c.creditedTouched += sumCredited(ex.causesTouched);
  for (const [k, n] of Object.entries(ex.causes)) c.causes[k] = (c.causes[k] ?? 0) + n;
}
const bump = (m: Map<string, number>, k: string, n = 1): void => { m.set(k, (m.get(k) ?? 0) + n); };

function aggregateRepo(id: string, pairs: readonly PairRecord[]): RepoAgg {
  const a: RepoAgg = { id, validPairs: 0, botPairs: 0, massPairs: 0, allCommits: 0, allArch: 0, rules: new Map(), ruleVis: new Map(), groups: new Map(), base: new Map(), memberStay: new Map(), messages: new Map() };
  const get = (m: Map<string, Counter>, k: string): Counter => { let c = m.get(k); if (c === undefined) { c = counter(); m.set(k, c); } return c; };
  for (const p of pairs) {
    if (!p.parentOk || !p.childOk) continue;
    a.validPairs++;
    if (p.bot) a.botPairs++;
    if (p.mass) a.massPairs++;
    if (!p.bot) { a.allCommits++; if (mentionsArchitecture(p.message)) a.allArch++; }
    a.messages.set(p.sha, p.message);
    for (const [k, ex] of Object.entries(p.exposure)) {
      const i = k.lastIndexOf('|');
      const rule = k.slice(0, i);
      const vis = k.slice(i + 1);
      add(get(a.rules, rule), ex);
      add(get(a.ruleVis, k), ex);
      for (const [g, pred] of ITEM_GROUPS) if (pred(rule, vis)) add(get(a.groups, g), ex);
    }
    for (const d of p.disappeared) {
      if (!isCredited(d.cause)) continue;
      const vis = d.importGraphSees === null ? 'na' : d.importGraphSees ? 'seen' : 'invisible';
      bump(get(a.rules, d.rule).commits, p.sha);
      bump(get(a.ruleVis, `${d.rule}|${vis}`).commits, p.sha);
      for (const [g, pred] of ITEM_GROUPS) if (pred(d.rule, vis)) bump(get(a.groups, g).commits, p.sha);
      if (d.memberStays !== undefined) {
        const m = a.memberStay.get(d.rule) ?? { stays: 0, gone: 0 };
        if (d.memberStays) m.stays++; else m.gone++;
        a.memberStay.set(d.rule, m);
      }
    }
    for (const b of BASES) {
      const ex = p.baseline[b];
      const c = get(a.base, b);
      c.exposed += ex.exposed;
      c.touched += ex.touched;
      const fx = ex.causes['FIXED-BY-DEV'] ?? 0;
      c.credited += fx;
      c.creditedTouched += ex.causesTouched['FIXED-BY-DEV'] ?? 0;
      for (const [k, n] of Object.entries(ex.causes)) c.causes[k] = (c.causes[k] ?? 0) + n;
      if (fx > 0) bump(c.commits, p.sha, fx);
    }
  }
  return a;
}

interface Pooled { exposed: number; credited: number; touched: number; creditedTouched: number; causes: Record<string, number>; commits: Map<string, number> }
function pool(cs: readonly (Counter | undefined)[]): Pooled {
  const out: Pooled = { exposed: 0, credited: 0, touched: 0, creditedTouched: 0, causes: {}, commits: new Map() };
  for (const c of cs) {
    if (c === undefined) continue;
    out.exposed += c.exposed; out.credited += c.credited; out.touched += c.touched; out.creditedTouched += c.creditedTouched;
    for (const [k, n] of Object.entries(c.causes)) out.causes[k] = (out.causes[k] ?? 0) + n;
    for (const [k, n] of c.commits) bump(out.commits, k, n);
  }
  return out;
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
      obs.push({ t: Math.max(0, days(b, grid[l.ended]?.date ?? last)), event: true });
      ended++;
      if (l.filesStay === true) inPlace++;
    } else obs.push({ t: Math.max(0, days(b, last)), event: false });
  }
  return { obs, inPlace, ended };
}

function main(): void {
  const corpus = (JSON.parse(fs.readFileSync(path.join(REPO, 'results/v1.3-fixes-mined/corpus.json'), 'utf8')) as { entries: CorpusEntry[] }).entries;
  const have = corpus.filter((e) => fs.existsSync(path.join(OUT, 'repos', e.id, 'walk.json')));
  const walkBy = new Map<string, Walk>();
  const pairsBy = new Map<string, PairRecord[]>();
  const linBy = new Map<string, { grid: { sha: string; date: string }[]; lineages: Lineage[] }>();
  for (const e of have) {
    const dir = path.join(OUT, 'repos', e.id);
    walkBy.set(e.id, JSON.parse(fs.readFileSync(path.join(dir, 'walk.json'), 'utf8')) as Walk);
    pairsBy.set(e.id, readGz<PairRecord[]>(path.join(dir, 'pairs.json.gz')));
    linBy.set(e.id, readGz(path.join(dir, 'lineages.json.gz')));
  }
  const aggs = have.map((e) => aggregateRepo(e.id, pairsBy.get(e.id) ?? []));
  const urlOf = new Map(have.map((e) => [e.id, e.url.replace(/\.git$/, '')]));
  const rnd = seededRandom(20261016);
  const lines: string[] = [];
  const summary: Record<string, unknown> = { generated: new Date().toISOString(), repos: have.length };

  const allCommits = aggs.reduce((s, a) => s + a.allCommits, 0);
  const allArch = aggs.reduce((s, a) => s + a.allArch, 0);
  const archBase = wilson(allArch, allCommits);
  const msgOf = (sha: string): string => { for (const a of aggs) { const m = a.messages.get(sha); if (m !== undefined) return m; } return ''; };

  // ── Corpus table ──
  lines.push('## Corpus walked', '', '| id | commits on path | sampled | valid pairs | bot / mass pairs | files (last) | items (last) | snapshots | errors | median s/snapshot | wall s |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const a of aggs) {
    const w = walkBy.get(a.id);
    if (w === undefined) continue;
    lines.push(`| ${a.id} | ${String(w.firstParentCommitsTouchingRoot)} | ${String(w.sampled)} | ${String(a.validPairs)} | ${String(a.botPairs)} / ${String(a.massPairs)} | ${String(w.atLastSample?.files ?? 0)} | ${String(w.atLastSample?.items ?? 0)} | ${String(w.snapshotsEvaluated)} | ${String(w.snapshotErrors)} | ${w.msMedian !== null ? num(w.msMedian / 1000, 1) : 'n/a'} | ${String(w.wallSeconds)} |`);
  }
  lines.push('', `Valid pairs: ${String(aggs.reduce((s, a) => s + a.validPairs, 0))}. Non-bot valid commits: ${String(allCommits)}; with architecture words: ${String(allArch)} = ${ci(archBase)}.`, '');

  // ── Rate table helper ──
  const baseAll = new Map(BASES.map((b) => [b, pool(aggs.map((a) => a.base.get(b)))]));
  const cross = baseAll.get('crossLayer') as Pooled;
  const pkg = baseAll.get('pkg') as Pooled;
  const ratioStat = (sel: (a: RepoAgg) => Counter | undefined, base: (typeof BASES)[number]) => (cs: readonly RepoAgg[]): number => {
    const n = pool(cs.map(sel));
    const d = pool(cs.map((a) => a.base.get(base)));
    return n.exposed > 0 && d.exposed > 0 && d.credited > 0 ? (n.credited / n.exposed) / (d.credited / d.exposed) : Number.NaN;
  };
  const archOf = (commits: Map<string, number>): { k: number; n: number } => {
    let k = 0;
    for (const sha of commits.keys()) if (mentionsArchitecture(msgOf(sha))) k++;
    return { k, n: commits.size };
  };
  const rowStats = (label: string, P: Pooled, sel: (a: RepoAgg) => Counter | undefined): Record<string, unknown> => {
    const w = wilson(P.credited, P.exposed);
    const vsCross = rateRatio(P.credited, P.exposed, cross.credited, cross.exposed);
    const vsPkg = rateRatio(P.credited, P.exposed, pkg.credited, pkg.exposed);
    const bootCross = clusterBootstrap(aggs, ratioStat(sel, 'crossLayer'), 2000, rnd);
    const bootPkg = clusterBootstrap(aggs, ratioStat(sel, 'pkg'), 2000, rnd);
    const top = [...P.commits.entries()].sort((x, y) => y[1] - x[1])[0];
    const withoutTop = top !== undefined ? rateRatio(P.credited - top[1], P.exposed, cross.credited, cross.exposed) : vsCross;
    const perCommit = rateRatio(P.commits.size, P.exposed, cross.commits.size, cross.exposed);
    const wt = wilson(P.creditedTouched, P.touched);
    const touchedVsCross = rateRatio(P.creditedTouched, P.touched, cross.creditedTouched, cross.touched);
    const touchedVsPkg = rateRatio(P.creditedTouched, P.touched, pkg.creditedTouched, pkg.touched);
    const arch = archOf(P.commits);
    // Per-repository sign test against the cross-layer baseline (repos with exposure on both sides, not tied).
    let pos = 0;
    let nn = 0;
    for (const a of aggs) {
      const c = sel(a);
      const b = a.base.get('crossLayer');
      if (c === undefined || b === undefined || c.exposed === 0 || b.exposed === 0) continue;
      const x = c.credited / c.exposed;
      const y = b.credited / b.exposed;
      if (x === y) continue;
      nn++;
      if (x > y) pos++;
    }
    return {
      label, exposed: P.exposed, credited: P.credited, rate: w, vsCross, bootCross, vsPkg, bootPkg,
      cohenHCross: cohenH(w.p, cross.credited / Math.max(1, cross.exposed)), cohenHPkg: cohenH(w.p, pkg.credited / Math.max(1, pkg.exposed)),
      fixCommits: P.commits.size, topCommit: top !== undefined ? { sha: top[0], credits: top[1] } : null, withoutTop, perCommit,
      touched: P.touched, creditedTouched: P.creditedTouched, rateTouched: wt, touchedVsCross, touchedVsPkg,
      arch, archRate: wilson(arch.k, arch.n), sign: { pos, n: nn, p: signTest(pos, nn) }, causes: P.causes,
    };
  };
  const rateHeader = ['| group | exposures | credited | rate [Wilson 95%] | vs (a) cross-layer: RR [95%] | repo-boot 95% | vs (b) pkg: RR [95%] | repo-boot 95% | h (a) / h (b) | fix commits | RR without top commit | RR one credit per commit | repos above (a) | arch words in fix commits |',
    '|---|---:|---:|---|---|---|---|---|---|---:|---|---|---|---|'];
  const rateRow = (s: Record<string, unknown>): string => {
    const x = s as { label: string; exposed: number; credited: number; rate: Interval; vsCross: Interval; bootCross: { lo: number; hi: number }; vsPkg: Interval; bootPkg: { lo: number; hi: number }; cohenHCross: number; cohenHPkg: number; fixCommits: number; withoutTop: Interval; perCommit: Interval; sign: { pos: number; n: number; p: number }; arch: { k: number; n: number }; archRate: Interval };
    return `| ${x.label} | ${String(x.exposed)} | ${String(x.credited)} | ${ci(x.rate)} | ${rr(x.vsCross)} | [${num(x.bootCross.lo)}, ${num(x.bootCross.hi)}] | ${rr(x.vsPkg)} | [${num(x.bootPkg.lo)}, ${num(x.bootPkg.hi)}] | ${num(x.cohenHCross, 3)} / ${num(x.cohenHPkg, 3)} | ${String(x.fixCommits)} | ${rr(x.withoutTop)} | ${rr(x.perCommit)} | ${String(x.sign.pos)}/${String(x.sign.n)} (p=${num(x.sign.p, 3)}) | ${String(x.arch.k)}/${String(x.arch.n)} (${ci(x.archRate)}) |`;
  };
  const touchedHeader = ['| group | exposures in touched pairs | credited | rate [Wilson 95%] | vs (a) cross-layer touched: RR [95%] | vs (b) pkg touched: RR [95%] |', '|---|---:|---:|---|---|---|'];
  const touchedRow = (s: Record<string, unknown>): string => {
    const x = s as { label: string; touched: number; creditedTouched: number; rateTouched: Interval; touchedVsCross: Interval; touchedVsPkg: Interval };
    return `| ${x.label} | ${String(x.touched)} | ${String(x.creditedTouched)} | ${ci(x.rateTouched)} | ${rr(x.touchedVsCross)} | ${rr(x.touchedVsPkg)} |`;
  };

  // ── Groups ──
  const groupStats = ITEM_GROUPS.map(([g]) => rowStats(g, pool(aggs.map((a) => a.groups.get(g))), (a) => a.groups.get(g)));
  const baseStats = BASES.map((b) => rowStats(BASE_LABEL[b], baseAll.get(b) as Pooled, (a) => a.base.get(b)));
  summary.groups = groupStats;
  summary.baselines = baseStats;
  lines.push('## Fix rates by group', '', 'Exposure = an item (or baseline edge) present at the parent of a valid sampled pair. Credited = FIXED-BY-DEV (edge, component dependency) or RESOLVED-IN-PLACE (member, pair, file, metric); baselines: FIXED-BY-DEV only.', '', ...rateHeader);
  for (const s of [...groupStats, ...baseStats]) lines.push(rateRow(s));
  lines.push('', '### Touched pairs only', '', 'Exposures restricted to pairs whose commit touched a file the item (edge, package import) names.', '', ...touchedHeader);
  for (const s of [...groupStats, ...baseStats]) lines.push(touchedRow(s));
  lines.push('');

  // ── Per rule ──
  const ruleNames = [...new Set(aggs.flatMap((a) => [...a.rules.keys()]))].sort((x, y) => Number(isApg2(y)) - Number(isApg2(x)) || x.localeCompare(y));
  const ruleStats = ruleNames.map((r) => rowStats(`${r}${isApg2(r) ? ` (${tierOf(r)})` : ''}`, pool(aggs.map((a) => a.rules.get(r))), (a) => a.rules.get(r)));
  summary.rules = ruleStats;
  lines.push('## Fix rates by template and proxy', '', ...rateHeader);
  for (const s of ruleStats) lines.push(rateRow(s));
  lines.push('', '### Touched pairs only', '', ...touchedHeader);
  for (const s of ruleStats) lines.push(touchedRow(s));
  lines.push('');

  // ── Invisible vs visible within a rule ──
  const visRows: string[] = [];
  const visSummary: unknown[] = [];
  for (const r of ruleNames) {
    const seen = pool(aggs.map((a) => a.ruleVis.get(`${r}|seen`)));
    const inv = pool(aggs.map((a) => a.ruleVis.get(`${r}|invisible`)));
    if (seen.exposed === 0 || inv.exposed === 0) continue;
    const w1 = wilson(inv.credited, inv.exposed);
    const w0 = wilson(seen.credited, seen.exposed);
    const ratio = rateRatio(inv.credited, inv.exposed, seen.credited, seen.exposed);
    visSummary.push({ rule: r, invisible: { exposed: inv.exposed, credited: inv.credited, rate: w1 }, seen: { exposed: seen.exposed, credited: seen.credited, rate: w0 }, ratio });
    visRows.push(`| ${r} | ${String(inv.exposed)} | ${String(inv.credited)} | ${ci(w1)} | ${String(seen.exposed)} | ${String(seen.credited)} | ${ci(w0)} | ${rr(ratio)} |`);
  }
  summary.invisibleVsSeen = visSummary;
  lines.push('## Within a rule: import-graph-invisible vs visible items', '', '| rule | invisible exposures | credited | rate | visible exposures | credited | rate | RR invisible / visible |', '|---|---:|---:|---|---:|---:|---|---|', ...visRows, '');

  // ── Member stays ──
  const ms = new Map<string, { stays: number; gone: number }>();
  for (const a of aggs) for (const [r, v] of a.memberStay) { const m = ms.get(r) ?? { stays: 0, gone: 0 }; m.stays += v.stays; m.gone += v.gone; ms.set(r, m); }
  summary.memberStays = Object.fromEntries(ms);
  lines.push('## Member-level credited removals: was the member itself kept?', '', '| rule | member still declared | member gone (deleted or renamed in place) |', '|---|---:|---:|');
  for (const [r, v] of [...ms].sort()) if (isApg2(r) || v.stays + v.gone >= 20) lines.push(`| ${r} | ${String(v.stays)} | ${String(v.gone)} |`);
  lines.push('');

  // ── Survival ──
  const kmRows: string[] = [];
  const kmSummary: Record<string, unknown> = {};
  const survGroups: [string, (l: Lineage) => boolean][] = [
    ...ITEM_GROUPS.map(([g, pred]) => [g, (l: Lineage) => l.kind === 'item' && pred(l.rule ?? '', l.vis ?? 'na')] as [string, (l: Lineage) => boolean]),
    ...ruleNames.filter(isApg2).map((r) => [r, (l: Lineage) => l.kind === 'item' && l.rule === r] as [string, (l: Lineage) => boolean]),
    ['unflagged cross-layer import edges', (l) => l.kind === 'edge' && l.edgeKind === 'crossLayer'],
    ['unflagged layered import edges', (l) => l.kind === 'edge' && (l.edgeKind === 'crossLayer' || l.edgeKind === 'layered')],
    ['all unflagged import edges', (l) => l.kind === 'edge'],
  ];
  for (const [g, pick] of survGroups) {
    const obs: SurvivalObs[] = [];
    let inPlace = 0;
    let ended = 0;
    for (const [, L] of linBy) { const s = survival(L.lineages, L.grid, pick); obs.push(...s.obs); inPlace += s.inPlace; ended += s.ended; }
    const km = kaplanMeier(obs);
    kmSummary[g] = { ...km, inPlace, ended };
    kmRows.push(`| ${g} | ${String(km.n)} | ${String(km.events)} | ${km.median !== null ? num(km.median, 0) : '> window'} | ${num(km.s365, 3)} | ${ended > 0 ? pct(inPlace / ended) : 'n/a'} |`);
  }
  summary.survival = kmSummary;
  lines.push('## Survival (grid lineages, left-censored excluded)', '', '| group | lineages | ended | KM median days | S(365 d) | ends with files in place |', '|---|---:|---:|---|---|---|', ...kmRows, '');

  // ── Examples ──
  interface Ex { id: string; sha: string; date: string; message: string; item: PairItem; inv: boolean }
  const pool2: Ex[] = [];
  for (const [id, ps] of pairsBy) for (const p of ps) {
    if (!p.parentOk || !p.childOk || p.bot || p.mass) continue;
    for (const d of p.disappeared) if (isCredited(d.cause)) pool2.push({ id, sha: p.sha, date: p.date, message: p.message, item: d, inv: importGraphInvisible(d.rule, d.importGraphSees) });
  }
  // One example per (rule, commit); a seeded draw that first covers every APG v2 template, then invisible proxy kinds.
  const exRnd = seededRandom(20261016);
  const picked: Ex[] = [];
  const usedCommit = new Set<string>();
  const byRule = new Map<string, Ex[]>();
  for (const x of pool2) { const l = byRule.get(x.item.rule) ?? []; l.push(x); byRule.set(x.item.rule, l); }
  const order = [...byRule.keys()].sort((x, y) => Number(isApg2(y)) - Number(isApg2(x)) || x.localeCompare(y));
  const take = (rule: string, preferInv: boolean): void => {
    const cands = (byRule.get(rule) ?? []).filter((x) => !usedCommit.has(x.sha) && (!preferInv || x.inv));
    const [x] = sampleWithout(cands, 1, exRnd);
    if (x !== undefined) { picked.push(x); usedCommit.add(x.sha); }
  };
  for (const r of order) if (picked.length < 15 && isApg2(r)) take(r, true);
  for (const r of order) if (picked.length < 15 && isApg2(r) && !picked.some((p) => p.item.rule === r)) take(r, false);
  for (const r of order) if (picked.length < 15 && !isApg2(r)) take(r, true);
  for (let i = 0; picked.length < 15 && i < 200; i++) { const [x] = sampleWithout(pool2.filter((y) => !usedCommit.has(y.sha)), 1, exRnd); if (x === undefined) break; picked.push(x); usedCommit.add(x.sha); }
  summary.examples = picked.map((x) => ({ id: x.id, sha: x.sha, url: `${urlOf.get(x.id) ?? ''}/commit/${x.sha}`, rule: x.item.rule, cause: x.item.cause, invisible: x.inv, message: x.item.message, files: x.item.files, subject: shownMessage(x.message) }));
  lines.push('## Example fix commits (seeded draw)', '', '| # | repository | commit | rule | import-graph | item | commit message |', '|---|---|---|---|---|---|---|');
  picked.forEach((x, i) => {
    lines.push(`| ${String(i + 1)} | ${x.id} | [${x.sha.slice(0, 10)}](${urlOf.get(x.id) ?? ''}/commit/${x.sha}) | ${x.item.rule} | ${x.inv ? 'invisible' : 'visible'} | ${cell(x.item.message.slice(0, 140))} (\`${cell(x.item.files.join(' -> '))}\`) | ${shownMessage(x.message)} |`);
  });
  lines.push('');

  summary.archBase = { k: allArch, n: allCommits, rate: archBase };
  summary.creditedPoolSize = pool2.length;
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, (_k, v: unknown) => (v instanceof Map ? Object.fromEntries(v) : v), 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'tables.md'), `${lines.join('\n')}\n`);
  process.stdout.write(`${String(have.length)} repositories; tables.md and summary.json written\n`);
}

main();
