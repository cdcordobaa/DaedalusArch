/**
 * SEM-GATE-2: the zero-agent gate for R-MIRROR-SEM v1.5.9 (core-side candidates), criteria fixed in `GATE.md` before
 * any judge call. Runs the rule (R-MIRROR-SEM only, the in-memory graph, the frozen Cypher) on
 *   - the 20 fresh cases of `cases.json` (counted: criteria 1 and 2a), and
 *   - the 53 SEM-GATE cases of `experiments/sem-gate/cases.json` (the 33 negatives: criterion 2b; the 4 form-A and 16
 *     form-B positives: reported, not counted).
 * Judge: the existing Claude CLI judge route (`cliCaller`, `claude-opus-5-5`). A question SEM-GATE already asked is
 * answered from its committed cache (`experiments/sem-gate/cache`, replay, zero calls); every other question is asked
 * once (live) and cached in `cache/`; every real call is a line of `results/calls.jsonl`. Without `--live` the judge is
 * replay-only (a miss is not asked).
 *
 *   npx tsx experiments/sem-gate-2/gate.ts [--live] [--latency experiments/sem-gate-2/results/deferred-latency.json]
 *     [--out experiments/sem-gate-2/result.json]
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph, loadRules, runTree } from '../../src/v15-instrument/index.js';
import {
  cliCaller, createMirrorJudge, mirrorKeyOf, mirrorPrompt, MIRROR_SEM_MODEL, MIRROR_SEM_RULE, MIRROR_SEM_VERSION, structureHolds,
  type Judged, type MirrorCandidateFact, type MirrorJudge,
} from '../../src/v15-instrument/mirror-sem.js';
import { INSTRUMENT_ID } from '../../src/v15-instrument/rule-set.js';

const HERE = path.join('experiments', 'sem-gate-2');
const OLD = path.join('experiments', 'sem-gate');
const SESSIONS = 'results/v1.5-hx-study/hx-study/sessions';
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIVE = process.argv.includes('--live');

interface Case {
  id: string; source: 'built' | 'kept'; task: string; tree?: string; sessions?: string[]; step?: string; spec: string; baseline?: string;
  target: { file: string; coreSet: string }; key?: string | null; label: 'positive' | 'negative'; form: 'A' | 'B' | null; twin: boolean; note: string;
}
type Set_ = 'fresh' | 'original';

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
  const fresh = (JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')) as { cases: Case[] }).cases;
  const oldMan = JSON.parse(fs.readFileSync(path.join(OLD, 'cases.json'), 'utf8')) as { keptFrom: { commit: string }; cases: Case[] };
  const all: { c: Case; set: Set_ }[] = [...fresh.map((c) => ({ c, set: 'fresh' as const })), ...oldMan.cases.map((c) => ({ c, set: 'original' as const }))];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-gate-2-'));
  const rules = loadRules().filter((r) => r.id === MIRROR_SEM_RULE);
  if (rules.length !== 1) throw new Error('R-MIRROR-SEM rule not found');
  const sessions = [...new Set(oldMan.cases.filter((c) => c.source === 'kept').map((c) => c.sessions![0]!))].sort();
  if (sessions.length > 0) {
    const paths = sessions.flatMap((s) => [`${SESSIONS}/${s}/snap/step-00`, `${SESSIONS}/${s}/snap/step-03`]);
    const tar = path.join(scratch, 'kept.tar');
    execFileSync('git', ['archive', '--output', tar, oldMan.keptFrom.commit, ...paths]);
    execFileSync('tar', ['-x', '-f', tar, '-C', scratch]);
  }
  const treeOf = (c: Case): { tree: string; baseline?: string } => (c.source === 'kept'
    ? { tree: path.join(scratch, SESSIONS, c.sessions![0]!, 'snap', c.step!), baseline: path.join(scratch, SESSIONS, c.sessions![0]!, 'snap', 'step-00') }
    : { tree: c.tree!, ...(c.baseline !== undefined ? { baseline: c.baseline } : {}) });

  const ledger = path.join(HERE, 'results', 'calls.jsonl');
  const old = createMirrorJudge({ mode: 'replay', cacheDir: path.join(OLD, 'cache') });
  const inner = createMirrorJudge({ mode: LIVE ? 'live' : 'replay', cacheDir: path.join(HERE, 'cache'), ...(LIVE ? { caller: cliCaller() } : {}), ledger });
  const seen = new Map<string, { judged: Judged; prompt: string; via: 'sem-gate-cache' | 'sem-gate-2' }>();
  const judge: MirrorJudge = {
    stats: inner.stats,
    async judge(c: MirrorCandidateFact): Promise<Judged> {
      const o = await old.judge(c);
      const j = o.verdict !== null ? o : await inner.judge(c);
      if (!seen.has(j.key)) seen.set(j.key, { judged: j, prompt: mirrorPrompt(c), via: o.verdict !== null ? 'sem-gate-cache' : 'sem-gate-2' });
      return j;
    },
  };

  const byTree = new Map<string, { c: Case; set: Set_ }[]>();
  for (const x of all) { const t = treeOf(x.c).tree; byTree.set(t, [...(byTree.get(t) ?? []), x]); }
  const rows: Record<string, unknown>[] = [];
  const t0 = Date.now();
  for (const [tree, cs] of byTree) {
    const c0 = cs[0]!.c;
    const base = treeOf(c0).baseline;
    const opts = { spec: c0.spec, withApg: false, scratch, ...(base !== undefined ? { baseline: base } : {}) };
    const { facts } = await buildGraph(tree, opts);
    const r = await runTree(tree, rules, { ...opts, mirrorJudge: judge });
    for (const { c, set } of cs) {
      const cand = facts.mirrorCandidates.find((x) => x.file === c.target.file && x.coreSet === c.target.coreSet);
      const asked = cand !== undefined && structureHolds(cand);
      const key = asked ? mirrorKeyOf(cand) : null;
      const j = key !== null ? seen.get(key) : undefined;
      const fired = r.findings.filter((f) => f.rule === MIRROR_SEM_RULE && f.status === 'violation' && f.file === c.target.file && f.subject === c.target.coreSet);
      const problems = [
        ...fired.flatMap((f) => citationProblems(tree, f.evidence.split(' | model fact: ')[0]!, null, 'evidence')),
        ...fired.filter((f) => f.line === null || !fs.existsSync(path.join(tree, f.file)) || f.line > fs.readFileSync(path.join(tree, f.file), 'utf8').split('\n').length).map((f) => `finding: ${f.file}:${String(f.line)} does not exist`),
        ...(j?.judged.verdict !== null && j?.judged.verdict !== undefined ? citationProblems(tree, j.judged.verdict.reason, j.prompt, 'reason') : []),
      ];
      const sameQuestion = set === 'original' ? (c.key === null || c.key === undefined ? key === null : key !== null && key.startsWith(c.key.slice(0, 24))) : null;
      rows.push({
        id: c.id, set, source: c.source, task: c.task, label: c.label, form: c.form, twin: c.twin, target: c.target,
        candidate: cand !== undefined, mapSide: cand?.mapSide ?? (cand !== undefined ? 'adapter' : null), asked, key: key?.slice(0, 24) ?? null, sameQuestionAsSemGate: sameQuestion,
        answer: j?.judged.verdict?.mirror ?? (asked ? 'no-answer' : null), reason: j?.judged.verdict?.reason ?? null, via: j?.via ?? null, from: j?.judged.from ?? null,
        fired: fired.length > 0, citationProblems: problems,
      });
      process.stdout.write(`${set.padEnd(8)} ${c.id.padEnd(26)} ${c.label.padEnd(9)} ${(c.form ?? '-').padEnd(2)} asked ${asked ? 'y' : 'n'} ${String(cand?.mapSide ?? '').padEnd(4)} answer ${String(j?.judged.verdict?.mirror ?? '-').padEnd(7)} fired ${fired.length > 0 ? 'y' : 'n'} cites ${String(problems.length)}\n`);
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const wallMs = Date.now() - t0;

  const pick = (set: Set_, label: string, form?: 'A' | 'B'): Record<string, unknown>[] => rows.filter((r) => r['set'] === set && r['label'] === label && (form === undefined || r['form'] === form));
  const recall = (xs: Record<string, unknown>[]): { n: number; fired: number; recall: number | null } => ({ n: xs.length, fired: xs.filter((r) => r['fired']).length, recall: xs.length > 0 ? xs.filter((r) => r['fired']).length / xs.length : null });
  const fpOf = (xs: Record<string, unknown>[]): { n: number; fired: number; ids: unknown[] } => ({ n: xs.length, fired: xs.filter((r) => r['fired']).length, ids: xs.filter((r) => r['fired']).map((r) => r['id']) });
  const r1 = recall(pick('fresh', 'positive'));
  const f2a = fpOf(pick('fresh', 'negative'));
  const f2b = fpOf(pick('original', 'negative'));
  const cites = rows.flatMap((r) => (r['citationProblems'] as string[]).map((p) => `${String(r['set'])}/${String(r['id'])}: ${p}`));
  const calls = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8').trim().split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as { durationMs: number; ok: boolean; key: string }) : [];
  const msByKey = new Map<string, number>();
  for (const x of calls) msByKey.set(x.key, (msByKey.get(x.key) ?? 0) + x.durationMs);
  const askedKeys = [...new Set(rows.filter((r) => r['asked'] && r['via'] === 'sem-gate-2').map((r) => String(r['key'])))];
  const sorted = askedKeys.filter((k) => msByKey.has(k)).map((k) => msByKey.get(k)!).sort((a, b) => a - b);
  const median = sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;

  const latFile = argOf('--latency');
  const lat = latFile !== undefined && fs.existsSync(latFile) ? (JSON.parse(fs.readFileSync(latFile, 'utf8')) as { summary: { p95CheckMs: number; maxAddedMs: number; minCallMs: number | null; firedAfterSettle: boolean; pushes: number; calls: number } }).summary : null;
  const c4 = lat === null ? null : lat.p95CheckMs < 5000 && lat.minCallMs !== null && lat.maxAddedMs < Math.min(1000, lat.minCallMs);

  const criteria = [
    { id: '1', what: 'form-A recall >= 0.80 on the fresh positives (the rule fires on the target set)', value: r1, pass: r1.recall !== null && r1.recall >= 0.8 },
    { id: '2a', what: 'false positives <= 1 on the fresh negatives', value: f2a, pass: f2a.fired <= 1 },
    { id: '2b', what: 'false positives <= 1 on the 33 SEM-GATE negatives, under v1.5.9', value: f2b, pass: f2b.fired <= 1 },
    { id: '3', what: '0 hallucinated citations (finding locations and evidence sites exist; every path, line and quoted token in a model reason exists), every case of both sets', value: { problems: cites.length, list: cites }, pass: cites.length === 0 },
    { id: '4', what: 'deferred mode: hub p95 check < 5 s with the judge deferred, and no push check waits on a model call (added check time over control < min(1 s, the shortest call))', value: lat, pass: c4 },
  ];
  const verdict = criteria.every((c) => c.pass === true) ? 'PASS' : 'FAIL';
  const out = {
    gate: 'SEM-GATE-2', date: new Date().toISOString(), instrument: INSTRUMENT_ID, rule: MIRROR_SEM_RULE, version: MIRROR_SEM_VERSION, model: MIRROR_SEM_MODEL, live: LIVE,
    fresh: { cases: pick('fresh', 'positive').length + pick('fresh', 'negative').length, positives: pick('fresh', 'positive').length, negatives: pick('fresh', 'negative').length, twins: rows.filter((r) => r['set'] === 'fresh' && r['twin']).length },
    original: { cases: rows.filter((r) => r['set'] === 'original').length, sameQuestionAsSemGate: rows.filter((r) => r['set'] === 'original' && r['sameQuestionAsSemGate'] === true).length },
    criteria, verdict,
    reported: {
      seenFormA: recall(pick('original', 'positive', 'A')), seenFormB: recall(pick('original', 'positive', 'B')),
      answersFresh: Object.fromEntries(['yes', 'no', 'unsure', 'no-answer'].map((a) => [a, rows.filter((r) => r['set'] === 'fresh' && r['answer'] === a).length])),
      answersOriginal: Object.fromEntries(['yes', 'no', 'unsure', 'no-answer'].map((a) => [a, rows.filter((r) => r['set'] === 'original' && r['answer'] === a).length])),
      distinctQuestionsAskedHere: askedKeys.length, answeredFromSemGateCache: new Set(rows.filter((r) => r['via'] === 'sem-gate-cache').map((r) => r['key'])).size,
      gateCallsThisRun: judge.stats.calls, ledgerCalls: calls.length, ledgerFailed: calls.filter((x) => !x.ok).length,
      callsPerQuestion: askedKeys.length > 0 ? calls.length / askedKeys.length : null, medianCallMsPerQuestion: median, wallMs,
      latencyCalls: lat?.calls ?? null, firedAfterSettle: lat?.firedAfterSettle ?? null,
    },
    rows,
  };
  process.stdout.write(`${JSON.stringify({ verdict, criteria: criteria.map((c) => ({ id: c.id, pass: c.pass })), reported: out.reported })}\n`);
  const f = argOf('--out');
  if (f !== undefined) fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`);
  if (LIVE) fs.writeFileSync(path.join(HERE, 'results', 'judged.jsonl'), rows.filter((r) => r['asked']).map((r) => JSON.stringify({ set: r['set'], case: r['id'], key: r['key'], via: r['via'], from: r['from'], mirror: r['answer'], reason: r['reason'] })).join('\n') + '\n');
}
void main();
