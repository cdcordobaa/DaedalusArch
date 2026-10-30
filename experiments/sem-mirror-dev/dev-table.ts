/**
 * R-MIRROR-SEM (row H11, exploratory, neuro-symbolic) development table and reliability harness. Development data only
 * (`trees.ts`); not admission evidence.
 *
 * Per dev tree: the candidates (symbolic), and for every candidate whose structure holds, K = 3 independent answers of
 * the model fact (the content-hash cache is OFF for this harness: each run is its own call; each answer is kept as a
 * harness cassette `cassettes/<key24>-r<run>.json`, so a re-run replays and makes no call). Then the rule itself runs
 * per run (`runTree` with R-MIRROR-SEM only and a judge that returns that run's answer), so `fired` is the Cypher's
 * decision, not a re-implementation of it. Agreement: the share of candidates whose K answers are identical, and
 * Fleiss' kappa over the three answer categories.
 *
 *   npx tsx experiments/sem-mirror-dev/dev-table.ts [--record] [--only <substring>] [--out experiments/sem-mirror-dev/results/dev-table.json]
 *
 * Without --record a missing cassette is reported as not asked (zero calls). The model route is the Claude CLI judge
 * route (`cliCaller`, `claude-opus-5-5`); nothing goes to any other provider.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph, loadRules, runTree } from '../../src/v15-instrument/index.js';
import {
  cliCaller, createMirrorJudge, MIRROR_SEM_MODEL, MIRROR_SEM_RULE, MIRROR_SEM_VERSION, mirrorKeyOf, structureHolds, verdictOf,
  type MirrorCandidateFact, type MirrorJudge, type MirrorVerdict,
} from '../../src/v15-instrument/mirror-sem.js';
import { devTrees } from './trees.js';

const K = 3;
const HERE = path.join('experiments', 'sem-mirror-dev');
const CASSETTES = path.join(HERE, 'cassettes');
const LEDGER = path.join(HERE, 'results', 'ledger.jsonl');
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const RECORD = process.argv.includes('--record');

const cassette = (key: string, run: number): string => path.join(CASSETTES, `${key.slice(0, 24)}-r${String(run)}.json`);

/** One harness answer: the cassette, else (with --record) one fresh call (no content-hash cache, no session map). */
async function answer(c: MirrorCandidateFact, run: number, live: MirrorJudge): Promise<{ verdict: MirrorVerdict | null; from: string; ms: number }> {
  const key = mirrorKeyOf(c);
  const f = cassette(key, run);
  if (fs.existsSync(f)) return { verdict: verdictOf((JSON.parse(fs.readFileSync(f, 'utf8')) as { answer: unknown }).answer), from: 'cassette', ms: 0 };
  if (!RECORD) return { verdict: null, from: 'not-asked', ms: 0 };
  const j = await live.judge(c);
  if (j.verdict !== null) {
    fs.mkdirSync(CASSETTES, { recursive: true });
    fs.writeFileSync(f, `${JSON.stringify({ key, run, version: MIRROR_SEM_VERSION, requestedModel: MIRROR_SEM_MODEL, candidate: c.id, date: new Date().toISOString(), answer: j.verdict }, null, 1)}\n`);
  }
  return { verdict: j.verdict, from: j.from, ms: j.ms };
}

/** A judge that returns fixed verdicts by key (one run's answers), for running the Cypher rule on that run. */
function fixedJudge(byKey: ReadonlyMap<string, MirrorVerdict | null>): MirrorJudge {
  const stats = { asked: 0, session: 0, disk: 0, calls: 0, misses: 0, errors: 0, callMs: 0 };
  return { stats, judge: async (c) => { const key = mirrorKeyOf(c); const v = byKey.get(key) ?? null; return { verdict: v, key, from: v === null ? 'miss' : 'disk', ms: 0 }; } };
}

function fleiss(rows: readonly (readonly string[])[], cats: readonly string[]): number | null {
  const full = rows.filter((r) => r.length === K);
  if (full.length < 2) return null;
  const n = K; const N = full.length;
  const pj = cats.map((c) => full.reduce((s, r) => s + r.filter((x) => x === c).length, 0) / (N * n));
  const Pi = full.map((r) => (cats.reduce((s, c) => { const k = r.filter((x) => x === c).length; return s + k * (k - 1); }, 0)) / (n * (n - 1)));
  const P = Pi.reduce((a, b) => a + b, 0) / N; const Pe = pj.reduce((s, p) => s + p * p, 0);
  return Pe === 1 ? null : (P - Pe) / (1 - Pe);
}

async function main(): Promise<void> {
  const only = argOf('--only');
  const rules = loadRules().filter((r) => r.id === MIRROR_SEM_RULE);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-mirror-dev-'));
  const live = createMirrorJudge({ mode: 'live', disk: false, session: false, caller: cliCaller(), ledger: LEDGER });
  const rows: Record<string, unknown>[] = [];
  const agreeRows: string[][] = [];
  for (const t of devTrees(path.join(scratch, 'trees'))) {
    if (only !== undefined && !t.id.includes(only)) continue;
    const opts = { spec: t.spec, withApg: false, scratch, ...(t.baseline !== undefined ? { baseline: t.baseline } : {}) };
    const { facts } = await buildGraph(t.tree, opts);
    const asked = facts.mirrorCandidates.filter(structureHolds);
    const answers = new Map<string, { verdict: MirrorVerdict | null; from: string; ms: number }[]>();
    for (const c of asked) {
      const xs: { verdict: MirrorVerdict | null; from: string; ms: number }[] = [];
      for (let run = 1; run <= K; run++) xs.push(await answer(c, run, live));
      answers.set(c.id, xs);
      const got = xs.map((x) => x.verdict?.mirror).filter((x): x is MirrorVerdict['mirror'] => x !== undefined);
      if (got.length === K) agreeRows.push(got);
    }
    // the rule, per run
    const firedPerRun: number[] = [];
    for (let run = 1; run <= K; run++) {
      const byKey = new Map<string, MirrorVerdict | null>(asked.map((c) => [mirrorKeyOf(c), answers.get(c.id)![run - 1]!.verdict] as const));
      const r = await runTree(t.tree, rules, { ...opts, mirrorJudge: fixedJudge(byKey) });
      firedPerRun.push(r.findings.filter((f) => f.rule === MIRROR_SEM_RULE && f.status === 'violation').length);
    }
    const majorityFired = firedPerRun.filter((n) => n > 0).length >= 2;
    const expect = t.oracle === 'violation';
    rows.push({
      tree: t.id, oracle: t.oracle, note: t.note, candidates: facts.mirrorCandidates.length, structural: asked.length > 0,
      perCandidate: facts.mirrorCandidates.map((c) => ({
        coreSet: c.coreSet, file: c.file, vendorSet: `${c.vendorSet} of ${c.module}`, coreMembers: c.coreMembers, vendorMembers: c.vendorMembers,
        mappedFrom: c.mappedFrom, mappedTo: c.mappedTo, oneToOne: c.oneToOne, branches: c.branches.length, ownedBy: c.ownedBy, asked: structureHolds(c),
        key: structureHolds(c) ? mirrorKeyOf(c).slice(0, 24) : null,
        answers: (answers.get(c.id) ?? []).map((x) => (x.verdict === null ? x.from : x.verdict.mirror)),
        reasons: (answers.get(c.id) ?? []).map((x) => x.verdict?.reason ?? null),
        callMs: (answers.get(c.id) ?? []).map((x) => x.ms),
      })),
      firedPerRun, fired: majorityFired, pass: majorityFired === expect,
    });
    const ans = [...answers.values()].map((xs) => xs.map((x) => x.verdict?.mirror ?? x.from).join('/')).join(' ; ');
    process.stdout.write(`${t.id.padEnd(52)} oracle ${t.oracle.padEnd(9)} structural ${asked.length > 0 ? 'y' : 'n'} answers ${ans.padEnd(24)} fired ${firedPerRun.join('/')} ${majorityFired === expect ? 'pass' : 'FAIL'}\n`);
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const unanimous = agreeRows.filter((r) => r.every((x) => x === r[0])).length;
  const summary = {
    k: K, model: MIRROR_SEM_MODEL, version: MIRROR_SEM_VERSION, trees: rows.length, pass: rows.filter((r) => r.pass).length,
    askedCandidates: agreeRows.length, unanimous, unanimousShare: agreeRows.length > 0 ? unanimous / agreeRows.length : null,
    fleissKappa: fleiss(agreeRows, ['yes', 'no', 'unsure']), unsureAnswers: agreeRows.flat().filter((x) => x === 'unsure').length,
    calls: live.stats.calls, callMsMean: live.stats.calls > 0 ? Math.round(live.stats.callMs / live.stats.calls) : null,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  const out = argOf('--out');
  if (out !== undefined) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, `${JSON.stringify({ summary, rows }, null, 2)}\n`); }
}
void main();
