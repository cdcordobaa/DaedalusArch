/**
 * U4 (v1.5-exp): the measures of note §3 from the recorded answers, zero model calls.
 *
 *   npx tsx experiments/v15-u4/analyse.ts --clones <dir>   # → results/metrics.json
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSpec } from '../detect-02/lib/spec.js';
import { repos, readSpec, treeOf, writeVariant } from './repos.js';
import { SCOPE } from './s2.js';
import type { Row } from './s2.js';
import { STABILITY_REPOS } from './s3.js';
import type { TypeVerdict } from './s3.js';

const HERE = 'experiments/v15-u4';
const R = (f: string): unknown => JSON.parse(fs.readFileSync(path.join(HERE, 'results', f), 'utf8'));
const NO_CLASS_TRUTH = ['talyssonoc-node-api', 'camps-graphql-api', 'quiz4devs-backend'];

function s3(clones: string): Record<string, unknown> {
  const run0 = R('s3-run0.json') as { verdicts: TypeVerdict[]; stores: { repo: string; name: string; file: string; ownedBy: string | null }[] };
  const run1 = R('s3-run1.json') as { verdicts: TypeVerdict[] };
  const inferred = R('condition-inferred.json') as { rows: { id: string; roots: { name: string; file: string }[] }[] };
  // Resolved truth (r2 scoring note): the class the rules resolve from each declared root file (condition-declared).
  const resolvedDecl = R('condition-declared.json') as { rows: { id: string; roots: { name: string; file: string }[] }[] };
  const facts = R('s3-facts.json') as { aggregates: Record<string, { name: string; root: string; context: string }[]> };
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-u4-an-'));
  const perRepo: Record<string, unknown>[] = [];
  const pool = { model: { tp: 0, fp: 0, fn: 0 }, inferred: { tp: 0, fp: 0, fn: 0 }, modelResolved: { tp: 0, fp: 0, fn: 0 }, inferredResolved: { tp: 0, fp: 0, fn: 0 } };
  let ctxRight = 0; let ctxAll = 0; let ownRight = 0; let ownAll = 0;
  for (const r of repos()) {
    const declared = (readSpec(r).architecture.ddd?.aggregates ?? []).map((a) => ({ name: a.name, file: a.root, context: a.context }));
    const model = facts.aggregates[r.id] ?? [];
    const inf = inferred.rows.find((x) => x.id === r.id)?.roots ?? [];
    const abst = run0.verdicts.filter((v) => v.repo === r.id && v.verdict === 'abstain');
    const row: Record<string, unknown> = { id: r.id, declared: declared.map((d) => d.name), model: model.map((m) => m.name), inferred: inf.map((x) => x.name), abstained: abst.map((v) => v.name) };
    if (!NO_CLASS_TRUTH.includes(r.id)) {
      const key = (n: string, f: string): string => `${n}@${f}`;
      const truth = new Set(declared.map((d) => key(d.name, d.file)));
      const truthR = new Set((resolvedDecl.rows.find((x) => x.id === r.id)?.roots ?? []).map((d) => key(d.name, d.file)));
      const score = (xs: { name: string; file: string }[], t = truth) => {
        const s = new Set(xs.map((x) => key(x.name, x.file)));
        const tp = [...s].filter((x) => t.has(x)).length;
        return { tp, fp: s.size - tp, fn: [...t].filter((x) => !s.has(x)).length };
      };
      const m = score(model.map((x) => ({ name: x.name, file: x.root })));
      const i = score(inf);
      const mr = score(model.map((x) => ({ name: x.name, file: x.root })), truthR);
      const ir = score(inf, truthR);
      for (const k of ['tp', 'fp', 'fn'] as const) { pool.modelResolved[k] += mr[k]; pool.inferredResolved[k] += ir[k]; }
      row['model'] = { names: model.map((x) => x.name), ...m };
      row['inferred'] = { names: inf.map((x) => x.name), ...i };
      for (const k of ['tp', 'fp', 'fn'] as const) { pool.model[k] += m[k]; pool.inferred[k] += i[k]; }
      for (const x of model) {
        const d = declared.find((y) => y.name === x.name && y.file === x.root);
        if (d) { ctxAll++; if (d.context === x.context) ctxRight++; }
      }
    }
    // Ownership of stores: the truth is the declared context of the store's file.
    const spec = loadSpec(treeOf(clones, r), writeVariant(r, scratch, 'own', null));
    const st = run0.stores.filter((s) => s.repo === r.id);
    const own = st.map((s) => ({ store: s.name, file: s.file, said: s.ownedBy, truth: spec.contextOf(s.file) }));
    for (const o of own) if (o.truth !== null) { ownAll++; if (o.said === o.truth) ownRight++; }
    row['stores'] = { n: own.length, withDeclaredContext: own.filter((o) => o.truth !== null).length, right: own.filter((o) => o.truth !== null && o.said === o.truth).length, wrong: own.filter((o) => o.truth !== null && o.said !== o.truth).map((o) => `${o.store}: ${String(o.said)} (declared ${String(o.truth)})`) };
    perRepo.push(row);
  }
  const pr = (x: { tp: number; fp: number; fn: number }) => ({ ...x, precision: x.tp / Math.max(1, x.tp + x.fp), recall: x.tp / Math.max(1, x.tp + x.fn) });
  // Stability: run 0 against run 1 on the five repositories, per listed type.
  const v0 = new Map(run0.verdicts.filter((v) => STABILITY_REPOS.includes(v.repo)).map((v) => [`${v.repo}|${v.name}|${v.file}`, v.verdict] as const));
  const v1 = new Map(run1.verdicts.map((v) => [`${v.repo}|${v.name}|${v.file}`, v.verdict] as const));
  const both = [...v0.keys()].filter((k) => v1.has(k));
  const roots0 = [...v0].filter(([, v]) => v === 'root').map(([k]) => k).sort();
  const roots1 = [...v1].filter(([, v]) => v === 'root').map(([k]) => k).sort();
  return {
    perRepo, pooled10: { model: pr(pool.model), inferred: pr(pool.inferred), modelResolved: pr(pool.modelResolved), inferredResolved: pr(pool.inferredResolved) },
    answers: { types: run0.verdicts.length, roots: run0.verdicts.filter((v) => v.verdict === 'root').length, abstain: run0.verdicts.filter((v) => v.verdict === 'abstain').length, ungroundedRootsDropped: run0.verdicts.filter((v) => v.verdict === 'root' && !v.grounded).length, unlistedNames: run0.verdicts.filter((v) => !v.listed).map((v) => `${v.repo}:${v.name}`) },
    rootContext: { right: ctxRight, of: ctxAll }, storeOwnership: { right: ownRight, of: ownAll },
    stability: { types: both.length, sameVerdict: both.filter((k) => v0.get(k) === v1.get(k)).length, rootSetsIdentical: JSON.stringify(roots0) === JSON.stringify(roots1), differing: both.filter((k) => v0.get(k) !== v1.get(k)).map((k) => `${k}: ${String(v0.get(k))} → ${String(v1.get(k))}`) },
    hits: Object.fromEntries(['declared', 'inferred', 's3'].map((c) => [c, (R(`condition-${c}.json`) as { rows: { id: string; violations: { rule: string; subject: string }[] }[] }).rows.flatMap((x) => x.violations.map((v) => `${x.id} ${v.rule} ${v.subject}`))])),
  };
}

function s2(): Record<string, unknown> {
  const rows = (R('s2-answers.json') as { rows: Row[] }).rows;
  const dev = R('../../detect-02/results/dev.json') as { rows: { label: string; flagged: string[]; cases: { id: string; family: string; file: string }[]; caseHits: Record<string, boolean> }[] };
  const counts = R('proposer-counts.json') as { trees: { label: string; d5Labelled: boolean }[] };
  // D5 at tree level and at case level, rules alone vs rules + confirmation, over the asked D5 trees.
  const d5Trees = SCOPE.d5Trees;
  const tree = d5Trees.map((label) => {
    const dr = dev.rows.find((x) => x.label === label)!;
    const cs = dr.cases.filter((c) => c.family === 'D5');
    const mine = rows.filter((x) => x.label === label && x.family === 'D5');
    const kept = mine.filter((x) => x.kept);
    const caseHit = (c: { file: string }): boolean => kept.some((k) => k.file === c.file);
    return {
      label, positive: cs.length > 0, rules: dr.flagged.includes('D5'), both: kept.length > 0,
      casesRules: cs.map((c) => dr.caseHits[c.id] === true), casesBoth: cs.map(caseHit),
      candidates: mine.map((x) => `${x.source}:${x.file}:${String(x.line)} ${x.runs.map((r) => r.verdict).join('/')}→${x.merged}${x.kept ? ' kept' : ''}`),
    };
  });
  const tally = (f: (t: (typeof tree)[number]) => boolean) => ({ tp: tree.filter((t) => t.positive && f(t)).length, fn: tree.filter((t) => t.positive && !f(t)).length, fp: tree.filter((t) => !t.positive && f(t)).length, tn: tree.filter((t) => !t.positive && !f(t)).length });
  const labelled16 = counts.trees.filter((t) => t.d5Labelled).map((t) => t.label);
  const caseLevel16 = (arm: 'rules' | 'both') => labelled16.filter((l) => {
    const t = tree.find((x) => x.label === l);
    if (t === undefined) return dev.rows.find((x) => x.label === l)!.flagged.includes('D5'); // not asked: rules only
    return (arm === 'rules' ? t.casesRules : t.casesBoth).every(Boolean);
  }).length;
  const caveat = ['fixture/c4-s1-h5-lockport/pos', 'fixture/c4v-h5-vendor-type/pos', 'fixture/c4v-h5-vendor-type/twin'];
  const pairs = [['c1-s1-d5-lock', 'fixture/c1-s1-d5-lock/pos', 'fixture/c1-s1-d5-lock/twin'], ['c6-s2-d5-placeorder', 'fixture/c6-s2-d5-placeorder/pos', 'fixture/c6-s2-d5-placeorder/twin'], ['c7-s2-d5-settaxrate', 'fixture/c7-s2-d5-settaxrate/pos', 'fixture/c7-s2-d5-settaxrate/twin']].map(([id, p, w]) => {
    const tp = tree.find((t) => t.label === p)!; const tw = tree.find((t) => t.label === w)!;
    return { pair: id, rules: { positive: tp.rules, twin: tw.rules }, both: { positive: tp.both, twin: tw.both } };
  });
  const others = rows.filter((x) => x.family !== 'D5' && x.set === 'dev');
  const prec = rows.filter((x) => x.set === 'precision');
  const allRuns = rows.flatMap((x) => x.runs);
  const confirms = allRuns.filter((r) => r.verdict === 'confirm');
  const twoRun = rows.filter((x) => x.runs.length === 2);
  return {
    d5: { rules: tally((t) => t.rules), both: tally((t) => t.both), bothCaveatAsUnlabelled: { fp: tree.filter((t) => !t.positive && t.both && !caveat.includes(t.label)).length }, caseLevel16: { rules: caseLevel16('rules'), both: caseLevel16('both') }, pairs, trees: tree },
    relaxed: { asked: rows.filter((x) => x.source === 'relaxed').length, confirmedOnPositives: rows.filter((x) => x.source === 'relaxed' && x.kept && x.expected === 'tp').length, confirmedOnNegatives: rows.filter((x) => x.source === 'relaxed' && x.kept && x.expected === 'fp').map((x) => x.id), rejected: rows.filter((x) => x.source === 'relaxed' && x.merged === 'reject').length },
    ruleD5Rejected: rows.filter((x) => x.family === 'D5' && x.source === 'rule' && !x.kept).map((x) => x.id),
    otherFamilies: { asked: others.length, kept: others.filter((x) => x.kept).length, rejectedTrue: others.filter((x) => !x.kept && x.expected === 'tp').map((x) => x.id) },
    precisionFixtures: { legitAsked: prec.filter((x) => x.expected === 'fp').length, legitConfirmed: prec.filter((x) => x.expected === 'fp' && x.merged === 'confirm').length, positivesAsked: prec.filter((x) => x.expected === 'tp').length, positivesConfirmed: prec.filter((x) => x.expected === 'tp' && x.merged === 'confirm').length },
    grounding: { confirms: confirms.length, grounded: confirms.filter((r) => r.grounded).length },
    validity: { answers: allRuns.length, invalid: allRuns.filter((r) => r.verdict === 'invalid').length },
    verdicts: { confirm: confirms.length, reject: allRuns.filter((r) => r.verdict === 'reject').length, abstain: allRuns.filter((r) => r.verdict === 'abstain').length },
    stability: { items: twoRun.length, agree: twoRun.filter((x) => x.runs[0]!.verdict === x.runs[1]!.verdict).length, split: twoRun.filter((x) => x.merged === 'split').map((x) => x.id) },
  };
}

if (process.argv[1]?.endsWith('analyse.ts')) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--clones');
  if (i < 0) { process.stderr.write('--clones <dir>\n'); process.exit(2); }
  const ledger = fs.readFileSync(path.join(HERE, 'ledger.jsonl'), 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as { part: string; ok: boolean; model: string });
  const out = {
    schema: 'v15-u4-metrics-v1', version: 'v1.5-exp', split: 'dev',
    calls: { total: ledger.length, s3: ledger.filter((l) => l.part === 'S3').length, s2: ledger.filter((l) => l.part === 'S2').length, failedAttempts: ledger.filter((l) => !l.ok).length, servedModels: [...new Set(ledger.map((l) => l.model))] },
    s3: s3(argv[i + 1]!), s2: s2(),
  };
  fs.writeFileSync(path.join(HERE, 'results', 'metrics.json'), `${JSON.stringify(out, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify({ calls: out.calls, s3: { ...out.s3, perRepo: undefined }, s2: { ...out.s2, d5: { ...(out.s2.d5 as Record<string, unknown>), trees: undefined } } }, null, 1)}\n`);
}
