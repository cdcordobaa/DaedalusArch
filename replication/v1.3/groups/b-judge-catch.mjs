// Judge catch rounds 1, 2 and DUP-RULE v2 (+ the frozen-operator hashes): scores replayed from the committed cassettes
// by the committed scorers, counts re-derived from the committed plans, ledgers, reports, manifests and cassettes, the
// round-1 seeding regenerated, the FF-P01 repro re-run at HEAD, hashes recomputed with `git show <commit>:<path>`.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { treeAt } from '../lib/at-commit.mjs';

// ---- shared helpers (also imported by b-judge-v2.mjs) ---------------------------------------------------------------
export const RC = 'results/v1.3-judge-catch';
const CAS = 'tests/fixtures/judge-cassettes-v13';
export const ROUND = {
  r1: { res: RC, cas: `${CAS}/judge-catch` },
  r2: { res: `${RC}/round2`, cas: `${CAS}/judge-catch-round2` },
  dv2: { res: `${RC}/duprule-v2`, cas: `${CAS}/judge-catch-duprule-v2` },
};
const D1 = 'Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md';
const D2 = 'Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md';
const D3 = 'Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md';
const DF = 'Docs/v1.3/judge-catch-frozen.md';

const memo = new Map();
export const once = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };
export const sha = (s) => createHash('sha256').update(s).digest('hex');
export const T = (x) => (typeof x === 'string' ? x : x.text);           // rate object or text
export const short = (x) => T(x).split(' = ')[0];                         // "k/n"
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
export const word = (k) => WORDS[k] ?? String(k);
export const Word = (k) => word(k).charAt(0).toUpperCase() + word(k).slice(1);
const tsx = 'node --import tsx';

export function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
/** Cassette entries of a judge-catch round (skip _incomplete), sorted by recordedAt like the scorers do. */
export function entries(ctx, round) {
  return once(`ent:${round}`, () => {
    const dir = ctx.p(ROUND[round].cas);
    const out = [];
    for (const sub of readdirSync(dir)) {
      const p = join(dir, sub);
      if (sub === '_incomplete' || !statSync(p).isDirectory()) continue;
      for (const f of readdirSync(p).filter((x) => x.endsWith('.json'))) out.push(JSON.parse(readFileSync(join(p, f), 'utf8')));
    }
    return out.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
  });
}
/** target id -> its cassette entries (ledger time windows, as judge-catch-score.ts maps them). */
export function entriesOf(ctx, round) {
  return once(`entOf:${round}`, () => {
    const ledger = ctx.json(`${ROUND[round].res}/call-ledger.json`);
    const es = entries(ctx, round);
    const m = new Map(); let prev = '';
    for (const r of ledger.runs) { m.set(r.id, [...(m.get(r.id) ?? []), ...es.filter((e) => e.recordedAt > prev && e.recordedAt <= r.at)]); prev = r.at; }
    return m;
  });
}
const safe = (id) => id.replace(/[/:]/g, '__');
/** The valid cassette runs of one judged unit of one target. */
export const runsFor = (ctx, round, id, fn, unit) => (entriesOf(ctx, round).get(id) ?? []).filter((e) => e.functionId === fn && e.unitId === unit && e.outcome.kind === 'valid' && e.parsedVerdict);
const textOf = (e) => [e.parsedVerdict.reasoning, ...(e.parsedVerdict.violations ?? []).map((v) => v.message)].join(' ');
export const report = (ctx, round, id) => { const f = `${ROUND[round].res}/reports/${safe(id)}.json`; return ctx.exists(f) ? ctx.json(f) : null; };
export const plan = (ctx, round) => ctx.json(`${ROUND[round].res}/plan.json`);
export const manifest = (ctx, round) => once(`man:${round}`, () => ctx.json(`${ROUND[round].res}/seed-manifest.json`));

/** Runs the three committed scorers on a scratch copy of results/v1.3-judge-catch (cassette replay, no model). */
export function scored(ctx) {
  return once('scored', () => {
    const dir = ctx.out('b-judge-catch-scores');
    cpSync(ctx.p(RC), dir, { recursive: true });
    ctx.sh(`${tsx} scripts/v1.3/judge-catch-score.ts --results "${dir}"`);
    ctx.sh(`${tsx} scripts/v1.3/judge-catch2-score.ts --results "${dir}/round2" --round1 "${dir}"`);
    ctx.sh(`${tsx} scripts/v1.3/judge-catch-v2-score.ts --results "${dir}/duprule-v2"`);
    const j = (r) => JSON.parse(readFileSync(join(dir, r, 'scores.json'), 'utf8'));
    // rounds 2 and DUP v2: every rate {k, n, ..., text} -> its text
    const flat = (o) => (Array.isArray(o) ? o.map(flat) : o && typeof o === 'object' ? ('text' in o && 'k' in o ? o.text : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, flat(v)]))) : o);
    return { r1: j(''), r2: flat(j('round2')), dv2: flat(j('duprule-v2')), dir };
  });
}

/** Offline part of `replay`: per target, every judged unit's report verdict = cassette majority and confidence = mean of
 * the majority side. Returns "ok/targets". */
export function voteReplay(ctx, round) {
  const eo = entriesOf(ctx, round);
  const ts = plan(ctx, round).targets;
  let ok = 0;
  for (const t of ts) {
    const rep = report(ctx, round, t.id);
    let good = rep !== null;
    for (const [fn, units] of Object.entries(t.units)) {
      for (const u of units) {
        const ru = rep?.neuralResults?.find((n) => n.functionId === fn)?.unitResults.find((x) => x.unitId === u);
        const runs = (eo.get(t.id) ?? []).filter((e) => e.functionId === fn && e.unitId === u && e.outcome.kind === 'valid' && e.parsedVerdict);
        const fails = runs.filter((e) => e.parsedVerdict.pass === false).length;
        const maj = 2 * fails > runs.length ? 'fail' : 'pass';
        const side = runs.filter((e) => (e.parsedVerdict.pass === false) === (maj === 'fail'));
        const conf = side.reduce((s, e) => s + e.parsedVerdict.confidence, 0) / Math.max(1, side.length);
        if (!ru || ru.verdict !== maj || Math.abs(ru.confidence - conf) > 1e-9 || runs.length !== 3) good = false;
      }
    }
    if (good) ok++;
  }
  return `${ok}/${ts.length}`;
}

/** Files under the given dirs that contain a home / volume / tmp path or a key pattern. */
const SCRUB_RE = /\/Users\/|\/home\/[a-z]|\/Volumes\/|\/private\/var|\/var\/folders|\/tmp\/|sk-ant-|AKIA[0-9A-Z]{8}|gh[pousr]_[A-Za-z0-9]{20}|BEGIN [A-Z ]*PRIVATE KEY/;
export function scrubHits(ctx, dirs) {
  let n = 0;
  for (const d of dirs) for (const f of walk(ctx.p(d))) if (SCRUB_RE.test(readFileSync(f, 'utf8'))) n++;
  return String(n);
}

/** Counts of a round's run: evaluated projects, judged units, dry count, live calls, attempts, probes. */
export function runCounts(ctx, round) {
  const p = plan(ctx, round);
  const kinds = (k) => p.targets.filter((t) => t.kind === k).length;
  const units = (pred) => p.targets.filter(pred).reduce((s, t) => s + Object.values(t.units).reduce((a, u) => a + u.length, 0), 0);
  const dry = ctx.json(`${ROUND[round].res}/dry-count.json`);
  const ledger = ctx.json(`${ROUND[round].res}/call-ledger.json`);
  const es = entries(ctx, round);
  return {
    targets: p.targets.length, clean: kinds('clean'), seeds: kinds('seed'), twins: kinds('twin'),
    units: units(() => true), cleanUnits: units((t) => t.kind === 'clean'), otherUnits: units((t) => t.kind !== 'clean'),
    dry, calls: ledger.calls, attempts: ledger.runs.reduce((s, r) => s + r.judgeAttempts, 0),
    probes: ledger.runs.reduce((s, r) => s + r.initProbe, 0), entries: es.length,
    maxAttempts: Math.max(...es.map((e) => e.attempts)),
    allValid: es.every((e) => e.outcome.kind === 'valid' && e.resolvedModel === 'claude-opus-5-5'),
    runsPerUnit: [...new Set(p.targets.map((t) => report(ctx, round, t.id)?.judge?.runsPerUnit))].join(','),
    reports: ctx.ls(`${ROUND[round].res}/reports`).length,
    diffs: existsSync(ctx.p(`${ROUND[round].res}/diffs`)) ? ctx.ls(`${ROUND[round].res}/diffs`).length : 0,
  };
}

/** sha256 of a file at a commit (read-only `git show`). */
export const shaAt = (ctx, rev, path) => once(`sha:${rev}:${path}`, () => sha(ctx.sh(`git show ${rev}:${path}`)));
/** sha256 of the `shasum -a 256` lines, sorted by path, of the catalogue and the antipatterns/*.ts files at a commit. */
export function registryDigest(ctx, rev) {
  const files = ['Docs/operator-catalogue-antipatterns.md', ...ctx.sh(`git ls-tree --name-only ${rev} scripts/lib/mutation/antipatterns/`).trim().split('\n')];
  const lines = files.map((f) => `${shaAt(ctx, rev, f)}  ${f}`).sort((a, b) => (a.split('  ')[1] < b.split('  ')[1] ? -1 : 1));
  return sha(`${lines.join('\n')}\n`);
}
const pre8 = (h) => `${h.slice(0, 8)}…`;
const pre8end4 = (h) => `${h.slice(0, 8)}…${h.slice(-4)}`;
export const frozenSha = (ctx) => once('frozenSha', () => ctx.sh(`${tsx} --eval "import {computeFrozenSha256} from './src/llm-critic/frozen.ts'; console.log(computeFrozenSha256())"`).trim());

// ---- the defensible-claim note, repeated at the top of the three docs ----------------------------------------------
function noteNumbers(p, doc) {
  return [
    { id: `${p}-note-pooled`, doc, line: 3, what: 'pooled seed catch, all strata, rounds 1+2+DUP v2 (duprule-v2 scores pooledAcrossRounds)', stated: '30/35 = 0.86 [0.71, 0.94]' },
    { id: `${p}-note-dupseeds`, doc, line: 3, what: 'DUP-RULE seeds inside the pool', stated: '9' },
    { id: `${p}-note-dup-r1`, doc, line: 3, what: 'DUP-RULE seeds of round 1', stated: 'round 1: 1' },
    { id: `${p}-note-dup-r2`, doc, line: 3, what: 'DUP-RULE seeds of round 2', stated: 'round 2: 8' },
    { id: `${p}-note-styles`, doc, line: 3, what: 'reference styles with a judged unit, of all styles', stated: '4 of 5' },
    { id: `${p}-note-fl-r2`, doc, line: 4, what: 'round 2 FRAMEWORK-LEAK combined catch', stated: 'FRAMEWORK-LEAK 10/13' },
    { id: `${p}-note-pd-r2`, doc, line: 4, what: 'round 2 PERSIST-IN-DOMAIN combined catch', stated: 'PERSIST-IN-DOMAIN 3/3' },
    { id: `${p}-note-fp-r2`, doc, line: 4, what: 'round 2 FL + PERSIST catch (Wilson)', stated: '13/16 = 0.81 [0.57, 0.93]' },
    { id: `${p}-note-fl-r1`, doc, line: 5, what: 'round 1 FRAMEWORK-LEAK catch', stated: 'FRAMEWORK-LEAK 2/4' },
    { id: `${p}-note-pd-r1`, doc, line: 5, what: 'round 1 PERSIST-IN-DOMAIN catch', stated: 'PERSIST-IN-DOMAIN 1/1' },
    { id: `${p}-note-fp-r12`, doc, line: 5, what: 'rounds 1+2 FL + PERSIST catch (Wilson)', stated: '16/21 = 0.76 [0.55, 0.89]' },
  ];
}
function noteValues(ctx, p) {
  const S = scored(ctx);
  const r1 = (o) => S.r1.perOperator.find((x) => x.operator === o).catch;
  const r2 = (o) => S.r2.perOperator.find((x) => x.positive === o).combined.catch;
  const k = (t) => Number(short(t).split('/')[0]); const n = (t) => Number(short(t).split('/')[1]);
  const dup1 = S.r1.perOperator.find((x) => x.operator === 'AP-DUP-RULE').seeds;
  const dup2 = S.r2.perOperator.find((x) => x.positive === 'AP-DUP-RULE').combined.seeds;
  const styles = new Set();
  for (const r of Object.keys(ROUND)) for (const t of plan(ctx, r).targets) { const m = /v1\.3-reference\/([^/]+)\//.exec(t.specPath); if (m) styles.add(m[1]); }
  const all = ctx.ls('tests/fixtures/v1.3-reference').filter((d) => statSync(ctx.p(`tests/fixtures/v1.3-reference/${d}`)).isDirectory());
  return {
    [`${p}-note-pooled`]: S.dv2.pooledAcrossRounds.withV1DupRule.seedsAll,
    [`${p}-note-dupseeds`]: String(dup1 + dup2),
    [`${p}-note-dup-r1`]: `round 1: ${dup1}`,
    [`${p}-note-dup-r2`]: `round 2: ${dup2}`,
    [`${p}-note-styles`]: `${styles.size} of ${all.length}`,
    [`${p}-note-fl-r2`]: `FRAMEWORK-LEAK ${short(r2('AP-FRAMEWORK-LEAK'))}`,
    [`${p}-note-pd-r2`]: `PERSIST-IN-DOMAIN ${short(r2('AP-PERSIST-IN-DOMAIN'))}`,
    [`${p}-note-fp-r2`]: ctx.cell(k(r2('AP-FRAMEWORK-LEAK')) + k(r2('AP-PERSIST-IN-DOMAIN')), n(r2('AP-FRAMEWORK-LEAK')) + n(r2('AP-PERSIST-IN-DOMAIN'))),
    [`${p}-note-fl-r1`]: `FRAMEWORK-LEAK ${short(r1('AP-FRAMEWORK-LEAK'))}`,
    [`${p}-note-pd-r1`]: `PERSIST-IN-DOMAIN ${short(r1('AP-PERSIST-IN-DOMAIN'))}`,
    [`${p}-note-fp-r12`]: ctx.cell(k(r2('AP-FRAMEWORK-LEAK')) + k(r2('AP-PERSIST-IN-DOMAIN')) + k(r1('AP-FRAMEWORK-LEAK')) + k(r1('AP-PERSIST-IN-DOMAIN')),
      n(r2('AP-FRAMEWORK-LEAK')) + n(r2('AP-PERSIST-IN-DOMAIN')) + n(r1('AP-FRAMEWORK-LEAK')) + n(r1('AP-PERSIST-IN-DOMAIN'))),
  };
}

// ---- round 1 -------------------------------------------------------------------------------------------------------
const R1_OPS = ['AP-REPO-BYPASS', 'AP-DUP-RULE', 'AP-FAT-CONTROLLER', 'AP-PERSIST-IN-DOMAIN', 'AP-FRAMEWORK-LEAK'];
const R1_OPLINE = { 'AP-REPO-BYPASS': 77, 'AP-DUP-RULE': 78, 'AP-FAT-CONTROLLER': 79, 'AP-PERSIST-IN-DOMAIN': 80, 'AP-FRAMEWORK-LEAK': 81 };
const R1_SYMLINE = { 'AP-REPO-BYPASS': 100, 'AP-FAT-CONTROLLER': 101, 'AP-PERSIST-IN-DOMAIN': 102, 'AP-DUP-RULE': 103, 'AP-FRAMEWORK-LEAK': 104 };
const R1_STATED = {
  'AP-REPO-BYPASS': ['4', '4/4 = 1.00 [0.51, 1.00]', '4/4', '4', '0/4 = 0.00 [0.00, 0.49]'],
  'AP-DUP-RULE': ['1', '1/1 = 1.00 [0.21, 1.00]', '1/1', '1', '1/1 = 1.00 [0.21, 1.00]'],
  'AP-FAT-CONTROLLER': ['1', '1/1 = 1.00 [0.21, 1.00]', '1/1', '1', '0/1 = 0.00 [0.00, 0.79]'],
  'AP-PERSIST-IN-DOMAIN': ['1', '1/1 = 1.00 [0.21, 1.00]', '1/1', '7', '2/7 = 0.29 [0.08, 0.64]'],
  'AP-FRAMEWORK-LEAK': ['4', '2/4 = 0.50 [0.15, 0.85]', '2/4', '20', '0/20 = 0.00 [0.00, 0.16]'],
};
const R1_SYMSTATED = { 'AP-REPO-BYPASS': ['4', '0/4', '4/4'], 'AP-FAT-CONTROLLER': ['1', '0/1', '1/1'], 'AP-PERSIST-IN-DOMAIN': ['1', '0/1', '1/1'], 'AP-DUP-RULE': ['1', '0/1', '1/1'], 'AP-FRAMEWORK-LEAK': ['4', '0/4', '2/4'] };
const COLS = ['seeds', 'catch', 'paired', 'twins', 'twinff'];
const slug = (o) => o.replace(/^AP-/, '').toLowerCase();

const r1Scores = [
  ...noteNumbers('b-r1', D1),
  ...R1_OPS.flatMap((o) => COLS.map((c, i) => ({ id: `b-r1-t3-${slug(o)}-${c}`, doc: D1, line: R1_OPLINE[o], what: `§3 ${o} ${c}`, stated: R1_STATED[o][i] }))),
  { id: 'b-r1-t3-pooled-seeds', doc: D1, line: 82, what: '§3 pooled seeds', stated: '11' },
  { id: 'b-r1-t3-pooled-catch', doc: D1, line: 82, what: '§3 pooled catch and macro mean', stated: '9/11 = 0.82 [0.52, 0.95]; macro mean 0.90' },
  { id: 'b-r1-t3-pooled-paired', doc: D1, line: 82, what: '§3 pooled paired catch', stated: '9/11' },
  { id: 'b-r1-t3-pooled-twins', doc: D1, line: 82, what: '§3 pooled twins', stated: '33' },
  { id: 'b-r1-t3-pooled-twinff', doc: D1, line: 82, what: '§3 pooled twin false fail', stated: '3/33 = 0.09 [0.03, 0.24]' },
  { id: 'b-r1-miss-both', doc: D1, line: 85, what: 'misses, all FL seeds on invoice.service.ts', stated: 'Both' },
  { id: 'b-r1-miss-runs', doc: D1, line: 85, what: 'judge runs on the two missed seeds (all pass)', stated: '6' },
  { id: 'b-r1-miss-conf', doc: D1, line: 85, what: 'confidence range of those runs', stated: '0.60 to 0.68' },
  { id: 'b-r1-miss-order', doc: D1, line: 85, what: 'FL seeds on order.service.ts caught', stated: 'two' },
  { id: 'b-r1-twinff-persist', doc: D1, line: 87, what: 'PERSIST-IN-DOMAINn twins failing', stated: '2' },
  { id: 'b-r1-twinff-dup', doc: D1, line: 88, what: 'DUP-RULEn twins failing', stated: '1' },
  { id: 'b-r1-twinff-paired', doc: D1, line: 89, what: 'paired twin false-fail rate', stated: '1/33 = 0.03 [0.01, 0.15]' },
  { id: 'b-r1-clean-units', doc: D1, line: 91, what: 'clean unit false-fail rate', stated: '2/24 = 0.08 [0.02, 0.26]' },
  { id: 'b-r1-clean-bases', doc: D1, line: 92, what: 'clean per-base false-fail rate', stated: '1/7 = 0.14 [0.03, 0.51]' },
  { id: 'b-r1-clean-refunits', doc: D1, line: 92, what: 'reference-project clean units (none failed)', stated: '16' },
  ...R1_OPS.flatMap((o) => ['seeds', 's2', 'judgeonly'].map((c, i) => ({ id: `b-r1-t4-${slug(o)}-${c}`, doc: D1, line: R1_SYMLINE[o], what: `§4 ${o} ${c}`, stated: R1_SYMSTATED[o][i] }))),
  { id: 'b-r1-t4-persist-s1', doc: D1, line: 102, what: '§4 PERSIST-IN-DOMAIN S1 (FF-P01 at the expected key)', stated: '0/1' },
  { id: 'b-r1-v-pooled', doc: D1, line: 114, what: '§5 pooled catch', stated: '9/11 = 0.82' },
  { id: 'b-r1-v-macro', doc: D1, line: 114, what: '§5 macro mean over operators', stated: '0.90' },
  { id: 'b-r1-v-lb', doc: D1, line: 115, what: '§5 Wilson lower bound of the pooled catch', stated: '0.52' },
  { id: 'b-r1-v-single', doc: D1, line: 115, what: 'operators with a single seed', stated: 'Three' },
  { id: 'b-r1-v-fl', doc: D1, line: 116, what: 'FRAMEWORK-LEAK catch', stated: '2/4 = 0.50 [0.15, 0.85]' },
  { id: 'b-r1-v-repo', doc: D1, line: 118, what: 'REPO-BYPASS catch against twin false fail', stated: '4/4 against 0/4' },
];

const r1Run = [
  { id: 'b-r1-onfixture-hdr', doc: D1, line: 9, what: 'seeds on the one fixture, of all seeds', stated: 'All 11' },
  { id: 'b-r1-onfixture-v', doc: D1, line: 117, what: 'seeds on the one fixture, of all seeds (§5)', stated: 'All 11' },
  { id: 'b-r1-fixture-files', doc: D1, line: 117, what: 'antipattern-nest source files (src/**/*.ts)', stated: '8' },
  { id: 'b-r1-ops', doc: D1, line: 15, what: 'AP operators frozen (positives)', stated: 'five' },
  { id: 'b-r1-digest', doc: D1, line: 15, what: 'combined registry digest at the freeze commit 0771ecb5', stated: '59d70946…d36b' },
  { id: 'b-r1-rubric', doc: D1, line: 16, what: 'sha256 of src/llm-critic/rubric.ts (HEAD)', stated: '52960e02…' },
  { id: 'b-r1-frozensha', doc: D1, line: 16, what: 'computeFrozenSha256() (HEAD)', stated: 'f8b2dabb…' },
  { id: 'b-r1-runsperunit', doc: D1, line: 17, what: 'runs per unit in every report', stated: '3' },
  { id: 'b-r1-unitcap', doc: D1, line: 55, what: 'default unit cap (UNIT_CAP, src/llm-critic/frozen.ts)', stated: '20' },
  { id: 'b-r1-evaluated', doc: D1, line: 59, what: 'evaluated projects (plan.json targets)', stated: '51: 7 clean bases, 11 seeds, 33 twins' },
  { id: 'b-r1-units', doc: D1, line: 60, what: 'judged units', stated: '70 (24 clean, 46 seed or twin)' },
  { id: 'b-r1-dry', doc: D1, line: 61, what: 'mock dry count', stated: '261 (210 entries + 51 init probes)' },
  { id: 'b-r1-calls', doc: D1, line: 62, what: 'live calls (ledger)', stated: '261' },
  { id: 'b-r1-judgecalls', doc: D1, line: 62, what: 'judge calls (ledger attempts = cassette entries)', stated: '210' },
  { id: 'b-r1-attempts', doc: D1, line: 62, what: 'attempts of every cassette entry', stated: '1' },
  { id: 'b-r1-probes', doc: D1, line: 62, what: 'init probes (ledger)', stated: '51' },
  { id: 'b-r1-scrub', doc: D1, line: 63, what: 'scrub hits in cassettes and results', stated: '0' },
  { id: 'b-r1-replay-ok', doc: D1, line: 65, what: '`replay` of all targets from the cassettes', stated: '51/51', needs: 'needs-Neo4j',
    note: 'replay runs firewall evaluate against Neo4j; its vote part is re-derived as b-r1-replay-same' },
  { id: 'b-r1-replay-same', doc: D1, line: 65, what: 'targets whose report verdicts and confidences equal the cassette majority', stated: '51/51', basis: 'replayed' },
  { id: 'b-r1-reports', doc: D1, line: 142, what: 'evaluate reports committed', stated: '51' },
  { id: 'b-r1-env-swap', doc: D1, line: 147, what: 'swap in use when the hook blocked', stated: 'about 11 of 16 GB', needs: 'not-checkable', note: 'environment observation, no raw record' },
  { id: 'b-r1-env-free', doc: D1, line: 147, what: 'memory_pressure free', stated: '33 to 35%', needs: 'not-checkable', note: 'environment observation, no raw record' },
];

// round 1 §1 sites (regenerated by the seeder)
const R1_TOPS = ['AP-REPO-BYPASS', 'AP-REPO-BYPASSn', 'AP-FAT-CONTROLLER', 'AP-FAT-CONTROLLERn', 'AP-PERSIST-IN-DOMAIN', 'AP-PERSIST-IN-DOMAINn', 'AP-DUP-RULE', 'AP-DUP-RULEn', 'AP-FRAMEWORK-LEAK', 'AP-FRAMEWORK-LEAKn'];
const R1_BASES = ['clean-architecture/clean', 'layered/clean', 'nestjs/clean', 'hexagonal/clean', 'ddd/clean', 'antipattern-nest'];
const R1_TABLE = [
  ['0/0', '0/0', '0/0', '0/0', '0/0', '4/4', '0', '0'],
  ['0/0', '0/0', '0/0', '0/0', '0/0', '4/4', '0', '0'],
  ['0/0', '0/0', '0/0', '0/0', '0/0', '1/1', '0', '0'],
  ['0/0', '0/0', '0/0', '0/0', '1/1', '1/1', '2', '0'],
  ['0/1', '0/1', '0/1', '0/1', '0/5', '1/3', '0', '0'],
  ['1/1', '1/1', '1/1', '1/1', '5/5', '3/3', '22', '0'],
  ['0/0', '0/0', '0/0', '0/0', '0/0', '1/1', '0', '0'],
  ['0/0', '0/0', '0/0', '0/0', '0/0', '1/1', '0', '0'],
  ['0/4', '0/0', '0/7', '0/3', '0/3', '4/4', '0', '0'],
  ['4/4', '0/0', '7/7', '3/3', '3/3', '4/4', '50', '2'],
];
const R1_TCOLS = ['ca', 'layered', 'nestjs', 'hex', 'ddd', 'apnest', 'nearmiss', 'nearmiss-applied'];
const r1Sites = [
  { id: 'b-r1-s-refprojects', doc: D1, line: 24, what: 'reference projects used as bases', stated: 'five' },
  { id: 'b-r1-s-nearmiss', doc: D1, line: 24, what: 'near-miss variants added', stated: '14' },
  { id: 'b-r1-s-nearmiss-hdr', doc: D1, line: 28, what: 'near-miss variants (table header)', stated: '14' },
  ...R1_TOPS.flatMap((o, i) => R1_TCOLS.map((c, j) => ({ id: `b-r1-s-${slug(o)}-${c}`, doc: D1, line: 30 + i, what: `§1 ${o} ${c} (eligible/candidates or count)`, stated: R1_TABLE[i][j] }))),
  ...[['repo-bypass', 'REPO-BYPASS 4'], ['fat-controller', 'FAT-CONTROLLER 1'], ['persist-in-domain', 'PERSIST-IN-DOMAIN 1'], ['dup-rule', 'DUP-RULE 1'], ['framework-leak', 'FRAMEWORK-LEAK 4']]
    .map(([s, v]) => ({ id: `b-r1-s-seeds-${s}`, doc: D1, line: 41, what: `seeds per operator, ${s}`, stated: v })),
  { id: 'b-r1-s-seeds-total', doc: D1, line: 41, what: 'seeds in total, all on antipattern-nest', stated: '11 in total' },
  { id: 'b-r1-s-below5', doc: D1, line: 41, what: 'positives with fewer than 5 candidate sites', stated: 'three' },
  { id: 'b-r1-s-nestjs-applied', doc: D1, line: 46, what: 'nestjs n02/n03 FRAMEWORK-LEAKn near-miss sites applied', stated: '2' },
  { id: 'b-r1-s-ddd-skipped', doc: D1, line: 47, what: 'DDD twin copies seeded but not judged (plan.json skipped)', stated: '9' },
  { id: 'b-r1-s-tsc-copies', doc: D1, line: 49, what: 'applied copies passing tsc', stated: '53' },
  { id: 'b-r1-s-tsc-errors', doc: D1, line: 49, what: 'tsc errors over the applied copies', stated: '0' },
];

async function r1RunValues(ctx) {
  const c = runCounts(ctx, 'r1');
  const rows = manifest(ctx, 'r1').rows.filter((r) => r.role === 'seed' && r.status === 'ok');
  const onFx = rows.filter((r) => r.baseId === 'antipattern-nest').length;
  const onFxOf = onFx === rows.length ? `All ${onFx}` : `${onFx} of the ${rows.length}`;
  const fx = walk(ctx.p('fixtures/unit/antipattern-nest/src')).filter((f) => f.endsWith('.ts')).length;
  const unitCap = ctx.sh(`${tsx} --eval "import {UNIT_CAP} from './src/llm-critic/frozen.ts'; console.log(UNIT_CAP)"`).trim();
  return {
    'b-r1-onfixture-hdr': onFxOf, 'b-r1-onfixture-v': onFxOf, 'b-r1-fixture-files': String(fx),
    'b-r1-ops': word(manifest(ctx, 'r1').expandedToNearMiss.length),
    'b-r1-digest': pre8end4(registryDigest(ctx, '0771ecb5')),
    'b-r1-rubric': pre8(shaAt(ctx, 'HEAD', 'src/llm-critic/rubric.ts')), 'b-r1-frozensha': pre8(frozenSha(ctx)),
    'b-r1-runsperunit': c.runsPerUnit, 'b-r1-unitcap': unitCap,
    'b-r1-evaluated': `${c.targets}: ${c.clean} clean bases, ${c.seeds} seeds, ${c.twins} twins`,
    'b-r1-units': `${c.units} (${c.cleanUnits} clean, ${c.otherUnits} seed or twin)`,
    'b-r1-dry': `${c.dry.projectedCalls} (${c.dry.entries} entries + ${c.dry.initProbes} init probes)`,
    'b-r1-calls': String(c.calls), 'b-r1-judgecalls': c.attempts === c.entries ? String(c.attempts) : `${c.attempts} (cassettes ${c.entries})`,
    'b-r1-attempts': c.allValid ? String(c.maxAttempts) : `${c.maxAttempts} (not all valid)`, 'b-r1-probes': String(c.probes),
    'b-r1-scrub': scrubHits(ctx, [ROUND.r1.cas, 'results/v1.3-judge-catch/reports', 'results/v1.3-judge-catch/plan.json', 'results/v1.3-judge-catch/seed-manifest.json'].filter((d) => statSync(ctx.p(d)).isDirectory())),
    'b-r1-replay-same': voteReplay(ctx, 'r1'), 'b-r1-reports': String(c.reports),
  };
}

async function r1ScoreValues(ctx) {
  const S = scored(ctx).r1;
  const op = (o) => S.perOperator.find((p) => p.operator === o);
  const out = { ...noteValues(ctx, 'b-r1') };
  for (const o of R1_OPS) {
    const p = op(o);
    Object.assign(out, {
      [`b-r1-t3-${slug(o)}-seeds`]: String(p.seeds), [`b-r1-t3-${slug(o)}-catch`]: T(p.catch), [`b-r1-t3-${slug(o)}-paired`]: short(p.pairedCatch),
      [`b-r1-t3-${slug(o)}-twins`]: String(p.twins), [`b-r1-t3-${slug(o)}-twinff`]: T(p.twinFalseFail),
      [`b-r1-t4-${slug(o)}-seeds`]: String(p.seeds), [`b-r1-t4-${slug(o)}-s2`]: short(p.symbolicS2), [`b-r1-t4-${slug(o)}-judgeonly`]: short(p.judgeOnlyS2),
    });
  }
  out['b-r1-t4-persist-s1'] = short(op('AP-PERSIST-IN-DOMAIN').symbolicS1);
  const P = S.pooled;
  out['b-r1-t3-pooled-seeds'] = String(S.perOperator.reduce((s, p) => s + p.seeds, 0));
  out['b-r1-t3-pooled-catch'] = `${T(P.catch)}; macro mean ${P.macroCatch.toFixed(2)}`;
  out['b-r1-t3-pooled-paired'] = short(P.pairedCatch);
  out['b-r1-t3-pooled-twins'] = String(S.perOperator.reduce((s, p) => s + p.twins, 0));
  out['b-r1-t3-pooled-twinff'] = T(P.twinFalseFail);
  const rows = S.rows.filter((r) => r.judged);
  const seeds = rows.filter((r) => r.role === 'seed'); const twins = rows.filter((r) => r.role === 'twin');
  const misses = seeds.filter((r) => !r.catch);
  const man = manifest(ctx, 'r1').rows;
  const site = (id) => man.find((r) => r.rowId === id).site.filePath;
  const eo = entriesOf(ctx, 'r1');
  const runs = misses.flatMap((r) => (eo.get(r.rowId) ?? []).filter((e) => r.units.some((u) => u.unit === e.unitId) && e.functionId === r.probedFunction));
  const conf = runs.map((e) => e.parsedVerdict.confidence);
  out['b-r1-miss-both'] = misses.length === 2 && misses.every((r) => r.positiveId === 'AP-FRAMEWORK-LEAK' && site(r.rowId).endsWith('invoice.service.ts')) ? 'Both' : `${misses.length} misses`;
  out['b-r1-miss-runs'] = runs.every((e) => e.parsedVerdict.pass === true) ? String(runs.length) : `${runs.length} (not all pass)`;
  out['b-r1-miss-conf'] = `${Math.min(...conf).toFixed(2)} to ${Math.max(...conf).toFixed(2)}`;
  out['b-r1-miss-order'] = word(seeds.filter((r) => r.positiveId === 'AP-FRAMEWORK-LEAK' && r.catch && site(r.rowId).endsWith('order.service.ts')).length);
  out['b-r1-twinff-persist'] = String(twins.filter((r) => r.positiveId === 'AP-PERSIST-IN-DOMAIN' && r.unitFail).length);
  out['b-r1-twinff-dup'] = String(twins.filter((r) => r.positiveId === 'AP-DUP-RULE' && r.unitFail).length);
  out['b-r1-twinff-paired'] = ctx.cell(twins.filter((r) => r.units.some((u) => u.verdict === 'fail' && u.base !== 'fail')).length, twins.length);
  out['b-r1-clean-units'] = T(P.cleanUnitFalseFail);
  out['b-r1-clean-bases'] = T(P.cleanBaseFalseFail);
  out['b-r1-clean-refunits'] = String(S.cleanUnits.filter((u) => u.base !== 'antipattern-nest').length);
  out['b-r1-v-pooled'] = T(P.catch).split(' [')[0];
  out['b-r1-v-macro'] = P.macroCatch.toFixed(2);
  out['b-r1-v-lb'] = P.catch.low.toFixed(2);
  out['b-r1-v-single'] = Word(S.perOperator.filter((p) => p.seeds === 1).length);
  out['b-r1-v-fl'] = T(op('AP-FRAMEWORK-LEAK').catch);
  out['b-r1-v-repo'] = `${short(op('AP-REPO-BYPASS').catch)} against ${short(op('AP-REPO-BYPASS').twinFalseFail)}`;
  return out;
}

async function r1SiteValues(ctx) {
  const dir = ctx.out('b-r1-seed');
  ctx.sh(`${tsx} scripts/v1.3/judge-catch-seed.ts --out "${dir}"`, { timeout: 20 * 60_000 });
  const m = JSON.parse(readFileSync(join(dir, 'seed-manifest.json'), 'utf8'));
  const nearBases = [...new Set(m.table.map((t) => t.baseId))].filter((b) => !R1_BASES.includes(b));
  const cell = (o, b) => { const t = m.table.find((x) => x.operatorId === o && x.baseId === b); return `${t.eligible}/${t.candidates}`; };
  const out = {
    'b-r1-s-refprojects': word(R1_BASES.filter((b) => b.endsWith('/clean')).length),
    'b-r1-s-nearmiss': String(nearBases.length), 'b-r1-s-nearmiss-hdr': String(nearBases.length),
  };
  for (const o of R1_TOPS) {
    R1_BASES.forEach((b, j) => { out[`b-r1-s-${slug(o)}-${R1_TCOLS[j]}`] = cell(o, b); });
    out[`b-r1-s-${slug(o)}-nearmiss`] = String(m.table.filter((t) => t.operatorId === o && nearBases.includes(t.baseId)).reduce((s, t) => s + t.eligible, 0));
    out[`b-r1-s-${slug(o)}-nearmiss-applied`] = String(m.rows.filter((r) => r.operatorId === o && r.baseKind === 'near-miss' && r.status === 'ok').length);
  }
  const seeds = m.rows.filter((r) => r.role === 'seed' && r.status === 'ok');
  for (const [s, o] of [['repo-bypass', 'AP-REPO-BYPASS'], ['fat-controller', 'AP-FAT-CONTROLLER'], ['persist-in-domain', 'AP-PERSIST-IN-DOMAIN'], ['dup-rule', 'AP-DUP-RULE'], ['framework-leak', 'AP-FRAMEWORK-LEAK']]) {
    out[`b-r1-s-seeds-${s}`] = `${o.replace(/^AP-/, '')} ${seeds.filter((r) => r.operatorId === o).length}`;
  }
  out['b-r1-s-seeds-total'] = `${seeds.length} in total`;
  const positives = R1_TOPS.filter((o) => !o.endsWith('n'));
  out['b-r1-s-below5'] = word(positives.filter((o) => m.table.filter((t) => t.operatorId === o).reduce((s, t) => s + t.candidates, 0) < 5).length);
  out['b-r1-s-nestjs-applied'] = String(m.rows.filter((r) => r.operatorId === 'AP-FRAMEWORK-LEAKn' && r.baseKind === 'near-miss' && r.status === 'ok' && r.baseId.startsWith('nestjs/')).length);
  out['b-r1-s-ddd-skipped'] = String(plan(ctx, 'r1').skipped.filter((s) => s.id.startsWith('ddd__')).length);
  const ok = m.rows.filter((r) => r.status === 'ok');
  out['b-r1-s-tsc-copies'] = String(ok.length);
  out['b-r1-s-tsc-errors'] = String(ok.reduce((s, r) => s + r.typecheckErrors.length, 0));
  return out;
}

// ---- round 2 -------------------------------------------------------------------------------------------------------
const R2_TABLE = [
  // [line, label, positive, stratum, stated seeds, catch, paired, twins, twinff, pairedTwinff] (null = "—", not registered)
  [122, 'dup-op', 'AP-DUP-RULE', 'operator', '8', '8/8 = 1.00 [0.68, 1.00]', '7/8 = 0.88 [0.53, 0.98]', '5', '5/5 = 1.00 [0.57, 1.00]', '4/5 = 0.80 [0.38, 0.96]'],
  [123, 'fl-op', 'AP-FRAMEWORK-LEAK', 'operator', '8', '6/8 = 0.75 [0.41, 0.93]', '6/8 = 0.75 [0.41, 0.93]', '8', '0/8 = 0.00 [0.00, 0.32]', '0/8'],
  [124, 'pd-hp', 'AP-PERSIST-IN-DOMAIN', 'hand-planted', '3', '3/3 = 1.00 [0.44, 1.00]', '3/3 = 1.00 [0.44, 1.00]', '0', null, null],
  [125, 'fl-hp', 'AP-FRAMEWORK-LEAK', 'hand-planted', '5', '4/5 = 0.80 [0.38, 0.96]', '4/5 = 0.80 [0.38, 0.96]', '1', '0/1 = 0.00 [0.00, 0.79]', '0/1'],
  [126, 'fl-comb', 'AP-FRAMEWORK-LEAK', 'combined', '13', '10/13 = 0.77 [0.50, 0.92]', '10/13', '9', '0/9 = 0.00 [0.00, 0.30]', '0/9'],
  [127, 'pool-op', null, 'operator', '16', '14/16 = 0.88 [0.64, 0.97]', '13/16 = 0.81 [0.57, 0.93]', '13', '5/13 = 0.38 [0.18, 0.64]', '4/13 = 0.31 [0.13, 0.58]'],
  [128, 'pool-hp', null, 'hand-planted', '8', '7/8 = 0.88 [0.53, 0.98]', '7/8 = 0.88 [0.53, 0.98]', '1', '0/1', '0/1'],
  [129, 'pool-comb', null, 'combined', '24', '21/24 = 0.88 [0.69, 0.96]', '20/24 = 0.83 [0.64, 0.93]', '14', '5/14 = 0.36 [0.16, 0.61]', '4/14 = 0.29 [0.12, 0.55]'],
];
const R2_KEYS = ['seeds', 'catch', 'pairedCatch', 'twins', 'twinFalseFail', 'twinFalseFailPaired'];
const fmtLike = (stated, value) => (/ = /.test(stated) ? T(value) : short(value));

const r2Scores = [
  ...noteNumbers('b-r2', D2),
  ...R2_TABLE.flatMap(([line, lab, , , ...st]) => st.map((s, i) => (s === null ? null : { id: `b-r2-t3-${lab}-${R2_KEYS[i]}`, doc: D2, line, what: `§3 table ${lab} ${R2_KEYS[i]}`, stated: s })).filter(Boolean)),
  ...[['e1', 135, '1/16 = 0.06 [0.01, 0.28]', '1/14 = 0.07 [0.01, 0.31]'], ['ref', 136, '0/8 = 0.00 [0.00, 0.32]', '0/4 = 0.00 [0.00, 0.49]'], ['comb', 137, '1/24 = 0.04 [0.01, 0.20]', '1/18 = 0.06 [0.01, 0.26]']]
    .flatMap(([s, line, u, b]) => [{ id: `b-r2-clean-${s}-units`, doc: D2, line, what: `clean controls ${s}: failing units`, stated: u }, { id: `b-r2-clean-${s}-bases`, doc: D2, line, what: `clean controls ${s}: failing bases`, stated: b }]),
  ...[[140, 'repo', 'REPO-BYPASS 4/4'], [141, 'dup', 'DUP-RULE 9/9 = 1.00 [0.70, 1.00]'], [142, 'fat', 'FAT-CONTROLLER 1/1'], [143, 'pd', 'PERSIST-IN-DOMAIN 1/1'], [144, 'fl', 'FRAMEWORK-LEAK 8/12 = 0.67 [0.39, 0.86]'], [145, 'pooled', 'pooled 23/27 = 0.85 [0.68, 0.94]']]
    .map(([line, s, v]) => ({ id: `b-r2-r12-${s}`, doc: D2, line, what: `rounds 1+2 operator seeds, ${s}`, stated: v })),
  { id: 'b-r2-dupn-fail', doc: D2, line: 149, what: 'DUP-RULEn twins that fail', stated: '5' },
  { id: 'b-r2-dupn-paired', doc: D2, line: 149, what: 'DUP-RULEn twins failing where the base passes', stated: '4' },
  { id: 'b-r2-dupn-r1', doc: D2, line: 151, what: 'round-1 DUP-RULEn twin fails', stated: '1/1' },
  { id: 'b-r2-dupn-e1', doc: D2, line: 151, what: 'E1 DUP-RULEn twin fails', stated: '5/5' },
  { id: 'b-r2-dup-catch', doc: D2, line: 152, what: 'DUP-RULE catch (E1)', stated: '8/8' },
  { id: 'b-r2-fl-comb', doc: D2, line: 154, what: 'FRAMEWORK-LEAK combined catch', stated: '10/13 = 0.77 [0.50, 0.92]' },
  { id: 'b-r2-fl-twin', doc: D2, line: 154, what: 'FRAMEWORK-LEAK combined twin false fails', stated: '0/9' },
  { id: 'b-r2-miss-both', doc: D2, line: 155, what: 'E1 FL misses (CancelOrderUseCase, AdvanceOrderUseCase)', stated: 'Both' },
  { id: 'b-r2-miss-conf', doc: D2, line: 155, what: 'confidence range of the runs on the E1 misses (all pass)', stated: '0.60 to 0.68' },
  { id: 'b-r2-hex07-runs', doc: D2, line: 156, what: 'runs passing hexagonal v07', stated: '3' },
  { id: 'b-r2-pd-hp', doc: D2, line: 158, what: 'hand-planted PERSIST-IN-DOMAIN seeds, all caught', stated: '3' },
  { id: 'b-r2-clean-low', doc: D2, line: 159, what: 'clean false fails (units)', stated: '1/24' },
  { id: 'b-r2-clean-dto', doc: D2, line: 159, what: 'failing runs on the haiku usecases clean unit citing the Order->OrderDto mapping', stated: 'All 3 runs', basis: 'replayed' },
  { id: 'b-r2-s2-e1', doc: D2, line: 161, what: 'S2 on E1 seeds', stated: '0/16' },
  { id: 'b-r2-hp-ffp01', doc: D2, line: 162, what: 'hand-planted seeds with the expected FF-P01 row', stated: '7' },
  { id: 'b-r2-hp-blocking', doc: D2, line: 162, what: 'hand-planted seeds failing the blocking verdict (base passes)', stated: 'Each one', note: '8/8 hand-planted copies' },
  { id: 'b-r2-exit-point', doc: D2, line: 164, what: 'pooled point estimate', stated: '0.88 (combined, n = 24)' },
  { id: 'b-r2-exit-lb', doc: D2, line: 164, what: 'Wilson lower bounds', stated: '0.69 combined, 0.64 for the operator stratum and 0.53 for the hand-planted stratum' },
  { id: 'b-r2-exit-fl', doc: D2, line: 166, what: 'FRAMEWORK-LEAK combined point and lower bound', stated: '0.77 with a lower bound of 0.50' },
  { id: 'b-r2-informative', doc: D2, line: 167, what: 'informative seeds left after discounting DUP-RULE', stated: '16' },
  { id: 'b-r2-informative-fl', doc: D2, line: 167, what: 'informative FRAMEWORK-LEAK catch', stated: '10/13 FRAMEWORK-LEAK' },
  { id: 'b-r2-informative-pd', doc: D2, line: 167, what: 'informative PERSIST-IN-DOMAIN catch', stated: '3/3 PERSIST-IN-DOMAIN' },
  { id: 'b-r2-informative-pool', doc: D2, line: 167, what: 'informative seeds pooled', stated: '13/16 = 0.81 [0.57, 0.93]' },
  { id: 'b-r2-s1-hp', doc: D2, line: 191, what: 'FF-P01 S1 on the hand-planted PERSIST-IN-DOMAIN variants', stated: 'S1 3/3' },
  { id: 'b-r2-bothcatch', doc: D2, line: 198, what: 'hand-planted both-catch control', stated: 'judge 3/3, FF-P01 3/3' },
];

const r2Run = [
  { id: 'b-r2-hashes', doc: D2, line: 15, what: 'operator and catalogue hashes of judge-catch-frozen.md matching at the round-2 base a06532d3', stated: '11' },
  { id: 'b-r2-rubric', doc: D2, line: 16, what: 'sha256 rubric.ts at a06532d3', stated: '52960e02…' },
  { id: 'b-r2-frozents', doc: D2, line: 17, what: 'sha256 frozen.ts at a06532d3', stated: 'b6301b67…' },
  { id: 'b-r2-digest', doc: D2, line: 18, what: 'combined registry digest at a06532d3', stated: '59d70946…d36b' },
  { id: 'b-r2-runsperunit', doc: D2, line: 21, what: 'runs per unit in every report', stated: '3' },
  { id: 'b-r2-env-swap', doc: D2, line: 26, what: 'swap in use', stated: 'about 11.9 of 13.3 GB', needs: 'not-checkable', note: 'environment observation, no raw record' },
  { id: 'b-r2-env-free', doc: D2, line: 26, what: 'memory_pressure free', stated: '33 to 39%', needs: 'not-checkable', note: 'environment observation, no raw record' },
  { id: 'b-r2-cells-hdr', doc: D2, line: 31, what: 'accepted E1 cells (heading)', stated: '65' },
  { id: 'b-r2-cells', doc: D2, line: 33, what: 'accepted E1 cells', stated: '65' },
  ...[
    [45, 'repo', 'AP-REPO-BYPASS', ['0 of 65', '0 / 0', null, '0']],
    [46, 'fat', 'AP-FAT-CONTROLLER', ['0 of 65', '0 / 0', null, '0']],
    [47, 'pd', 'AP-PERSIST-IN-DOMAIN', ['0 of 65', '0 / 80', 'type-shape 80', '0']],
    [48, 'dup', 'AP-DUP-RULE', ['16 of 65', '110 / 110', null, '8 (10 draws rejected at type-check)']],
    [49, 'fl', 'AP-FRAMEWORK-LEAK', ['65 of 65', '434 / 434', null, '8']],
    [50, 'dupn', 'AP-DUP-RULEn', ['16', '110 / 110', null, '5 twins (19 draws rejected at type-check)']],
    [51, 'fln', 'AP-FRAMEWORK-LEAKn', ['65', '434 / 434', null, '8 twins']],
    [52, 'pdn', 'AP-PERSIST-IN-DOMAINn', ['38', '80 / 80', null, null]],
    [53, 'fatn', 'AP-FAT-CONTROLLERn', ['1', '1 / 1', null, null]],
  ].flatMap(([line, s, , cells]) => cells.map((v, i) => (v === null ? null : { id: `b-r2-s-${s}-${['cells', 'elig', 'rej', 'seeded'][i]}`, doc: D2, line, what: `§1a site table ${s} ${['cells with a site', 'eligible / candidates', 'rejected', 'seeded (ok)'][i]}`, stated: v })).filter(Boolean)),
  { id: 'b-r2-s-same-site', doc: D2, line: 66, what: 'twin matches, same site', stated: '12 same-site' },
  { id: 'b-r2-s-same-file', doc: D2, line: 66, what: 'twin matches, same file', stated: '1 same-file' },
  { id: 'b-r2-s-notwin', doc: D2, line: 70, what: 'DUP-RULE seeds with no compiling twin', stated: '3' },
  { id: 'b-r2-s-twins-left', doc: D2, line: 70, what: 'DUP-RULEn twins left', stated: '5' },
  { id: 'b-r2-s-spread', doc: D2, line: 73, what: 'operator seeds over cells', stated: '16 seeds over 14 cells' },
  { id: 'b-r2-s-models', doc: D2, line: 74, what: 'operator seeds by generator model', stated: 'sonnet 8, opus 4, haiku 2, gpt-5.6-terra 2' },
  { id: 'b-r2-s-tasks', doc: D2, line: 75, what: 'operator seeds by task', stated: 'order-fulfilment 13, task-management 3' },
  { id: 'b-r2-s-dup-app', doc: D2, line: 76, what: 'DUP-RULE seeds in src/application', stated: '8' },
  { id: 'b-r2-s-dup-of', doc: D2, line: 76, what: 'DUP-RULE seeds on order-fulfilment cells', stated: '7' },
  { id: 'b-r2-s-dup-sonnet', doc: D2, line: 76, what: 'DUP-RULE seeds from claude-sonnet-5-5', stated: '6' },
  { id: 'b-r2-s-hp-twin', doc: D2, line: 93, what: 'twins of the hand-planted stratum', stated: 'one' },
  { id: 'b-r2-s-hp-tsc', doc: D2, line: 99, what: 'hand-planted variant copies passing tsc', stated: '8' },
  { id: 'b-r2-s-diffs', doc: D2, line: 99, what: 'diffs in round2/diffs', stated: '38' },
  { id: 'b-r2-evaluated', doc: D2, line: 109, what: 'evaluated projects', stated: '56: 18 clean bases (14 E1 cells, 4 reference styles), 24 seeds, 14 twins' },
  { id: 'b-r2-units', doc: D2, line: 110, what: 'judged units', stated: '62 (24 clean, 38 seed or twin)' },
  { id: 'b-r2-dry', doc: D2, line: 111, what: 'mock dry count', stated: '242 (186 entries + 56 init probes)' },
  { id: 'b-r2-calls', doc: D2, line: 112, what: 'live calls', stated: '242' },
  { id: 'b-r2-judgecalls', doc: D2, line: 112, what: 'judge calls', stated: '186' },
  { id: 'b-r2-attempts', doc: D2, line: 112, what: 'attempts of every entry', stated: '1' },
  { id: 'b-r2-probes', doc: D2, line: 112, what: 'init probes', stated: '56' },
  { id: 'b-r2-replay-ok', doc: D2, line: 113, what: '`replay` of all targets', stated: '56/56', needs: 'needs-Neo4j', note: 'replay runs firewall evaluate against Neo4j; vote part re-derived as b-r2-replay-same' },
  { id: 'b-r2-replay-same', doc: D2, line: 113, what: 'targets whose report verdicts and confidences equal the cassette majority', stated: '56/56', basis: 'replayed' },
  { id: 'b-r2-scrub', doc: D2, line: 114, what: 'scrub hits', stated: '0' },
  { id: 'b-r2-reports', doc: D2, line: 219, what: 'evaluate reports committed', stated: '56' },
  { id: 'b-r2-diffs2', doc: D2, line: 221, what: 'diffs committed', stated: '38' },
];

// FF-P01 repro (§4) at HEAD
const FFP = [['A', 179, 'none', 'none'], ['B', 180, 'File:vendor/typeorm.ts', 'none'], ['C', 181, 'Package:typeorm', 'typeorm'], ['D', 182, 'none', 'none']];
// The table describes the extractor at the round-2 commit, before the F-P01-ALIAS fix (15e755eb). At HEAD shapes A and
// D resolve the .d.ts alias to Package:typeorm, so the repro runs in an export of the round-2 commit (audit D-4).
const FFP_COMMIT = 'f8251b8b';
const FFP_NOTE = `checked at the round-2 commit ${FFP_COMMIT}, which the table describes; at HEAD the later F-P01-ALIAS fix (15e755eb) gives shapes A and D Package:typeorm (audit D-4)`;
const r2Ffp = FFP.flatMap(([s, line, imp, pk]) => [
  { id: `b-r2-ffp01-${s}-imports`, doc: D2, line, what: `FF-P01 repro shape ${s}: IMPORTS from the domain file`, stated: imp },
  { id: `b-r2-ffp01-${s}-packages`, doc: D2, line, what: `FF-P01 repro shape ${s}: Package nodes`, stated: pk },
].map((x) => ({ ...x, note: FFP_NOTE })));

async function r2ScoreValues(ctx) {
  const S = scored(ctx); const R = S.r2;
  const out = { ...noteValues(ctx, 'b-r2') };
  for (const [, lab, pos, stratum, ...st] of R2_TABLE) {
    const b = pos ? R.perOperator.find((p) => p.positive === pos)[stratum] : R.pooled[stratum];
    R2_KEYS.forEach((k, i) => { if (st[i] !== null) out[`b-r2-t3-${lab}-${k}`] = typeof b[k] === 'number' ? String(b[k]) : fmtLike(st[i], b[k]); });
  }
  for (const [s, k] of [['e1', 'operator'], ['ref', 'hand-planted'], ['comb', 'combined']]) {
    out[`b-r2-clean-${s}-units`] = R.clean[k].unitFalseFail; out[`b-r2-clean-${s}-bases`] = R.clean[k].baseFalseFail;
  }
  const r12 = R.rounds12OperatorSeeds;
  out['b-r2-r12-repo'] = `REPO-BYPASS ${short(r12['AP-REPO-BYPASS'])}`;
  out['b-r2-r12-dup'] = `DUP-RULE ${r12['AP-DUP-RULE']}`;
  out['b-r2-r12-fat'] = `FAT-CONTROLLER ${short(r12['AP-FAT-CONTROLLER'])}`;
  out['b-r2-r12-pd'] = `PERSIST-IN-DOMAIN ${short(r12['AP-PERSIST-IN-DOMAIN'])}`;
  out['b-r2-r12-fl'] = `FRAMEWORK-LEAK ${r12['AP-FRAMEWORK-LEAK']}`;
  out['b-r2-r12-pooled'] = `pooled ${r12.pooled}`;
  const rows = R.rows.filter((r) => r.judged);
  const dupn = rows.filter((r) => r.operatorId === 'AP-DUP-RULEn');
  out['b-r2-dupn-fail'] = String(dupn.filter((r) => r.unitFail).length);
  out['b-r2-dupn-paired'] = String(dupn.filter((r) => r.units.some((u) => u.verdict === 'fail' && u.base !== 'fail')).length);
  const r1dupn = S.r1.rows.filter((r) => r.judged && r.operatorId === 'AP-DUP-RULEn');
  out['b-r2-dupn-r1'] = `${r1dupn.filter((r) => r.unitFail).length}/${r1dupn.length}`;
  out['b-r2-dupn-e1'] = `${dupn.filter((r) => r.unitFail).length}/${dupn.length}`;
  const dupOp = R.perOperator.find((p) => p.positive === 'AP-DUP-RULE').operator;
  const flC = R.perOperator.find((p) => p.positive === 'AP-FRAMEWORK-LEAK').combined;
  out['b-r2-dup-catch'] = short(dupOp.catch);
  out['b-r2-fl-comb'] = flC.catch; out['b-r2-fl-twin'] = short(flC.twinFalseFail);
  const eo = entriesOf(ctx, 'r2');
  const misses = rows.filter((r) => r.role === 'seed' && !r.catch);
  const e1miss = misses.filter((r) => r.stratum === 'operator');
  const runsOf = (r) => (eo.get(r.rowId) ?? []).filter((e) => r.units.some((u) => u.unit === e.unitId) && e.functionId === r.probedFunction);
  const man = manifest(ctx, 'r2').rows;
  const site = (id) => man.find((x) => x.rowId === id)?.site?.filePath ?? '';
  out['b-r2-miss-both'] = e1miss.length === 2 && e1miss.every((r) => r.operatorId === 'AP-FRAMEWORK-LEAK') ? `Both (${e1miss.map((r) => site(r.rowId).split('/').pop()).sort().join(', ')})` : `${e1miss.length}`;
  out['b-r2-miss-both'] = out['b-r2-miss-both'] === 'Both (AdvanceOrderUseCase.ts, CancelOrderUseCase.ts)' ? 'Both' : out['b-r2-miss-both'];
  const conf = e1miss.flatMap(runsOf).map((e) => (e.parsedVerdict.pass ? e.parsedVerdict.confidence : NaN));
  out['b-r2-miss-conf'] = `${Math.min(...conf).toFixed(2)} to ${Math.max(...conf).toFixed(2)}`;
  const hex07 = misses.find((r) => r.operatorId.includes('hexagonal/v07'));
  out['b-r2-hex07-runs'] = String(hex07 ? runsOf(hex07).filter((e) => e.parsedVerdict.pass).length : 0);
  const pdhp = rows.filter((r) => r.role === 'seed' && r.stratum === 'hand-planted' && r.positiveId === 'AP-PERSIST-IN-DOMAIN');
  out['b-r2-pd-hp'] = pdhp.every((r) => r.catch) ? String(pdhp.length) : `${pdhp.filter((r) => r.catch).length} of ${pdhp.length}`;
  out['b-r2-clean-low'] = short(R.clean.combined.unitFalseFail);
  const dto = runsFor(ctx, 'r2', 'base:e1/claude-haiku-4-5.order-fulfilment.minimal-prose.run-2', 'FF-N01', 'src/application/usecases').filter((e) => !e.parsedVerdict.pass && /OrderDto/.test(textOf(e)));
  out['b-r2-clean-dto'] = `All ${dto.length} runs`;
  out['b-r2-s2-e1'] = short(R.pooled.operator.symbolicS2);
  const hp = rows.filter((r) => r.role === 'seed' && r.stratum === 'hand-planted');
  out['b-r2-hp-ffp01'] = String(hp.filter((r) => (r.symbolicNewRows ?? []).some((k) => k.startsWith('FF-P01|'))).length);
  out['b-r2-hp-blocking'] = hp.every((r) => r.blockingVerdict === 'fail' && r.baseBlockingVerdict !== 'fail') ? 'Each one' : `${hp.filter((r) => r.blockingVerdict === 'fail').length} of ${hp.length}`;
  const P = R.pooled;
  const lb = (t) => t.split('[')[1].split(',')[0];
  out['b-r2-exit-point'] = `${P.combined.catch.split(' = ')[1].split(' ')[0]} (combined, n = ${P.combined.seeds})`;
  out['b-r2-exit-lb'] = `${lb(P.combined.catch)} combined, ${lb(P.operator.catch)} for the operator stratum and ${lb(P['hand-planted'].catch)} for the hand-planted stratum`;
  out['b-r2-exit-fl'] = `${flC.catch.split(' = ')[1].split(' ')[0]} with a lower bound of ${lb(flC.catch)}`;
  const pdC = R.perOperator.find((p) => p.positive === 'AP-PERSIST-IN-DOMAIN').combined;
  out['b-r2-informative'] = String(flC.seeds + pdC.seeds);
  out['b-r2-informative-fl'] = `${short(flC.catch)} FRAMEWORK-LEAK`;
  out['b-r2-informative-pd'] = `${short(pdC.catch)} PERSIST-IN-DOMAIN`;
  const k = (t) => Number(short(t).split('/')[0]);
  out['b-r2-informative-pool'] = ctx.cell(k(flC.catch) + k(pdC.catch), flC.seeds + pdC.seeds);
  const s1 = pdhp.filter((r) => (r.symbolicNewRows ?? []).some((x) => x.startsWith('FF-P01|'))).length;
  out['b-r2-s1-hp'] = `S1 ${s1}/${pdhp.length}`;
  out['b-r2-bothcatch'] = `judge ${pdhp.filter((r) => r.catch).length}/${pdhp.length}, FF-P01 ${s1}/${pdhp.length}`;
  return out;
}

const V1_FILES = ['Docs/operator-catalogue-antipatterns.md', 'scripts/lib/mutation/antipatterns/index.ts', 'scripts/lib/mutation/antipatterns/common.ts',
  'scripts/lib/mutation/antipatterns/ap-repo-bypass.ts', 'scripts/lib/mutation/antipatterns/ap-fat-controller.ts', 'scripts/lib/mutation/antipatterns/ap-persist-in-domain.ts',
  'scripts/lib/mutation/antipatterns/ap-dup-rule.ts', 'scripts/lib/mutation/antipatterns/ap-framework-leak.ts', 'scripts/lib/mutation/registry.ts',
  'scripts/lib/mutation/types.ts', 'scripts/lib/mutation/sites.ts'];
const frozenTable = (ctx) => once('frozenTable', () => {
  const rows = {};
  for (const line of ctx.read(DF).split('\n')) { const m = /^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/.exec(line); if (m && !(m[1] in rows)) rows[m[1]] = m[2]; }
  return rows;
});

async function r2RunValues(ctx) {
  const c = runCounts(ctx, 'r2');
  const m = manifest(ctx, 'r2');
  const ft = frozenTable(ctx);
  const sum = (o) => m.summary.find((s) => s.operatorId === o);
  const rej = (o) => m.rows.filter((r) => r.operatorId === o && r.status === 'typecheck').length;
  const ok = (o) => m.rows.filter((r) => r.operatorId === o && r.status === 'ok').length;
  const out = {
    'b-r2-hashes': String(V1_FILES.filter((f) => shaAt(ctx, 'a06532d3', f) === ft[f]).length),
    'b-r2-rubric': pre8(shaAt(ctx, 'a06532d3', 'src/llm-critic/rubric.ts')), 'b-r2-frozents': pre8(shaAt(ctx, 'a06532d3', 'src/llm-critic/frozen.ts')),
    'b-r2-digest': pre8end4(registryDigest(ctx, 'a06532d3')), 'b-r2-runsperunit': c.runsPerUnit,
    'b-r2-cells-hdr': String(m.e1Cells), 'b-r2-cells': String(m.e1Cells),
  };
  for (const [s, o] of [['repo', 'AP-REPO-BYPASS'], ['fat', 'AP-FAT-CONTROLLER'], ['pd', 'AP-PERSIST-IN-DOMAIN'], ['dup', 'AP-DUP-RULE'], ['fl', 'AP-FRAMEWORK-LEAK']]) {
    const x = sum(o);
    out[`b-r2-s-${s}-cells`] = `${x.cellsWithSites} of ${m.e1Cells}`;
    out[`b-r2-s-${s}-elig`] = `${x.eligible} / ${x.candidates}`;
    out[`b-r2-s-${s}-seeded`] = rej(o) ? `${ok(o)} (${rej(o)} draws rejected at type-check)` : String(ok(o));
  }
  out['b-r2-s-pd-rej'] = Object.entries(sum('AP-PERSIST-IN-DOMAIN').rejected).map(([k, v]) => `${k} ${v}`).join(', ');
  for (const [s, o] of [['dupn', 'AP-DUP-RULEn'], ['fln', 'AP-FRAMEWORK-LEAKn'], ['pdn', 'AP-PERSIST-IN-DOMAINn'], ['fatn', 'AP-FAT-CONTROLLERn']]) {
    const x = sum(o);
    out[`b-r2-s-${s}-cells`] = String(x.cellsWithSites);
    out[`b-r2-s-${s}-elig`] = `${x.eligible} / ${x.candidates}`;
    const opOk = m.rows.filter((r) => r.operatorId === o && r.status === 'ok' && r.stratum === 'operator').length;
    out[`b-r2-s-${s}-seeded`] = rej(o) ? `${opOk} twins (${rej(o)} draws rejected at type-check)` : `${opOk} twins`;
  }
  const opRows = m.rows.filter((r) => r.stratum === 'operator' && r.status === 'ok');
  const twins = opRows.filter((r) => r.role === 'twin');
  out['b-r2-s-same-site'] = `${twins.filter((r) => r.twinMatch === 'same-site').length} same-site`;
  out['b-r2-s-same-file'] = `${twins.filter((r) => r.twinMatch === 'same-file').length} same-file`;
  const seeds = opRows.filter((r) => r.role === 'seed');
  const dupSeeds = seeds.filter((r) => r.operatorId === 'AP-DUP-RULE');
  out['b-r2-s-notwin'] = String(dupSeeds.filter((s) => !twins.some((t) => t.twinOf === s.rowId)).length);
  out['b-r2-s-twins-left'] = String(twins.filter((t) => t.operatorId === 'AP-DUP-RULEn').length);
  out['b-r2-s-spread'] = `${seeds.length} seeds over ${new Set(seeds.map((r) => r.cell)).size} cells`;
  const cnt = (re) => seeds.filter((r) => re.test(r.cell)).length;
  out['b-r2-s-models'] = `sonnet ${cnt(/^claude-sonnet/)}, opus ${cnt(/^claude-opus/)}, haiku ${cnt(/^claude-haiku/)}, gpt-5.6-terra ${cnt(/^gpt-5\.6-terra/)}`;
  out['b-r2-s-tasks'] = `order-fulfilment ${cnt(/\.order-fulfilment\./)}, task-management ${cnt(/\.task-management\./)}`;
  out['b-r2-s-dup-app'] = dupSeeds.every((r) => r.site.filePath.startsWith('src/application')) ? String(dupSeeds.length) : `${dupSeeds.filter((r) => r.site.filePath.startsWith('src/application')).length}`;
  out['b-r2-s-dup-of'] = String(dupSeeds.filter((r) => r.cell.includes('.order-fulfilment.')).length);
  out['b-r2-s-dup-sonnet'] = String(dupSeeds.filter((r) => r.cell.startsWith('claude-sonnet-5-5')).length);
  const hpRows = m.rows.filter((r) => r.stratum !== 'operator' && r.status === 'ok');
  out['b-r2-s-hp-twin'] = word(hpRows.filter((r) => r.role === 'twin').length);
  out['b-r2-s-hp-tsc'] = String(hpRows.filter((r) => r.role === 'seed' && r.typecheckErrors.length === 0).length);
  out['b-r2-s-diffs'] = String(c.diffs); out['b-r2-diffs2'] = String(c.diffs);
  const refStyles = new Set(plan(ctx, 'r2').targets.filter((t) => t.kind === 'clean' && !t.id.startsWith('base:e1/')).map((t) => t.id));
  out['b-r2-evaluated'] = `${c.targets}: ${c.clean} clean bases (${c.clean - refStyles.size} E1 cells, ${refStyles.size} reference styles), ${c.seeds} seeds, ${c.twins} twins`;
  out['b-r2-units'] = `${c.units} (${c.cleanUnits} clean, ${c.otherUnits} seed or twin)`;
  out['b-r2-dry'] = `${c.dry.projectedCalls} (${c.dry.entries} entries + ${c.dry.initProbes} init probes)`;
  out['b-r2-calls'] = String(c.calls);
  out['b-r2-judgecalls'] = c.attempts === c.entries ? String(c.attempts) : `${c.attempts} (cassettes ${c.entries})`;
  out['b-r2-attempts'] = c.allValid ? String(c.maxAttempts) : `${c.maxAttempts} (not all valid)`;
  out['b-r2-probes'] = String(c.probes);
  out['b-r2-replay-same'] = voteReplay(ctx, 'r2');
  out['b-r2-scrub'] = scrubHits(ctx, [ROUND.r2.cas, `${RC}/round2/reports`]);
  out['b-r2-reports'] = String(c.reports);
  return out;
}

async function r2FfpValues(ctx) {
  const dir = ctx.out('b-r2-ffp01');
  const txt = ctx.sh(`${tsx} scripts/v1.3/judge-catch2-ffp01-repro.ts "${dir}"`, { cwd: treeAt(ctx, FFP_COMMIT) });
  const out = {};
  for (const [s] of FFP) {
    const block = txt.split('\n').reduce((acc, l) => { if (/^[A-D] /.test(l)) acc.cur = l[0]; else if (acc.cur === s) acc.lines.push(l); return acc; }, { cur: '', lines: [] }).lines;
    const arr = (re) => JSON.parse(block.find((l) => re.test(l)).split(': ').slice(1).join(': '));
    const imp = arr(/IMPORTS from/); const pk = arr(/Package nodes/);
    out[`b-r2-ffp01-${s}-imports`] = imp.length ? imp.join(', ') : 'none';
    out[`b-r2-ffp01-${s}-packages`] = pk.length ? pk.join(', ') : 'none';
  }
  return out;
}

// ---- DUP-RULE v2 ---------------------------------------------------------------------------------------------------
const DV2_T3 = [
  [84, 'fixture', ['1', '1/1', '1/1', '1', '0/1', '0/1']],
  [85, 'e1', ['8', '8/8 = 1.00 [0.68, 1.00]', '7/8 = 0.88 [0.53, 0.98]', '8', '2/8 = 0.25 [0.07, 0.59]', '1/8 = 0.13 [0.02, 0.47]']],
  [86, 'combined', ['9', '9/9 = 1.00 [0.70, 1.00]', '8/9 = 0.89 [0.57, 0.98]', '9', '2/9 = 0.22 [0.06, 0.55]', '1/9 = 0.11 [0.02, 0.43]']],
];
const DV2_KEYS = ['seeds', 'catch', 'pairedCatch', 'twins', 'twinFalseFail', 'twinFalseFailPaired'];
const dv2Scores = [
  ...noteNumbers('b-dv2', D3),
  ...DV2_T3.flatMap(([line, s, st]) => st.map((v, i) => ({ id: `b-dv2-t3-${s}-${DV2_KEYS[i]}`, doc: D3, line, what: `§3 ${s} ${DV2_KEYS[i]}`, stated: v }))),
  { id: 'b-dv2-host-domain', doc: D3, line: 88, what: 'twin false fail, domain host (paired)', stated: 'domain 1/4 (paired 1/4)' },
  { id: 'b-dv2-host-own', doc: D3, line: 88, what: 'twin false fail, own-file host (paired)', stated: 'own file 1/5 (paired 0/5)' },
  ...['fixture', 'e1', 'combined', 'paired'].map((c, i) => ({ id: `b-dv2-v1twin-${c}`, doc: D3, line: 94, what: `v1 AP-DUP-RULEn twin false fail, ${c}`, stated: ['1/1', '5/5', '6/6 = 1.00 [0.61, 1.00]', '5/6'][i] })),
  ...['fixture', 'e1', 'combined', 'paired'].map((c, i) => ({ id: `b-dv2-v2twin-${c}`, doc: D3, line: 95, what: `v2 AP-DUP-RULE2n twin false fail, ${c}`, stated: ['0/1', '2/8', '2/9 = 0.22 [0.06, 0.55]', '1/9'][i] })),
  { id: 'b-dv2-both-cells', doc: D3, line: 97, what: 'E1 cells with both a v1 and a v2 twin', stated: 'the 5 E1 cells' },
  { id: 'b-dv2-stock-runs', doc: D3, line: 111, what: 'runs failing sonnet full-aac run-1 src/domain that cite StockAllocationService.reserve', stated: 'All 3 runs', basis: 'replayed' },
  { id: 'b-dv2-inline-runs', doc: D3, line: 136, what: 'runs on the sonnet full-aac run-1 twin citing the inline isOrderStatus check of AdvanceOrderUseCase', stated: 'all 3 runs', basis: 'replayed' },
  { id: 'b-dv2-belong', doc: D3, line: 142, what: 'seeds whose first-run violation says the method does not belong (regex belong|not fit|does not match|puts…in|unrelated)', stated: 'All 9 also say', basis: 'replayed' },
  { id: 'b-dv2-both-v1', doc: D3, line: 98, what: 'v1 twins failing on the 5 E1 cells with both twins', stated: 'v1 failed 5/5' },
  { id: 'b-dv2-both-v2', doc: D3, line: 99, what: 'v2 twins failing on those cells', stated: 'v2 failed 1/5' },
  ...[['fixture', 105, '0/2', '0/1'], ['e1', 106, '2/12 = 0.17 [0.05, 0.45]', '2/8 = 0.25 [0.07, 0.59]'], ['combined', 107, '2/14 = 0.14 [0.04, 0.40]', '2/9 = 0.22 [0.06, 0.55]']]
    .flatMap(([s, line, u, b]) => [{ id: `b-dv2-clean-${s}-units`, doc: D3, line, what: `clean ${s}: failing units`, stated: u }, { id: `b-dv2-clean-${s}-bases`, doc: D3, line, what: `clean ${s}: failing bases`, stated: b }]),
  { id: 'b-dv2-s2-seeds', doc: D3, line: 114, what: 'S2 on seeds', stated: 'S2 0/9 for seeds' },
  { id: 'b-dv2-s2-twins', doc: D3, line: 114, what: 'S2 on twins', stated: '0/9 for twins' },
  ...[['seedsAll', 124, '30/35 = 0.86 [0.71, 0.94]'], ['seedsOperatorOnly', 125, '23/27 = 0.85 [0.68, 0.94]'], ['dup', 126, '9/9 = 1.00 [0.70, 1.00]'], ['twinFalseFail', 127, null]]
    .flatMap(([k, line, v]) => ['v1', 'v2'].map((w) => ({ id: `b-dv2-pool-${k}-${w}`, doc: D3, line, what: `pooled across rounds, ${k}, with ${w}`, stated: v ?? (w === 'v1' ? '8/47 = 0.17 [0.09, 0.30]' : '4/50 = 0.08 [0.03, 0.19]') }))),
  ...[['fl', 'FRAMEWORK-LEAK 12/17'], ['pd', 'PERSIST-IN-DOMAIN 4/4'], ['repo', 'REPO-BYPASS 4/4'], ['fat', 'FAT-CONTROLLER 1/1']]
    .map(([s, v]) => ({ id: `b-dv2-other-${s}`, doc: D3, line: 129, what: `other positives pooled, ${s}`, stated: v })),
  { id: 'b-dv2-dup-both', doc: D3, line: 130, what: 'DUP-RULE positive, both versions', stated: '9/9' },
  { id: 'b-dv2-share-before', doc: D3, line: 131, what: 'DUP-RULE share of pooled twin fails, v1', stated: '6 of 8 before' },
  { id: 'b-dv2-share-after', doc: D3, line: 131, what: 'DUP-RULE share of pooled twin fails, v2', stated: '2 of 4 after' },
  { id: 'b-dv2-share-paired', doc: D3, line: 131, what: 'of which paired', stated: 'of which 1 is paired' },
  { id: 'b-dv2-relocation', doc: D3, line: 135, what: 'v2 twins passing', stated: '7/9' },
  { id: 'b-dv2-paired-twin', doc: D3, line: 139, what: 'pooled paired twin false-fail rate', stated: '1/9' },
  { id: 'b-dv2-seeds-fail', doc: D3, line: 141, what: 'seeds failing', stated: 'All 9' },
  { id: 'b-dv2-v1-foreign', doc: D3, line: 143, what: 'round 2: foreign method alone (v1 twin) fails', stated: '5/5' },
  { id: 'b-dv2-strict-seeds', doc: D3, line: 146, what: 'strict construct flag (>= 2 runs), seeds', stated: '4/9 seeds' },
  { id: 'b-dv2-strict-twins', doc: D3, line: 146, what: 'strict construct flag (>= 2 runs), twins', stated: '0/9 twins' },
  { id: 'b-dv2-dupcited-seeds', doc: D3, line: 147, what: 'duplicationCited, seeds', stated: '9/9 for seeds' },
  { id: 'b-dv2-dupcited-twins', doc: D3, line: 147, what: 'duplicationCited, twins', stated: '9/9 for twins' },
  { id: 'b-dv2-retest', doc: D3, line: 148, what: 'E1 seeds failing in both round 2 and v2', stated: '8/8' },
  { id: 'b-dv2-t5-judge-seeds', doc: D3, line: 159, what: '§5 judge seeds', stated: '9' },
  { id: 'b-dv2-t5-judge-catch', doc: D3, line: 159, what: '§5 judge catch', stated: '9/9 = 1.00 [0.70, 1.00]' },
  { id: 'b-dv2-t5-judge-twin', doc: D3, line: 159, what: '§5 judge twin false fail raw / paired', stated: '2/9 / 1/9' },
  { id: 'b-dv2-t5-judge-clean', doc: D3, line: 159, what: '§5 judge clean false fail', stated: '2/14 units' },
  { id: 'b-dv2-t5-sym-seeds', doc: D3, line: 163, what: '§5 symbolic seeds', stated: '9' },
  { id: 'b-dv2-t5-sym-catch', doc: D3, line: 163, what: '§5 symbolic S2 catch', stated: '0/9' },
  { id: 'b-dv2-t5-sym-twin', doc: D3, line: 163, what: '§5 symbolic S2 on twins', stated: '0/9' },
];

async function dv2ScoreValues(ctx) {
  const S = scored(ctx); const V = S.dv2;
  const out = { ...noteValues(ctx, 'b-dv2') };
  for (const [, s, st] of DV2_T3) DV2_KEYS.forEach((k, i) => { const v = V.strata[s][k]; out[`b-dv2-t3-${s}-${k}`] = typeof v === 'number' ? String(v) : fmtLike(st[i], v); });
  const h = V.twinsByHost;
  out['b-dv2-host-domain'] = `domain ${short(h.domain.twinFalseFail)} (paired ${short(h.domain.twinFalseFailPaired)})`;
  out['b-dv2-host-own'] = `own file ${short(h.own.twinFalseFail)} (paired ${short(h.own.twinFalseFailPaired)})`;
  const paired = (r) => r.units.some((u) => u.verdict === 'fail' && u.base !== 'fail');
  const v1t1 = S.r1.rows.filter((r) => r.judged && r.operatorId === 'AP-DUP-RULEn');
  const v1t2 = S.r2.rows.filter((r) => r.judged && r.operatorId === 'AP-DUP-RULEn');
  const v1all = [...v1t1, ...v1t2];
  out['b-dv2-v1twin-fixture'] = `${v1t1.filter((r) => r.unitFail).length}/${v1t1.length}`;
  out['b-dv2-v1twin-e1'] = `${v1t2.filter((r) => r.unitFail).length}/${v1t2.length}`;
  out['b-dv2-v1twin-combined'] = ctx.cell(v1all.filter((r) => r.unitFail).length, v1all.length);
  out['b-dv2-v1twin-paired'] = `${v1all.filter(paired).length}/${v1all.length}`;
  out['b-dv2-v2twin-fixture'] = short(V.strata.fixture.twinFalseFail);
  out['b-dv2-v2twin-e1'] = short(V.strata.e1.twinFalseFail);
  out['b-dv2-v2twin-combined'] = V.strata.combined.twinFalseFail;
  out['b-dv2-v2twin-paired'] = short(V.strata.combined.twinFalseFailPaired);
  const v2tw = V.rows.filter((r) => r.role === 'twin');
  const cells = new Set(v1t2.map((r) => r.baseId));
  const both = v2tw.filter((r) => cells.has(r.baseId));
  out['b-dv2-both-cells'] = `the ${cells.size} E1 cells`;
  const sfa1 = 'e1/claude-sonnet-5-5.order-fulfilment.full-aac.run-1';
  out['b-dv2-stock-runs'] = `All ${runsFor(ctx, 'dv2', `base:${sfa1}`, 'FF-N01', 'src/domain').filter((e) => !e.parsedVerdict.pass && /StockAllocationService/.test(textOf(e)) && /reserve/.test(textOf(e))).length} runs`;
  out['b-dv2-inline-runs'] = `all ${runsFor(ctx, 'dv2', 'e1__claude-sonnet-5-5.order-fulfilment.full-aac.run-1__AP-DUP-RULE2n__0', 'FF-N01', 'src/application').filter((e) => /isOrderStatus/.test(textOf(e)) && /AdvanceOrderUseCase/.test(textOf(e))).length} runs`;
  const firstRun = V.rows.filter((r) => r.role === 'seed').map((r) => (entriesOf(ctx, 'dv2').get(r.rowId) ?? []).find((e) => e.runIndex === 0 && e.parsedVerdict));
  const belong = firstRun.filter((e) => e && (e.parsedVerdict.violations ?? []).some((v) => /belong|not fit|n't fit|does not match|puts .* (in|into|inside) |unrelated/i.test(v.message))).length;
  out['b-dv2-belong'] = belong === firstRun.length ? `All ${belong} also say` : `${belong} of ${firstRun.length}`;
  out['b-dv2-both-v1'] = `v1 failed ${v1t2.filter((r) => r.unitFail).length}/${v1t2.length}`;
  out['b-dv2-both-v2'] = `v2 failed ${both.filter((r) => r.unitFail).length}/${both.length}`;
  for (const s of ['fixture', 'e1', 'combined']) {
    const fl = (t) => (/ = /.test(t) && s !== 'fixture' ? t : short(t));
    out[`b-dv2-clean-${s}-units`] = fl(V.clean[s].unitFalseFail); out[`b-dv2-clean-${s}-bases`] = fl(V.clean[s].baseFalseFail);
  }
  const seeds = V.rows.filter((r) => r.role === 'seed');
  out['b-dv2-s2-seeds'] = `S2 ${short(V.strata.combined.symbolicS2)} for seeds`;
  out['b-dv2-s2-twins'] = `${v2tw.filter((r) => r.symbolicS2).length}/${v2tw.length} for twins`;
  const pa = V.pooledAcrossRounds;
  for (const [k, w, src] of [['seedsAll', 'v1', pa.withV1DupRule], ['seedsAll', 'v2', pa.withV2DupRule], ['seedsOperatorOnly', 'v1', pa.withV1DupRule], ['seedsOperatorOnly', 'v2', pa.withV2DupRule], ['twinFalseFail', 'v1', pa.withV1DupRule], ['twinFalseFail', 'v2', pa.withV2DupRule]]) out[`b-dv2-pool-${k}-${w}`] = src[k];
  out['b-dv2-pool-dup-v1'] = pa.withV1DupRule.perPositive['AP-DUP-RULE'];
  out['b-dv2-pool-dup-v2'] = pa.withV2DupRule.perPositive['AP-DUP-RULE2'];
  const pp = pa.withV1DupRule.perPositive;
  out['b-dv2-other-fl'] = `FRAMEWORK-LEAK ${short(pp['AP-FRAMEWORK-LEAK'])}`; out['b-dv2-other-pd'] = `PERSIST-IN-DOMAIN ${short(pp['AP-PERSIST-IN-DOMAIN'])}`;
  out['b-dv2-other-repo'] = `REPO-BYPASS ${short(pp['AP-REPO-BYPASS'])}`; out['b-dv2-other-fat'] = `FAT-CONTROLLER ${short(pp['AP-FAT-CONTROLLER'])}`;
  out['b-dv2-dup-both'] = short(pp['AP-DUP-RULE']) === short(pa.withV2DupRule.perPositive['AP-DUP-RULE2']) ? short(pp['AP-DUP-RULE']) : 'differs';
  const k = (t) => Number(short(t).split('/')[0]);
  out['b-dv2-share-before'] = `${v1all.filter((r) => r.unitFail).length} of ${k(pa.withV1DupRule.twinFalseFail)} before`;
  out['b-dv2-share-after'] = `${v2tw.filter((r) => r.unitFail).length} of ${k(pa.withV2DupRule.twinFalseFail)} after`;
  out['b-dv2-share-paired'] = `of which ${v2tw.filter(paired).length} is paired`;
  out['b-dv2-relocation'] = `${v2tw.filter((r) => !r.unitFail).length}/${v2tw.length}`;
  out['b-dv2-paired-twin'] = short(V.strata.combined.twinFalseFailPaired);
  out['b-dv2-seeds-fail'] = seeds.every((r) => r.unitFail) ? `All ${seeds.length}` : `${seeds.filter((r) => r.unitFail).length}`;
  out['b-dv2-v1-foreign'] = `${v1t2.filter((r) => r.unitFail).length}/${v1t2.length}`;
  out['b-dv2-strict-seeds'] = `${seeds.filter((r) => r.constructFlagMajority).length}/${seeds.length} seeds`;
  out['b-dv2-strict-twins'] = `${v2tw.filter((r) => r.constructFlagMajority).length}/${v2tw.length} twins`;
  out['b-dv2-dupcited-seeds'] = `${short(V.strata.combined.seedDuplicationCited)} for seeds`;
  out['b-dv2-dupcited-twins'] = `${short(V.strata.combined.twinDuplicationCited)} for twins`;
  const r2dup = S.r2.rows.filter((r) => r.judged && r.operatorId === 'AP-DUP-RULE');
  const e1seeds = seeds.filter((r) => r.stratum === 'e1');
  const same = e1seeds.filter((r) => r.unitFail && r2dup.some((x) => x.baseId === r.baseId && x.unitFail)).length;
  out['b-dv2-retest'] = `${same}/${e1seeds.length}`;
  out['b-dv2-t5-judge-seeds'] = String(seeds.length);
  out['b-dv2-t5-judge-catch'] = V.strata.combined.catch;
  out['b-dv2-t5-judge-twin'] = `${short(V.strata.combined.twinFalseFail)} / ${short(V.strata.combined.twinFalseFailPaired)}`;
  out['b-dv2-t5-judge-clean'] = `${short(V.clean.combined.unitFalseFail)} units`;
  out['b-dv2-t5-sym-seeds'] = String(seeds.length);
  out['b-dv2-t5-sym-catch'] = short(V.strata.combined.symbolicS2);
  out['b-dv2-t5-sym-twin'] = `${v2tw.filter((r) => r.symbolicS2).length}/${v2tw.length}`;
  return out;
}

const dv2Run = [
  { id: 'b-dv2-v1hash', doc: D3, line: 19, what: 'sha256 ap-dup-rule.ts at the v2 freeze 827d9ace', stated: 'dda3accc…' },
  { id: 'b-dv2-ten', doc: D3, line: 20, what: 'v1 registry entries (FROZEN_V1_OPERATORS)', stated: 'ten' },
  { id: 'b-dv2-host-domain-n', doc: D3, line: 23, what: 'domain-host twins of all twins', stated: '4 of the 9' },
  { id: 'b-dv2-host-own-n', doc: D3, line: 24, what: 'own-file-host twins', stated: '5' },
  { id: 'b-dv2-dupcells', doc: D3, line: 26, what: 'E1 cells with DUP-RULE sites', stated: '16' },
  { id: 'b-dv2-scan', doc: D3, line: 26, what: 'label-free option-1 scan: matches over parameter rules', stated: '0 matches over 24 rules', needs: 'not-checkable', note: 'no raw output of the scan is committed (PR #117 #37)' },
  { id: 'b-dv2-cat', doc: D3, line: 28, what: 'sha256 catalogue at 827d9ace', stated: '3cc3d03c…' },
  { id: 'b-dv2-index', doc: D3, line: 29, what: 'sha256 antipatterns/index.ts at 827d9ace', stated: 'c1eef5d3…' },
  { id: 'b-dv2-v2hash', doc: D3, line: 30, what: 'sha256 ap-dup-rule-v2.ts at 827d9ace', stated: '72342a9e…' },
  { id: 'b-dv2-digest', doc: D3, line: 32, what: 'combined v2 digest at 827d9ace', stated: 'afe879b5…' },
  { id: 'b-dv2-ten2', doc: D3, line: 33, what: 'entries read by the round 1/2 seeders (FROZEN_V1_OPERATORS)', stated: 'ten' },
  { id: 'b-dv2-rubric', doc: D3, line: 34, what: 'sha256 rubric.ts at 827d9ace', stated: '52960e02…' },
  { id: 'b-dv2-frozents', doc: D3, line: 34, what: 'sha256 frozen.ts at 827d9ace', stated: 'b6301b67…' },
  { id: 'b-dv2-runsperunit', doc: D3, line: 34, what: 'runs per unit in every report', stated: '3' },
  { id: 'b-dv2-env-swap', doc: D3, line: 36, what: 'swap in use', stated: '11.4 to 12.5 of 16 GB', needs: 'not-checkable', note: 'environment observation' },
  { id: 'b-dv2-env-free', doc: D3, line: 36, what: 'memory_pressure free', stated: '34 to 52%', needs: 'not-checkable', note: 'environment observation' },
  { id: 'b-dv2-newtests', doc: D3, line: 37, what: 'tests added to antipatterns.test.ts between 95637b75 and 827d9ace', stated: 'Three' },
  { id: 'b-dv2-fx-sites', doc: D3, line: 42, what: 'antipattern-nest eligible sites', stated: 'All eligible sites: 1' },
  { id: 'b-dv2-cells', doc: D3, line: 43, what: 'accepted E1 cells', stated: '65' },
  { id: 'b-dv2-t1-fx-cells', doc: D3, line: 47, what: '§1 fixture cells with a site', stated: '1' },
  { id: 'b-dv2-t1-e1-cells', doc: D3, line: 47, what: '§1 E1 cells with a site', stated: '16 of 65' },
  { id: 'b-dv2-t1-fx-elig', doc: D3, line: 48, what: '§1 fixture eligible / candidates', stated: '1 / 1' },
  { id: 'b-dv2-t1-e1-elig', doc: D3, line: 48, what: '§1 E1 eligible / candidates', stated: '110 / 110' },
  { id: 'b-dv2-t1-fx-host', doc: D3, line: 49, what: '§1 fixture twin host plan', stated: 'own 1' },
  { id: 'b-dv2-t1-e1-host', doc: D3, line: 49, what: '§1 E1 twin host plan', stated: 'domain 27, own 83' },
  { id: 'b-dv2-t1-fx-rej', doc: D3, line: 50, what: '§1 fixture positive draws rejected at tsc', stated: '0' },
  { id: 'b-dv2-t1-e1-rej', doc: D3, line: 50, what: '§1 E1 positive draws rejected at tsc', stated: '10, all in one opus cell' },
  { id: 'b-dv2-t1-fx-seeds', doc: D3, line: 51, what: '§1 fixture seeds', stated: '1' },
  { id: 'b-dv2-t1-e1-seeds', doc: D3, line: 51, what: '§1 E1 seeds', stated: '8' },
  { id: 'b-dv2-t1-fx-twins', doc: D3, line: 52, what: '§1 fixture twins', stated: '1' },
  { id: 'b-dv2-t1-e1-twins', doc: D3, line: 52, what: '§1 E1 twins (and round 2 v1 twins)', stated: "8, 0 rejected (round 2's v1 twin: 5, with 19 rejected)" },
  { id: 'b-dv2-sameedits', doc: D3, line: 54, what: 'E1 seed diffs whose +/- lines equal round 2\'s DUP-RULE seed diff', stated: 'all 8 diffs' },
  { id: 'b-dv2-hosts', doc: D3, line: 55, what: 'twin hosts', stated: 'domain 4, own file 5' },
  { id: 'b-dv2-r2rej', doc: D3, line: 56, what: 'round 2 v1-twin draws lost at tsc', stated: '19' },
  { id: 'b-dv2-diffs', doc: D3, line: 57, what: 'diffs committed', stated: '18 files' },
  { id: 'b-dv2-evaluated', doc: D3, line: 68, what: 'evaluated projects', stated: '27: 9 bases, 9 seeds, 9 twins' },
  { id: 'b-dv2-units', doc: D3, line: 69, what: 'judged units', stated: '36' },
  { id: 'b-dv2-dry', doc: D3, line: 70, what: 'mock dry count', stated: '135 (108 entries + 27 init probes)' },
  { id: 'b-dv2-calls', doc: D3, line: 71, what: 'live calls', stated: '135' },
  { id: 'b-dv2-judgecalls', doc: D3, line: 71, what: 'judge calls', stated: '108' },
  { id: 'b-dv2-attempts', doc: D3, line: 71, what: 'attempts of every entry', stated: '1' },
  { id: 'b-dv2-probes', doc: D3, line: 71, what: 'init probes', stated: '27' },
  { id: 'b-dv2-replay-ok', doc: D3, line: 72, what: '`replay` of all targets', stated: '27/27', needs: 'needs-Neo4j', note: 'replay runs firewall evaluate against Neo4j; vote part re-derived as b-dv2-replay-same' },
  { id: 'b-dv2-replay-same', doc: D3, line: 72, what: 'targets whose report verdicts and confidences equal the cassette majority', stated: '27/27', basis: 'replayed' },
  { id: 'b-dv2-scrub-n', doc: D3, line: 73, what: 'reports rewritten', stated: 'the 27 reports' },
  { id: 'b-dv2-scrub', doc: D3, line: 73, what: 'scrub hits', stated: '0' },
  { id: 'b-dv2-reports', doc: D3, line: 202, what: 'evaluate reports committed', stated: '27' },
  { id: 'b-dv2-diffs2', doc: D3, line: 204, what: 'diffs committed', stated: '18' },
];

const plusMinus = (txt) => txt.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).sort().join('\n');
async function dv2RunValues(ctx) {
  const c = runCounts(ctx, 'dv2');
  const m = manifest(ctx, 'dv2');
  const idx = ctx.sh(`${tsx} --eval "import {FROZEN_V1_OPERATORS, ANTIPATTERN_OPERATORS} from './scripts/lib/mutation/antipatterns/index.ts'; console.log(FROZEN_V1_OPERATORS.length, ANTIPATTERN_OPERATORS.length)"`).trim().split(' ').map(Number);
  const ok = m.rows.filter((r) => r.status === 'ok');
  const twins = ok.filter((r) => r.role === 'twin'); const seeds = ok.filter((r) => r.role === 'seed');
  const tab = m.table.filter((t) => t.operatorId === 'AP-DUP-RULE2');
  const e1tab = tab.filter((t) => t.baseId.startsWith('e1/')); const fxtab = tab.filter((t) => t.baseId === 'antipattern-nest');
  const sumKinds = (ts) => ts.reduce((a, t) => { for (const [k, v] of Object.entries(t.hostKinds ?? {})) a[k] = (a[k] ?? 0) + v; return a; }, {});
  const kinds = (o) => Object.entries(o).sort().map(([k, v]) => `${k} ${v}`).join(', ');
  const rej = m.summary.rejectedDraws;
  const rejCells = new Set(rej.map((r) => r.rowId.split('__')[1]));
  const r2m = manifest(ctx, 'r2');
  const r2twOk = r2m.rows.filter((r) => r.operatorId === 'AP-DUP-RULEn' && r.status === 'ok').length;
  const r2twRej = r2m.rows.filter((r) => r.operatorId === 'AP-DUP-RULEn' && r.status === 'typecheck').length;
  const e1seeds = seeds.filter((r) => r.stratum === 'e1');
  const sameEdits = e1seeds.filter((r) => {
    const a = `${RC}/duprule-v2/diffs/${r.rowId}.diff`; const b = `${RC}/round2/diffs/${r.rowId.replace('__AP-DUP-RULE2__', '__AP-DUP-RULE__')}.diff`;
    return ctx.exists(a) && ctx.exists(b) && plusMinus(ctx.read(a)) === plusMinus(ctx.read(b));
  }).length;
  const testsAt = (rev) => (ctx.sh(`git show ${rev}:tests/unit/scripts/mutation/antipatterns.test.ts`).match(/^\s*(it|test)\(/gm) ?? []).length;
  return {
    'b-dv2-v1hash': pre8(shaAt(ctx, '827d9ace', 'scripts/lib/mutation/antipatterns/ap-dup-rule.ts')),
    'b-dv2-ten': word(idx[0]), 'b-dv2-ten2': word(idx[0]),
    'b-dv2-host-domain-n': `${twins.filter((r) => r.hostKind === 'domain').length} of the ${twins.length}`,
    'b-dv2-host-own-n': String(twins.filter((r) => r.hostKind === 'own').length),
    'b-dv2-dupcells': String(e1tab.filter((t) => t.eligible > 0).length),
    'b-dv2-cat': pre8(shaAt(ctx, '827d9ace', 'Docs/operator-catalogue-antipatterns.md')),
    'b-dv2-index': pre8(shaAt(ctx, '827d9ace', 'scripts/lib/mutation/antipatterns/index.ts')),
    'b-dv2-v2hash': pre8(shaAt(ctx, '827d9ace', 'scripts/lib/mutation/antipatterns/ap-dup-rule-v2.ts')),
    'b-dv2-digest': pre8(registryDigest(ctx, '827d9ace')),
    'b-dv2-rubric': pre8(shaAt(ctx, '827d9ace', 'src/llm-critic/rubric.ts')), 'b-dv2-frozents': pre8(shaAt(ctx, '827d9ace', 'src/llm-critic/frozen.ts')),
    'b-dv2-runsperunit': c.runsPerUnit,
    'b-dv2-newtests': Word(testsAt('827d9ace') - testsAt('95637b75')),
    'b-dv2-fx-sites': `All eligible sites: ${fxtab.reduce((s, t) => s + t.eligible, 0)}`,
    'b-dv2-cells': String(m.e1Cells),
    'b-dv2-t1-fx-cells': String(fxtab.filter((t) => t.eligible > 0).length),
    'b-dv2-t1-e1-cells': `${e1tab.filter((t) => t.eligible > 0).length} of ${m.e1Cells}`,
    'b-dv2-t1-fx-elig': `${fxtab.reduce((s, t) => s + t.eligible, 0)} / ${fxtab.reduce((s, t) => s + t.candidates, 0)}`,
    'b-dv2-t1-e1-elig': `${e1tab.reduce((s, t) => s + t.eligible, 0)} / ${e1tab.reduce((s, t) => s + t.candidates, 0)}`,
    'b-dv2-t1-fx-host': kinds(sumKinds(fxtab)), 'b-dv2-t1-e1-host': kinds(sumKinds(e1tab)),
    'b-dv2-t1-fx-rej': String(rej.filter((r) => r.rowId.startsWith('antipattern-nest')).length),
    'b-dv2-t1-e1-rej': `${rej.filter((r) => r.rowId.startsWith('e1__')).length}${rejCells.size === 1 && [...rejCells][0].startsWith('claude-opus') ? ', all in one opus cell' : ''}`,
    'b-dv2-t1-fx-seeds': String(seeds.filter((r) => r.stratum === 'fixture').length), 'b-dv2-t1-e1-seeds': String(e1seeds.length),
    'b-dv2-t1-fx-twins': String(twins.filter((r) => r.stratum === 'fixture').length),
    'b-dv2-t1-e1-twins': `${twins.filter((r) => r.stratum === 'e1').length}, ${m.rows.filter((r) => r.role === 'twin' && r.status === 'typecheck').length} rejected (round 2's v1 twin: ${r2twOk}, with ${r2twRej} rejected)`,
    'b-dv2-sameedits': `all ${sameEdits} diffs`,
    'b-dv2-hosts': `domain ${twins.filter((r) => r.hostKind === 'domain').length}, own file ${twins.filter((r) => r.hostKind === 'own').length}`,
    'b-dv2-r2rej': String(r2twRej), 'b-dv2-diffs': `${c.diffs} files`, 'b-dv2-diffs2': String(c.diffs),
    'b-dv2-evaluated': `${c.targets}: ${c.clean} bases, ${c.seeds} seeds, ${c.twins} twins`,
    'b-dv2-units': String(c.units),
    'b-dv2-dry': `${c.dry.projectedCalls} (${c.dry.entries} entries + ${c.dry.initProbes} init probes)`,
    'b-dv2-calls': String(c.calls),
    'b-dv2-judgecalls': c.attempts === c.entries ? String(c.attempts) : `${c.attempts} (cassettes ${c.entries})`,
    'b-dv2-attempts': c.allValid ? String(c.maxAttempts) : `${c.maxAttempts} (not all valid)`,
    'b-dv2-probes': String(c.probes),
    'b-dv2-replay-same': voteReplay(ctx, 'dv2'),
    'b-dv2-scrub-n': `the ${c.reports} reports`,
    'b-dv2-scrub': scrubHits(ctx, [ROUND.dv2.cas, `${RC}/duprule-v2/reports`]),
    'b-dv2-reports': String(c.reports),
  };
}

// DUP-RULE v2 §5: cheap proxies, re-derived from the committed flags/*.json with cheap-semantics-v2-eval.ts's unit logic
const CS = 'results/v1.3-cheap-semantics/duprule-v2';
const dv2Cheap = [
  { id: 'b-dv2-c-clones-seeds', doc: D3, line: 160, what: '§5 clones seeds', stated: '9' },
  { id: 'b-dv2-c-clones-catch', doc: D3, line: 160, what: '§5 clones catch (fixture, E1)', stated: '1/9 = 0.11 [0.02, 0.43] (fixture 1/1, E1 0/8)' },
  { id: 'b-dv2-c-clones-twin', doc: D3, line: 160, what: '§5 clones twin false flag raw / paired', stated: '0/9 / 0/9' },
  { id: 'b-dv2-c-clones-clean', doc: D3, line: 160, what: '§5 clones clean false flag', stated: '0/9' },
  { id: 'b-dv2-c-lit-seeds', doc: D3, line: 161, what: '§5 shared-literals seeds', stated: '9' },
  { id: 'b-dv2-c-lit-catch', doc: D3, line: 161, what: '§5 shared-literals catch (fixture, E1)', stated: '2/9 = 0.22 [0.06, 0.55] (fixture 1/1, E1 1/8)' },
  { id: 'b-dv2-c-lit-twin', doc: D3, line: 161, what: '§5 shared-literals twin false flag raw / paired', stated: '1/9 / 0/9' },
  { id: 'b-dv2-c-lit-clean', doc: D3, line: 161, what: '§5 shared-literals clean false flag', stated: '0/9' },
  { id: 'b-dv2-c-either-seeds', doc: D3, line: 162, what: '§5 either seeds', stated: '9' },
  { id: 'b-dv2-c-either-catch', doc: D3, line: 162, what: '§5 either catch', stated: '2/9 = 0.22 [0.06, 0.55]' },
  { id: 'b-dv2-c-either-twin', doc: D3, line: 162, what: '§5 either twin false flag raw / paired', stated: '1/9 / 0/9' },
  { id: 'b-dv2-c-either-clean', doc: D3, line: 162, what: '§5 either clean false flag', stated: '0/9' },
  { id: 'b-dv2-c-bare', doc: D3, line: 166, what: 'E1 rules that are bare guards (fragment density 0)', stated: '5 of the 8' },
  { id: 'b-dv2-c-edge', doc: D3, line: 167, what: 'E1 rules with an exact-structural SAME_LOGIC_AS edge, none cross-component', stated: 'The other 3' },
  { id: 'b-dv2-c-twin-lit', doc: D3, line: 171, what: 'raw shared-literals twin flags (paired)', stated: 'The one raw `shared-literals` twin flag', note: 'gpt own-file twin, inherited: paired 0/9' },
  { id: 'b-dv2-c-paired', doc: D3, line: 171, what: 'shared-literals paired twin rate', stated: '0/9' },
  { id: 'b-dv2-c-threeway', doc: D3, line: 174, what: 'three-way: judge against proxies against symbolic', stated: '9/9 against 2/9 for the proxies and 0/9 for the symbolic rules' },
  { id: 'b-dv2-c-earlier', doc: D3, line: 178, what: 'earlier cheap-semantics run, DUP-RULE catch (results/v1.3-cheap-semantics/scores.json)', stated: 'DUP-RULE 1/1' },
];

async function dv2CheapValues(ctx) {
  const rows = manifest(ctx, 'dv2').rows.filter((r) => r.status === 'ok');
  const flags = (n) => ctx.json(`${CS}/flags/${n}.json`);
  const unitsOf = (row) => {
    const d = row.site.detail;
    if (row.role === 'seed') return [{ file: row.site.filePath, cls: d.class }];
    const u = [{ file: d.sourceFile ?? '', cls: d.sourceClass }];
    if (d.twinHost !== undefined && d.twinHost !== d.sourceFile && d.twinHost !== '!') u.push({ file: d.twinHost, cls: undefined });
    return u;
  };
  const key = (f) => `${f.proxy}|${f.kind}|${f.evidence.file}|${f.className ?? ''}|${f.methodName ?? ''}`;
  const on = (f, u) => f.evidence.file === u.file && (u.cls === undefined || f.className === u.cls);
  const res = rows.map((row) => {
    const fl = flags(row.rowId); const base = flags(`base__${row.baseId.replace('/', '__')}`); const us = unitsOf(row);
    const per = {};
    for (const p of ['clones', 'shared-literals']) {
      const o = fl.filter((f) => f.proxy === p && us.some((u) => on(f, u)));
      const b = base.filter((f) => f.proxy === p && us.some((u) => on(f, u)));
      const bk = new Set(b.map(key));
      per[p] = { flag: o.length > 0, paired: o.some((f) => !bk.has(key(f))), base: b.length > 0 };
    }
    per.either = { flag: per.clones.flag || per['shared-literals'].flag, paired: per.clones.paired || per['shared-literals'].paired, base: per.clones.base || per['shared-literals'].base };
    return { row, per };
  });
  const S = (role, strat) => res.filter((x) => x.row.role === role && (strat === undefined || x.row.stratum === strat));
  const c = (xs, p, k) => xs.filter((x) => x.per[p][k]).length;
  const out = {};
  for (const [s, p] of [['clones', 'clones'], ['lit', 'shared-literals'], ['either', 'either']]) {
    const sd = S('seed'); const tw = S('twin');
    out[`b-dv2-c-${s}-seeds`] = String(sd.length);
    const catchTxt = ctx.cell(c(sd, p, 'flag'), sd.length);
    out[`b-dv2-c-${s}-catch`] = s === 'either' ? catchTxt : `${catchTxt} (fixture ${c(S('seed', 'fixture'), p, 'flag')}/${S('seed', 'fixture').length}, E1 ${c(S('seed', 'e1'), p, 'flag')}/${S('seed', 'e1').length})`;
    out[`b-dv2-c-${s}-twin`] = `${c(tw, p, 'flag')}/${tw.length} / ${c(tw, p, 'paired')}/${tw.length}`;
    out[`b-dv2-c-${s}-clean`] = `${c(sd, p, 'base')}/${sd.length}`;
  }
  const diag = ctx.json(`${CS}/clone-diagnostic.posthoc.json`).filter((d) => d.stratum === 'e1');
  const bare = diag.filter((d) => d.ruleDensity.density === 0).length;
  const edge = diag.filter((d) => d.sameLogicEdges.length > 0);
  out['b-dv2-c-bare'] = `${bare} of the ${diag.length}`;
  out['b-dv2-c-edge'] = edge.every((d) => d.sameLogicEdges.every((e) => e.cloneType === 'exact-structural' && !e.crossComponent)) && bare + edge.length === diag.length ? `The other ${edge.length}` : `${edge.length} (not all intra-component)`;
  const tw = S('twin');
  out['b-dv2-c-twin-lit'] = c(tw, 'shared-literals', 'flag') === 1 ? 'The one raw `shared-literals` twin flag' : `${c(tw, 'shared-literals', 'flag')} raw twin flags`;
  out['b-dv2-c-paired'] = `${c(tw, 'shared-literals', 'paired')}/${tw.length}`;
  const V = scored(ctx).dv2;
  out['b-dv2-c-threeway'] = `${short(V.strata.combined.catch)} against ${c(S('seed'), 'either', 'flag')}/${S('seed').length} for the proxies and ${short(V.strata.combined.symbolicS2)} for the symbolic rules`;
  const cs = ctx.json('results/v1.3-cheap-semantics/scores.json');
  out['b-dv2-c-earlier'] = `DUP-RULE ${short(cs.perOperator['AP-DUP-RULE'].catchPrimary)}`;
  return out;
}

// ---- the frozen-operator doc ---------------------------------------------------------------------------------------
const FROZEN_V1 = [[11, 'catalogue', V1_FILES[0]], [12, 'index', V1_FILES[1]], [13, 'common', V1_FILES[2]], [14, 'repo-bypass', V1_FILES[3]], [15, 'fat-controller', V1_FILES[4]],
  [16, 'persist-in-domain', V1_FILES[5]], [17, 'dup-rule', V1_FILES[6]], [18, 'framework-leak', V1_FILES[7]], [19, 'registry', V1_FILES[8]], [20, 'types', V1_FILES[9]], [21, 'sites', V1_FILES[10]]];
const FROZEN_V2 = [[59, 'catalogue', 'Docs/operator-catalogue-antipatterns.md'], [60, 'index', 'scripts/lib/mutation/antipatterns/index.ts'], [61, 'dup-rule-v2', 'scripts/lib/mutation/antipatterns/ap-dup-rule-v2.ts'],
  [67, 'v2-seed', 'scripts/v1.3/judge-catch-v2-seed.ts'], [68, 'v2-score', 'scripts/v1.3/judge-catch-v2-score.ts'], [69, 'cheap-v2', 'scripts/v1.3/cheap-semantics-v2-eval.ts'],
  [70, 'run', 'scripts/v1.3/judge-catch-run.ts'], [71, 'seed', 'scripts/v1.3/judge-catch-seed.ts'], [72, 'seed2', 'scripts/v1.3/judge-catch2-seed.ts']];
const FROZEN_RE = [[92, 'run', 'scripts/v1.3/judge-catch-run.ts'], [93, 'seed', 'scripts/v1.3/judge-catch-seed.ts']];
const frozenNumbers = () => {
  const lines = readFileSync(new URL('../../../Docs/v1.3/judge-catch-frozen.md', import.meta.url), 'utf8').split('\n');
  const hashOn = (l) => /`([0-9a-f]{64})`/.exec(lines[l - 1])[1];
  return [
    { id: 'b-fz-positives', doc: DF, line: 5, what: 'positive operators (FROZEN_V1_OPERATORS without the n twins)', stated: 'five positives' },
    { id: 'b-fz-twins', doc: DF, line: 5, what: 'twin operators', stated: 'five twins' },
    ...FROZEN_V1.map(([line, s]) => ({ id: `b-fz-v1-${s}`, doc: DF, line, what: `sha256 at the freeze commit 0771ecb5: ${s}`, stated: hashOn(line) })),
    { id: 'b-fz-v1-digest', doc: DF, line: 25, what: 'combined registry digest at 0771ecb5', stated: '59d70946bb57fce2f37b13661cfd25f0818eb28f36e9c7ef3394bb284246d36b' },
    { id: 'b-fz-rubric', doc: DF, line: 31, what: 'sha256 src/llm-critic/rubric.ts (HEAD)', stated: hashOn(31) },
    { id: 'b-fz-frozents', doc: DF, line: 32, what: 'sha256 src/llm-critic/frozen.ts (HEAD)', stated: hashOn(32) },
    { id: 'b-fz-frozensha', doc: DF, line: 33, what: 'computeFrozenSha256() (HEAD)', stated: hashOn(33) },
    { id: 'b-fz-r2-dupn', doc: DF, line: 49, what: 'round 2 DUP-RULEn twins failed', stated: '5/5' },
    { id: 'b-fz-recheck-dup', doc: DF, line: 53, what: 'ap-dup-rule.ts at 827d9ace', stated: 'dda3accc…' },
    { id: 'b-fz-recheck-common', doc: DF, line: 53, what: 'common.ts at 827d9ace', stated: '40552e37…' },
    { id: 'b-fz-recheck-rubric', doc: DF, line: 53, what: 'rubric.ts at 827d9ace', stated: '52960e02…' },
    { id: 'b-fz-recheck-frozen', doc: DF, line: 53, what: 'frozen.ts at 827d9ace', stated: 'b6301b67…' },
    { id: 'b-fz-cat-s1', doc: DF, line: 55, what: 'catalogue table rows added in §1 between 0771ecb5 and 827d9ace', stated: 'two §1 rows' },
    { id: 'b-fz-cat-s2', doc: DF, line: 55, what: 'catalogue table rows added in §2', stated: 'two §2 rows' },
    { id: 'b-fz-cat-log', doc: DF, line: 55, what: 'catalogue changelog rows added', stated: 'one changelog row' },
    { id: 'b-fz-index-added', doc: DF, line: 55, what: 'registry entries appended after the v1 entries', stated: 'two entries appended after the ten v1 entries' },
    ...FROZEN_V2.map(([line, s]) => ({ id: `b-fz-v2-${s}`, doc: DF, line, what: `sha256 at the v2 freeze 827d9ace: ${s}`, stated: hashOn(line) })),
    { id: 'b-fz-v2-digest', doc: DF, line: 74, what: 'combined v2 registry digest at 827d9ace', stated: 'afe879b51c3d1cd0c84a203e0f819000eccd427e155acb7db2c4480648764444' },
    ...FROZEN_RE.map(([line, s]) => ({ id: `b-fz-re-${s}`, doc: DF, line, what: `sha256 after the #108 lint (HEAD): ${s}`, stated: hashOn(line) })),
  ];
};

async function frozenValues(ctx) {
  const out = {};
  for (const [, s, f] of FROZEN_V1) out[`b-fz-v1-${s}`] = shaAt(ctx, '0771ecb5', f);
  out['b-fz-v1-digest'] = registryDigest(ctx, '0771ecb5');
  out['b-fz-rubric'] = shaAt(ctx, 'HEAD', 'src/llm-critic/rubric.ts');
  out['b-fz-frozents'] = shaAt(ctx, 'HEAD', 'src/llm-critic/frozen.ts');
  out['b-fz-frozensha'] = frozenSha(ctx);
  const S = scored(ctx);
  const dupn = S.r2.rows.filter((r) => r.judged && r.operatorId === 'AP-DUP-RULEn');
  out['b-fz-r2-dupn'] = `${dupn.filter((r) => r.unitFail).length}/${dupn.length}`;
  out['b-fz-recheck-dup'] = pre8(shaAt(ctx, '827d9ace', 'scripts/lib/mutation/antipatterns/ap-dup-rule.ts'));
  out['b-fz-recheck-common'] = pre8(shaAt(ctx, '827d9ace', 'scripts/lib/mutation/antipatterns/common.ts'));
  out['b-fz-recheck-rubric'] = pre8(shaAt(ctx, '827d9ace', 'src/llm-critic/rubric.ts'));
  out['b-fz-recheck-frozen'] = pre8(shaAt(ctx, '827d9ace', 'src/llm-critic/frozen.ts'));
  // catalogue rows added, by section of the new file
  const cat = 'Docs/operator-catalogue-antipatterns.md';
  const added = [];
  for (const l of ctx.sh(`git diff -U0 0771ecb5 827d9ace -- ${cat}`).split('\n')) {
    const m = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (m) { const st = Number(m[1]); const n = m[2] === undefined ? 1 : Number(m[2]); for (let i = 0; i < n; i++) added.push(st + i); }
  }
  const nl = ctx.sh(`git show 827d9ace:${cat}`).split('\n');
  const sec = (ln) => { for (let i = ln - 1; i >= 0; i--) if (/^## /.test(nl[i])) return nl[i].slice(3, 5).trim(); return ''; };
  const rowsIn = (s) => added.filter((ln) => /^\|/.test(nl[ln - 1]) && !/^\|[-| ]+\|$/.test(nl[ln - 1]) && sec(ln) === s).length;
  out['b-fz-cat-s1'] = `${word(rowsIn('1.'))} §1 rows`;
  out['b-fz-cat-s2'] = `${word(rowsIn('2.'))} §2 rows`;
  out['b-fz-cat-log'] = `${word(rowsIn('7.'))} changelog row`;
  const idx = ctx.sh(`${tsx} --eval "import {FROZEN_V1_OPERATORS, ANTIPATTERN_OPERATORS} from './scripts/lib/mutation/antipatterns/index.ts'; console.log(FROZEN_V1_OPERATORS.map(o=>o.id).join(','), ANTIPATTERN_OPERATORS.length)"`).trim().split(' ');
  const v1ids = idx[0].split(',');
  out['b-fz-index-added'] = `${word(Number(idx[1]) - v1ids.length)} entries appended after the ${word(v1ids.length)} v1 entries`;
  out['b-fz-positives'] = `${word(v1ids.filter((i) => !i.endsWith('n')).length)} positives`;
  out['b-fz-twins'] = `${word(v1ids.filter((i) => i.endsWith('n')).length)} twins`;
  for (const [, s, f] of FROZEN_V2) out[`b-fz-v2-${s}`] = shaAt(ctx, '827d9ace', f);
  out['b-fz-v2-digest'] = registryDigest(ctx, '827d9ace');
  for (const [, s, f] of FROZEN_RE) out[`b-fz-re-${s}`] = shaAt(ctx, 'HEAD', f);
  return out;
}

const NEO = 'Neo4j (`judge-catch-run.ts replay`) for the reports; this group re-derives from the committed reports, cassettes and manifests';
export default [
  { id: 'b-jc-r1-scores', title: 'Judge catch round 1: catch / twin / clean rates replayed from cassettes', needs: 'offline', basis: 'replayed', slow: false,
    how: 'node --import tsx scripts/v1.3/judge-catch-score.ts --results <copy>; judge-catch2-score.ts; judge-catch-v2-score.ts (cassette replay)', numbers: r1Scores, run: r1ScoreValues },
  { id: 'b-jc-r1-run', title: 'Judge catch round 1: run counts, calls, hashes, vote replay', needs: 'offline', basis: 're-derived', slow: false,
    how: `plan.json, dry-count.json, call-ledger.json, reports/, cassettes; git show 0771ecb5; ${NEO}`, numbers: r1Run, run: r1RunValues },
  { id: 'b-jc-r1-sites', title: 'Judge catch round 1: site table and seeds (seeding regenerated)', needs: 'offline', basis: 'regenerated', slow: true,
    how: 'node --import tsx scripts/v1.3/judge-catch-seed.ts --out <scratch>', numbers: r1Sites, run: r1SiteValues },
  { id: 'b-jc-r2-scores', title: 'Judge catch round 2: rates replayed from cassettes', needs: 'offline', basis: 'replayed', slow: false,
    how: 'node --import tsx scripts/v1.3/judge-catch2-score.ts --results <copy>/round2 --round1 <copy>', numbers: r2Scores, run: r2ScoreValues },
  { id: 'b-jc-r2-run', title: 'Judge catch round 2: sites (committed manifest), counts, hashes, vote replay', needs: 'offline', basis: 're-derived', slow: false,
    how: `round2/seed-manifest.json (seeding needs ../daedalus-e1-outcomes), plan, ledger, cassettes; git show a06532d3; ${NEO}`, numbers: r2Run, run: r2RunValues },
  { id: 'b-jc-r2-ffp01', title: 'Judge catch round 2 §4: FF-P01 alias repro at HEAD', needs: 'offline', basis: 'regenerated', slow: false,
    how: `node --import tsx scripts/v1.3/judge-catch2-ffp01-repro.ts <scratch>, in a git archive of ${FFP_COMMIT}`, numbers: r2Ffp, run: r2FfpValues },
  { id: 'b-jc-dv2-scores', title: 'DUP-RULE v2: rates and cross-round pools replayed from cassettes', needs: 'offline', basis: 'replayed', slow: false,
    how: 'node --import tsx scripts/v1.3/judge-catch-v2-score.ts --results <copy>/duprule-v2', numbers: dv2Scores, run: dv2ScoreValues },
  { id: 'b-jc-dv2-run', title: 'DUP-RULE v2: sites (committed manifest), counts, hashes, vote replay', needs: 'offline', basis: 're-derived', slow: false,
    how: `duprule-v2/seed-manifest.json (seeding needs ../daedalus-e1-outcomes), plan, ledger, diffs, cassettes; git show 827d9ace; ${NEO}`, numbers: dv2Run, run: dv2RunValues },
  { id: 'b-jc-dv2-cheap', title: 'DUP-RULE v2 §5: cheap proxies re-derived from committed flags', needs: 'offline', basis: 're-derived', slow: false,
    how: 'results/v1.3-cheap-semantics/duprule-v2/{flags/*.json,clone-diagnostic.posthoc.json} with the unit logic of cheap-semantics-v2-eval.ts (the producer needs the E1 seed work dir)', numbers: dv2Cheap, run: dv2CheapValues },
  { id: 'b-jc-frozen', title: 'judge-catch-frozen.md: operator, harness and judge hashes', needs: 'offline', basis: 're-derived', slow: false,
    how: 'sha256 of `git show <0771ecb5|827d9ace|HEAD>:<file>`; combined digests; computeFrozenSha256()', numbers: frozenNumbers(), run: frozenValues },
];
