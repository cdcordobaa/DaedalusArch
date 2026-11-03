/**
 * SEM-GATE-3: the zero-agent gate for R-MIRROR-SEM v1.5.10 (form C: a core lookup keyed by the vendor's own values),
 * criteria fixed in `GATE.md` before any judge call. Runs the rule (R-MIRROR-SEM only, the in-memory graph, the frozen
 * Cypher) on every gate tree (`trees.ts`): the fresh form-C cases and the SEM-2 pilot trees of `cases.json`, the
 * reference clean trees, and the SEM-GATE-2 (20) and SEM-GATE (53) cases.
 *
 * Every candidate is a row. Its label: the case label for the case's target; the pre-registered label of
 * `cases.json` `colocated` for a form-C candidate beside another case's target; `negative` for any other candidate in a
 * negative tree of this gate's own (`cases.json`: the fresh twins, the clean trees, the pilot negatives); `unlabelled`
 * otherwise (reported, never counted; SEM-GATE and SEM-GATE-2 count their targets, as they did).
 *
 * Judge: the Claude CLI judge route (`cliCaller`, `claude-opus-5-5`). A question SEM-GATE or SEM-GATE-2 already asked is
 * answered from its committed cache (replay, zero calls); every other question is asked once (live), cached in `cache/`,
 * and every real call is a line of `results/calls.jsonl`. A form-C candidate co-located in a positive case of SEM-GATE or
 * SEM-GATE-2 is not asked (GATE.md §5; it cannot fire). Without `--live` the judge is replay-only.
 *
 *   npx tsx experiments/sem-gate-3/gate.ts [--live] [--latency experiments/sem-gate-3/results/deferred-latency.json]
 *     [--out experiments/sem-gate-3/result.json]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph, loadRules, runTree } from '../../src/v15-instrument/index.js';
import {
  cliCaller, createMirrorJudge, mirrorKeyOf, mirrorPrompt, MIRROR_SEM_MODEL, MIRROR_SEM_RULE, MIRROR_SEM_VERSION, structureHolds,
  type Judged, type MirrorCandidateFact, type MirrorJudge,
} from '../../src/v15-instrument/mirror-sem.js';
import { INSTRUMENT_ID } from '../../src/v15-instrument/rule-set.js';
import { gateCases, HERE, type GateCase } from './trees.js';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIVE = process.argv.includes('--live');

interface Coloc { set: string; case: string; file: string; coreSet: string; label: 'positive' | 'negative'; judged: boolean }

/** Citation checks (SEM-GATE GATE.md §4 criterion 3, unchanged). */
function citationProblems(tree: string, text: string, prompt: string | null, kind: 'evidence' | 'reason'): string[] {
  const out: string[] = [];
  const exists = (rel: string): boolean => fs.existsSync(path.join(tree, rel));
  const lines = (rel: string): number => fs.readFileSync(path.join(tree, rel), 'utf8').split('\n').length;
  for (const m of text.matchAll(/([\w./-]+\.(?:ts|js|md|yaml|json)):(\d+)/g)) {
    const [, f, n] = m as unknown as [string, string, string];
    if (!exists(f)) out.push(`${kind}: ${f}:${n} names a file not in the tree`);
    else if (Number(n) < 1 || Number(n) > lines(f)) out.push(`${kind}: ${f}:${n} is past the end of the file (${String(lines(f))} lines)`);
  }
  for (const m of text.matchAll(/(?:^|[\s(`'"])((?:[\w.-]+\/)+[\w.-]+\.(?:ts|js|md|yaml|json))(?![:\w])/g)) {
    const f = m[1]!;
    if (!exists(f) && !(prompt?.includes(f) ?? false)) out.push(`${kind}: ${f} names a file not in the tree`);
  }
  if (kind === 'reason' && prompt !== null) {
    for (const m of text.matchAll(/[`'"]([A-Za-z_][\w.-]*)[`'"]/g)) {
      const tok = m[1]!;
      if (!prompt.includes(tok)) out.push(`reason: quoted token ${tok} is not in the prompt`);
    }
    for (const m of text.matchAll(/\bline (\d+)\b/gi)) out.push(`reason: cites line ${m[1]!}, but the prompt shows no line numbers`);
  }
  return out;
}

async function main(): Promise<void> {
  const man = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')) as { colocated: Coloc[] };
  const coloc = new Map(man.colocated.map((x) => [`${x.set}|${x.case}|${x.file}|${x.coreSet}`, x]));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-gate-3-'));
  const all = gateCases(scratch);
  const rules = loadRules().filter((r) => r.id === MIRROR_SEM_RULE);
  if (rules.length !== 1) throw new Error('R-MIRROR-SEM rule not found');

  const ledger = path.join(HERE, 'results', 'calls.jsonl');
  const one = createMirrorJudge({ mode: 'replay', cacheDir: path.join('experiments', 'sem-gate', 'cache') });
  const two = createMirrorJudge({ mode: 'replay', cacheDir: path.join('experiments', 'sem-gate-2', 'cache') });
  const inner = createMirrorJudge({ mode: LIVE ? 'live' : 'replay', cacheDir: path.join(HERE, 'cache'), ...(LIVE ? { caller: cliCaller() } : {}), ledger });
  const seen = new Map<string, { judged: Judged; prompt: string; via: string }>();
  const ask = async (c: MirrorCandidateFact): Promise<Judged> => {
    for (const [j, via] of [[one, 'sem-gate-cache'], [two, 'sem-gate-2-cache']] as const) {
      const o = await j.judge(c);
      if (o.verdict !== null) { if (!seen.has(o.key)) seen.set(o.key, { judged: o, prompt: mirrorPrompt(c), via }); return o; }
    }
    const j = await inner.judge(c);
    if (!seen.has(j.key) || seen.get(j.key)!.judged.verdict === null) seen.set(j.key, { judged: j, prompt: mirrorPrompt(c), via: 'sem-gate-3' });
    return j;
  };

  const byTree = new Map<string, GateCase[]>();
  for (const g of all) byTree.set(g.tree, [...(byTree.get(g.tree) ?? []), g]);
  const rows: Record<string, unknown>[] = [];
  const t0 = Date.now();
  for (const [tree, gs] of byTree) {
    const g0 = gs[0]!;
    const opts = { spec: g0.c.spec, withApg: false, scratch, ...(g0.baseline !== undefined ? { baseline: g0.baseline } : {}) };
    const colocOf = (c: MirrorCandidateFact): Coloc | undefined => gs.map((g) => coloc.get(`${g.set}|${g.c.id}|${c.file}|${c.coreSet}`)).find((x) => x !== undefined);
    const judge: MirrorJudge = {
      stats: inner.stats,
      async judge(c: MirrorCandidateFact): Promise<Judged> {
        const co = colocOf(c);
        if (co !== undefined && !co.judged) return { verdict: null, key: mirrorKeyOf(c), from: 'miss', ms: 0 };
        return ask(c);
      },
    };
    const { facts } = await buildGraph(tree, opts);
    const r = await runTree(tree, rules, { ...opts, mirrorJudge: judge });
    const firedOn = (c: MirrorCandidateFact) => r.findings.filter((f) => f.rule === MIRROR_SEM_RULE && f.status === 'violation' && f.file === c.file && f.subject === c.coreSet);
    for (const c of facts.mirrorCandidates) {
      const tgt = gs.find((g) => g.c.target !== null && g.c.target.file === c.file && g.c.target.coreSet === c.coreSet);
      const co = colocOf(c);
      // every other candidate counts only in this gate's own negative trees (SEM-GATE and SEM-GATE-2 count their targets, as before)
      const neg = gs.find((g) => g.c.label === 'negative' && (g.set === 'fresh' || g.set === 'extra'));
      const owner = tgt ?? (co !== undefined ? gs.find((g) => g.set === co.set && g.c.id === co.case) : undefined) ?? neg ?? g0;
      const label = tgt !== undefined ? tgt.c.label : co !== undefined ? co.label : neg !== undefined ? 'negative' : 'unlabelled';
      const role = tgt !== undefined ? 'target' : co !== undefined ? 'colocated' : 'other';
      const asked = structureHolds(c) && (co === undefined || co.judged);
      const key = structureHolds(c) ? mirrorKeyOf(c) : null;
      const j = key !== null ? seen.get(key) : undefined;
      const fired = firedOn(c);
      const problems = [
        ...fired.flatMap((f) => citationProblems(tree, f.evidence.split(' | model fact: ')[0]!, null, 'evidence')),
        ...fired.filter((f) => f.line === null || !fs.existsSync(path.join(tree, f.file)) || f.line > fs.readFileSync(path.join(tree, f.file), 'utf8').split('\n').length).map((f) => `finding: ${f.file}:${String(f.line)} does not exist`),
        ...(asked && j?.judged.verdict != null ? citationProblems(tree, j.judged.verdict.reason, j.prompt, 'reason') : []),
      ];
      rows.push({
        set: owner.set, case: owner.c.id, caseLabel: owner.c.label, form: c.coreKind === 'keys' ? 'C' : tgt?.c.form ?? null, role, label, twin: tgt?.c.twin ?? false,
        file: c.file, coreSet: c.coreSet, coreKind: c.coreKind, mapSide: c.mapSide ?? 'adapter', structure: structureHolds(c), asked, key: key?.slice(0, 24) ?? null,
        answer: asked ? j?.judged.verdict?.mirror ?? 'no-answer' : null, reason: asked ? j?.judged.verdict?.reason ?? null : null, via: asked ? j?.via ?? null : null, from: asked ? j?.judged.from ?? null : null,
        fired: fired.length > 0, citationProblems: problems,
      });
      process.stdout.write(`${owner.set.padEnd(10)} ${owner.c.id.padEnd(20)} ${role.padEnd(9)} ${label.padEnd(10)} ${(c.coreKind === 'keys' ? 'C' : '-')} ${c.coreSet.slice(0, 32).padEnd(32)} asked ${asked ? 'y' : 'n'} ${String(asked ? j?.judged.verdict?.mirror ?? '-' : '-').padEnd(7)} fired ${fired.length > 0 ? 'y' : 'n'} cites ${String(problems.length)}\n`);
    }
    // a target with no candidate is a row too (a miss)
    for (const g of gs) if (g.c.target !== null && !facts.mirrorCandidates.some((c) => c.file === g.c.target!.file && c.coreSet === g.c.target!.coreSet)) {
      rows.push({ set: g.set, case: g.c.id, caseLabel: g.c.label, form: g.c.form, role: 'target', label: g.c.label, twin: g.c.twin, file: g.c.target.file, coreSet: g.c.target.coreSet, coreKind: null, mapSide: null, structure: false, asked: false, key: null, answer: null, reason: null, via: null, from: null, fired: false, citationProblems: [] });
      process.stdout.write(`${g.set.padEnd(10)} ${g.c.id.padEnd(20)} target    ${g.c.label.padEnd(10)} no candidate\n`);
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const wallMs = Date.now() - t0;

  const tg = (set: string, label: string, form?: string): Record<string, unknown>[] => rows.filter((r) => r['set'] === set && r['role'] === 'target' && r['label'] === label && (form === undefined || r['form'] === form));
  const recall = (xs: Record<string, unknown>[]): { n: number; fired: number; recall: number | null; missed: unknown[] } => ({ n: xs.length, fired: xs.filter((r) => r['fired']).length, recall: xs.length > 0 ? xs.filter((r) => r['fired']).length / xs.length : null, missed: xs.filter((r) => !r['fired']).map((r) => r['case']) });
  const fA = recall(tg('sem-gate-2', 'positive', 'A'));
  const fC = recall(tg('fresh', 'positive', 'C'));
  const dev = recall(tg('dev', 'positive', 'C'));
  // false positives: any firing on a row labelled negative (targets, pre-labelled co-located rows, every other candidate of a negative tree)
  const fpRows = rows.filter((r) => r['label'] === 'negative');
  const fpBy = (pred: (r: Record<string, unknown>) => boolean): { n: number; fired: number; ids: string[] } => { const xs = fpRows.filter(pred); return { n: xs.length, fired: xs.filter((r) => r['fired']).length, ids: xs.filter((r) => r['fired']).map((r) => `${String(r['set'])}/${String(r['case'])}:${String(r['coreSet'])}`) }; };
  const fp = {
    freshTwins: fpBy((r) => r['set'] === 'fresh'),
    semGate2: fpBy((r) => r['set'] === 'sem-gate-2'),
    semGate: fpBy((r) => r['set'] === 'sem-gate'),
    cleanTrees: fpBy((r) => r['set'] === 'extra' && String(r['case']).endsWith('-clean')),
    pilotNegatives: fpBy((r) => r['set'] === 'extra' && String(r['case']).startsWith('pilot-')),
  };
  const fpAll = Object.values(fp).reduce((a, x) => a + x.fired, 0);
  const cites = rows.flatMap((r) => (r['citationProblems'] as string[]).map((p) => `${String(r['set'])}/${String(r['case'])}/${String(r['coreSet'])}: ${p}`));
  const calls = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8').trim().split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as { durationMs: number; ok: boolean; key: string }) : [];
  const msByKey = new Map<string, number>();
  for (const x of calls) msByKey.set(x.key, (msByKey.get(x.key) ?? 0) + x.durationMs);
  const askedHere = [...new Set(rows.filter((r) => r['asked'] && r['via'] === 'sem-gate-3').map((r) => String(r['key'])))];
  const sorted = askedHere.filter((k) => msByKey.has(k)).map((k) => msByKey.get(k)!).sort((a, b) => a - b);
  const median = sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;

  const latFile = argOf('--latency');
  const lat = latFile !== undefined && fs.existsSync(latFile) ? (JSON.parse(fs.readFileSync(latFile, 'utf8')) as { summary: { p95CheckMs: number; maxAddedMs: number; minCallMs: number | null; firedAfterSettle: boolean; pushes: number; calls: number } }).summary : null;
  const c6 = lat === null ? null : lat.p95CheckMs < 5000 && lat.minCallMs !== null && lat.maxAddedMs < Math.min(1000, lat.minCallMs);

  const criteria = [
    { id: '1', what: 'form A still caught: the rule fires on all 11 SEM-GATE-2 fresh form-A targets', value: fA, pass: fA.n === 11 && fA.fired === 11 },
    { id: '2', what: 'form-C recall >= 0.80 on the 6 fresh form-C positives', value: fC, pass: fC.recall !== null && fC.n === 6 && fC.recall >= 0.8 },
    { id: '3', what: 'form-C dev trees (SEM-2 pilot c001, c005, c006, c008; they shaped the rule): >= 3 of 4 fire', value: dev, pass: dev.n === 4 && dev.fired >= 3 },
    { id: '4', what: '0 false positives over every negative row (fresh twins, SEM-GATE-2 and SEM-GATE negatives, the clean trees, pilot c002 c003 c004 c007)', value: { total: fpAll, ...fp }, pass: fpAll === 0 },
    { id: '5', what: '0 hallucinated citations (finding locations and evidence sites exist; every path, line and quoted token in a model reason exists), every judged row and every finding', value: { problems: cites.length, list: cites }, pass: cites.length === 0 },
    { id: '6', what: 'deferred mode: hub p95 check < 5 s with the judge deferred, and no push check waits on a model call (added check time over control < min(1 s, the shortest call))', value: lat, pass: c6 },
  ];
  const verdict = criteria.every((c) => c.pass === true) ? 'PASS' : 'FAIL';
  const ans = (pred: (r: Record<string, unknown>) => boolean): Record<string, number> => Object.fromEntries(['yes', 'no', 'unsure', 'no-answer'].map((a) => [a, rows.filter((r) => pred(r) && r['answer'] === a).length]));
  const out = {
    gate: 'SEM-GATE-3', date: new Date().toISOString(), instrument: INSTRUMENT_ID, rule: MIRROR_SEM_RULE, version: MIRROR_SEM_VERSION, model: MIRROR_SEM_MODEL, live: LIVE,
    criteria, verdict,
    reported: {
      colocatedFormC: { positivesJudged: recall(rows.filter((r) => r['role'] === 'colocated' && r['label'] === 'positive' && r['asked'])), negativesJudged: fpBy((r) => r['role'] === 'colocated'), notAsked: rows.filter((r) => r['role'] === 'colocated' && !r['asked']).length },
      seenFormA: recall(tg('sem-gate', 'positive', 'A')), seenFormB: recall(tg('sem-gate', 'positive', 'B')),
      answersFreshC: ans((r) => r['set'] === 'fresh' && r['role'] === 'target'), answersDev: ans((r) => r['set'] === 'dev' && r['role'] === 'target'),
      answersNegatives: ans((r) => r['label'] === 'negative'),
      distinctQuestionsAskedHere: askedHere.length,
      answeredFromCaches: { semGate: new Set(rows.filter((r) => r['via'] === 'sem-gate-cache').map((r) => r['key'])).size, semGate2: new Set(rows.filter((r) => r['via'] === 'sem-gate-2-cache').map((r) => r['key'])).size },
      gateCallsThisRun: inner.stats.calls, ledgerCalls: calls.length, ledgerFailed: calls.filter((x) => !x.ok).length,
      callsPerQuestion: askedHere.length > 0 ? calls.length / askedHere.length : null, medianCallMsPerQuestion: median, wallMs,
      latencyCalls: lat?.calls ?? null, firedAfterSettle: lat?.firedAfterSettle ?? null,
    },
    rows,
  };
  process.stdout.write(`${JSON.stringify({ verdict, criteria: criteria.map((c) => ({ id: c.id, pass: c.pass })), reported: out.reported })}\n`);
  const f = argOf('--out');
  if (f !== undefined) fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`);
  if (LIVE) fs.writeFileSync(path.join(HERE, 'results', 'judged.jsonl'), rows.filter((r) => r['asked']).map((r) => JSON.stringify({ set: r['set'], case: r['case'], coreSet: r['coreSet'], key: r['key'], via: r['via'], from: r['from'], mirror: r['answer'], reason: r['reason'] })).join('\n') + '\n');
}
void main();
