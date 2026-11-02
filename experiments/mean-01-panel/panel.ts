/**
 * MEAN-01 model panel (C3m): each packet item is sent to agy (Gemini) three times, each a fresh one-shot call in a new
 * empty cwd, with the plain labelling prompt of `PROTOCOL.md` §3 (rater instructions + one item + answer format).
 * Nothing else is ever sent. Answers go to `results/calls.jsonl` (append-only ledger, resumable); item text is never
 * printed: the console shows ids, counts and error codes only.
 *
 *   npx tsx experiments/mean-01-panel/panel.ts preflight            # zero model calls: agy version, home, MCP, plugins
 *   npx tsx experiments/mean-01-panel/panel.ts prompt-sha            # prompt sha256 per item (no call, no text printed)
 *   npx tsx experiments/mean-01-panel/panel.ts run --items C1,C2      # pilot (3 runs each)
 *   npx tsx experiments/mean-01-panel/panel.ts run --items calibration|sample
 *   npx tsx experiments/mean-01-panel/panel.ts score                 # labels.json + result.json from the ledger
 *   npx tsx experiments/mean-01-panel/panel.ts audit                 # author-audit.md (30 ids, seed 20261102)
 *
 * Inputs read by the script only: `audit/view/mean-01-rater-packet.md`, `audit/view/mean-01-calibration.md`,
 * `results/v1.3-meaning/mean-01-sample.json` (strata and weights, for scoring only; never put in a prompt).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AGY_EXPLORATORY_VERSIONS, AGY_HOME_DEFAULT, AgyCliProvider, checkAgyIsolation, expandHome,
} from '../../src/llm-critic/agy-cli-provider.js';
import type { LLMCallContext, LLMOptions } from '../../src/shared/interfaces/llm-provider.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { mulberry32 } from '../../scripts/lib/mutation/rng.js';

const DIR = 'experiments/mean-01-panel';
const PACKET = 'audit/view/mean-01-rater-packet.md';
const CALIB = 'audit/view/mean-01-calibration.md';
const SAMPLE = 'results/v1.3-meaning/mean-01-sample.json';
const LEDGER = `${DIR}/results/calls.jsonl`;
export const MODEL = 'gemini-4-argon-high'; // `agy models`: "Gemini 4 Argon (High)"
const RUNS = 3;
const PAUSE_MS = 4000;
const PRINT_TIMEOUT_S = 240;
const BOOT_SEED = 20261018; // codebook §9.2
const BOOT_N = 10_000;
const AUDIT_SEED = 20261102;
const AUDIT_N = 30;
const STOP_CODES = new Set(['LLM_USAGE_LIMIT', 'LLM_AUTH', 'LLM_NOT_CONFIGURED', 'LLM_CLI_ISOLATION', 'LLM_CLI_VERSION_DRIFT', 'LLM_CLI_NOT_FOUND']);
const RETRY_CODES = new Set(['LLM_CLI_TIMEOUT', 'LLM_CLI_BAD_ENVELOPE', 'LLM_CLI_EXIT', 'LLM_CLI_TOOL_USE', 'PARSE']);
/** Text that suggests a policy or safety refusal: stop the whole run, do not retry. */
const POLICY_RE = /policy|safety|blocked|violat(e|es|ion) .*terms|abuse|prohibited/i;

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── Prompt (PROTOCOL.md §3; fixed before any call) ─────────────────────────────────────────

export const PREFACE = [
  'You are one independent rater in a research labelling study. This is a plain reading-and-labelling task.',
  'Answer in text only. Do not use any tools, do not run commands, do not read or write files, and do not open links. Judge only from the text in this message.',
  '',
  'The rater instructions follow (sections 0 to 4 of the rater packet, unchanged). Three of them work differently for you:',
  '- you cannot open the linked source file, so judge from the excerpt and the layer map shown with the item;',
  '- there is no calibration discussion and no answer sheet: you give your answer in the format at the end of this message;',
  '- you see one item only; answer it on its own.',
].join('\n');

export const ANSWER_FORMAT = [
  'Answer format. Reply with one JSON object and nothing else:',
  '{"A": "yes" | "no" | "unsure", "B": "yes" | "no" | "unsure", "why_not": "T" | "W" | "F" | "M" | "C" | "X" | "", "note": "<one line, may be empty>"}',
  '- A is question A (practitioner), B is question B (style fidelity), as defined in section 2.',
  '- why_not: one code from section 3 when A or B is "no"; otherwise "".',
  '- note: one optional line; required when you answer "unsure" or use code X.',
].join('\n');

export const RESPONSE_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    A: { type: 'string', enum: ['yes', 'no', 'unsure'] },
    B: { type: 'string', enum: ['yes', 'no', 'unsure'] },
    why_not: { type: 'string', enum: ['T', 'W', 'F', 'M', 'C', 'X', ''] },
    note: { type: 'string' },
  },
  required: ['A', 'B', 'why_not', 'note'],
  additionalProperties: false,
});

interface Item { readonly id: string; readonly block: string; readonly project: string }

function lines(file: string): string[] { return fs.readFileSync(file, 'utf8').split('\n'); }

/** Packet §0–§4: everything before `## 5.`. */
function packetHead(): string {
  const L = lines(PACKET);
  const end = L.findIndex((l) => l.startsWith('## 5. '));
  if (end < 0) throw new Error('packet: no §5 heading');
  return L.slice(0, end).join('\n').trim();
}

/** Item blocks: from `### <id>` to the `Open the full file` line inclusive (the answer box is left out). */
function itemsOf(file: string, re: RegExp): Item[] {
  const L = lines(file);
  const out: Item[] = [];
  for (let i = 0; i < L.length; i++) {
    const m = re.exec(L[i] ?? '');
    if (!m) continue;
    let j = i + 1;
    while (j < L.length && !(L[j] ?? '').startsWith('- **Open the full file:**')) j++;
    if (j >= L.length) throw new Error(`${file}: item ${m[1] ?? '?'} has no file link line`);
    const block = L.slice(i, j + 1).join('\n');
    const pm = /\(layer map: §L, `([^`]+)`\)/.exec(block);
    if (!pm) throw new Error(`${file}: item ${m[1] ?? '?'} names no layer map`);
    out.push({ id: m[1] as string, block, project: pm[1] as string });
    i = j;
  }
  return out;
}

function layerMaps(): { intro: string; byProject: Map<string, string> } {
  const L = lines(PACKET);
  const s = L.findIndex((l) => l.startsWith('## L. '));
  const e = L.findIndex((l, k) => k > s && l.startsWith('## Licences'));
  if (s < 0 || e < 0) throw new Error('packet: no §L');
  const byProject = new Map<string, string>();
  let introEnd = s + 1;
  while (introEnd < e && !(L[introEnd] ?? '').startsWith('### ')) introEnd++;
  const intro = L.slice(s + 1, introEnd).join('\n').trim();
  for (let i = introEnd; i < e; i++) {
    const m = /^### `([^`]+)`/.exec(L[i] ?? '');
    if (!m) continue;
    let j = i + 1;
    while (j < e && !(L[j] ?? '').startsWith('### ')) j++;
    byProject.set(m[1] as string, L.slice(i, j).join('\n').trim());
    i = j - 1;
  }
  return { intro, byProject };
}

export function allItems(): { calibration: Item[]; sample: Item[] } {
  const calibration = itemsOf(CALIB, /^### (C\d)\s*$/);
  const sample = itemsOf(PACKET, /^### (M\d\d)\s*$/);
  if (calibration.length !== 5 || sample.length !== 60) throw new Error(`expected 5 + 60 items, found ${String(calibration.length)} + ${String(sample.length)}`);
  return { calibration, sample };
}

export function promptFor(it: Item, head = packetHead(), maps = layerMaps()): string {
  const map = maps.byProject.get(it.project);
  if (map === undefined) throw new Error(`no layer map for item ${it.id}`);
  // The item heading is neutralised to "Item" so the id (and so the order) carries no signal.
  const block = it.block.replace(/^### \S+/, '### Item');
  return [
    PREFACE, '', '<<<RATER INSTRUCTIONS>>>', head, '<<<END RATER INSTRUCTIONS>>>', '',
    '<<<ITEM>>>', block, '', 'Layer map of this repository (from section L of the packet):', '', maps.intro, '', map, '<<<END ITEM>>>', '',
    ANSWER_FORMAT, '',
  ].join('\n');
}

// ── Answers ───────────────────────────────────────────────────────────────────────────────

type Val = 'yes' | 'no' | 'unsure';
interface Answer { readonly A: Val; readonly B: Val; readonly why_not: string; readonly note: string }
interface Call {
  readonly itemId: string; readonly run: number; readonly attempt: number; readonly at: string;
  readonly promptSha256: string; readonly requestedModel: string; readonly servedModel: string | null;
  readonly durationMs: number; readonly ok: boolean; readonly errorCode?: string; readonly answer?: Answer;
}

const VALS = new Set(['yes', 'no', 'unsure']);
const CODES = new Set(['T', 'W', 'F', 'M', 'C', 'X', '']);

export function parseAnswer(text: string): Answer | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch {
    const m = /\{[\s\S]*\}/.exec(text);
    if (!m) return null;
    try { v = JSON.parse(m[0]); } catch { return null; }
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const A = typeof o.A === 'string' ? o.A.trim().toLowerCase() : '';
  const B = typeof o.B === 'string' ? o.B.trim().toLowerCase() : '';
  const w = typeof o.why_not === 'string' ? o.why_not.trim().toUpperCase() : '';
  if (!VALS.has(A) || !VALS.has(B) || !CODES.has(w)) return null;
  return { A: A as Val, B: B as Val, why_not: w, note: typeof o.note === 'string' ? o.note : '' };
}

function readLedger(): Call[] {
  if (!fs.existsSync(LEDGER)) return [];
  return fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as Call);
}

async function preflight(): Promise<boolean> {
  const r = await checkAgyIsolation({ runner: new NodeProcessRunner(), home: expandHome(AGY_HOME_DEFAULT), exploratoryVersions: AGY_EXPLORATORY_VERSIONS });
  if (r.success) process.stdout.write(`preflight pass: agy ${r.data.cliVersion}\n`);
  else process.stdout.write(`preflight FAIL: ${r.errors.map((e) => `${e.code}: ${e.message} ${JSON.stringify(e.context ?? {})}`).join('; ')}\n`);
  return r.success;
}

async function run(which: string): Promise<void> {
  const { calibration, sample } = allItems();
  const pool = [...calibration, ...sample];
  const items = which === 'calibration' ? calibration : which === 'sample' ? sample
    : which.split(',').map((id) => { const it = pool.find((x) => x.id === id); if (!it) throw new Error(`unknown item ${id}`); return it; });
  if (!(await preflight())) return;
  const provider = new AgyCliProvider(
    { model: MODEL, home: expandHome(AGY_HOME_DEFAULT), mode: 'record', exploratoryVersions: AGY_EXPLORATORY_VERSIONS, printTimeoutS: PRINT_TIMEOUT_S },
    { runner: new NodeProcessRunner() },
  );
  const head = packetHead();
  const maps = layerMaps();
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  const done = new Set(readLedger().filter((c) => c.ok).map((c) => `${c.itemId}#${String(c.run)}`));
  let calls = 0;
  // Run-major order: run 1 of every item, then run 2, then run 3. Every call is a fresh process and cwd.
  for (let runNo = 1; runNo <= RUNS; runNo++) {
    for (const it of items) {
      if (done.has(`${it.id}#${String(runNo)}`)) continue;
      const prompt = promptFor(it, head, maps);
      for (let attempt = 1; attempt <= 2; attempt++) {
        const t0 = Date.now();
        const options: LLMOptions = { model: MODEL, maxTokens: 1024 }; // agy sends no max-token flag (reported as ignored)
        const ctx: LLMCallContext = { runIndex: runNo - 1, repetition: attempt - 1, functionId: `label:mean01:${it.id}`, responseSchema: RESPONSE_SCHEMA };
        const r = await provider.evaluate(prompt, options, ctx);
        calls++;
        const base = { itemId: it.id, run: runNo, attempt, at: new Date().toISOString(), promptSha256: sha256(prompt), requestedModel: MODEL, durationMs: Date.now() - t0 };
        let call: Call;
        if (r.success) {
          const ans = parseAnswer(r.data.content);
          call = ans ? { ...base, servedModel: r.data.model, ok: true, answer: ans } : { ...base, servedModel: r.data.model, ok: false, errorCode: 'PARSE' };
        } else {
          const e = r.errors[0];
          const policy = POLICY_RE.test(`${e?.message ?? ''} ${JSON.stringify(e?.context ?? {})}`);
          call = { ...base, servedModel: null, ok: false, errorCode: policy ? 'POLICY_SUSPECT' : (e?.code ?? 'UNKNOWN') };
        }
        fs.appendFileSync(LEDGER, `${JSON.stringify(call)}\n`);
        process.stdout.write(`${it.id} run ${String(runNo)} attempt ${String(attempt)}: ${call.ok ? 'ok' : (call.errorCode ?? '?')} (${String(Math.round(call.durationMs / 1000))} s; calls this session ${String(calls)})\n`);
        if (call.ok) break;
        if (call.errorCode === 'POLICY_SUSPECT' || STOP_CODES.has(call.errorCode ?? '')) {
          process.stdout.write(`STOP: ${call.errorCode ?? '?'}; no further calls\n`);
          return;
        }
        if (!RETRY_CODES.has(call.errorCode ?? '')) break;
        await sleep(PAUSE_MS);
      }
      await sleep(PAUSE_MS);
    }
  }
  process.stdout.write(`done: ${String(calls)} calls this session\n`);
}

// ── Scoring (codebook §4, §9.2; PROTOCOL.md §5) ───────────────────────────────────────────

export function majority(vals: readonly Val[]): Val | null {
  if (vals.length < 2) return null;
  const c = new Map<Val, number>();
  for (const v of vals) c.set(v, (c.get(v) ?? 0) + 1);
  const top = [...c.entries()].filter(([, n]) => n >= 2);
  return top.length === 1 ? (top[0] as [Val, number])[0] : 'unsure';
}

function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959964, p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

const r4 = (x: number): number => Math.round(x * 10_000) / 10_000;

interface SampleRow { readonly itemId: string; readonly stratum: string; readonly N_h: number; readonly project: string; readonly style: string }

function fleissKappaBinary(rows: readonly (readonly boolean[])[]): number | null {
  const R = rows.filter((r) => r.length === RUNS);
  if (R.length === 0) return null;
  let Pbar = 0, pYes = 0;
  for (const r of R) {
    const y = r.filter(Boolean).length, n = r.length, no = n - y;
    Pbar += (y * (y - 1) + no * (no - 1)) / (n * (n - 1));
    pYes += y / n;
  }
  Pbar /= R.length; pYes /= R.length;
  const Pe = pYes * pYes + (1 - pYes) * (1 - pYes);
  return Pe === 1 ? null : (Pbar - Pe) / (1 - Pe);
}

function score(): void {
  const { calibration, sample } = allItems();
  const ledger = readLedger();
  const meta = JSON.parse(fs.readFileSync(SAMPLE, 'utf8')) as { items: SampleRow[]; N_h: Record<string, number> };
  const rowOf = new Map(meta.items.map((r) => [r.itemId, r]));
  const okByItem = new Map<string, Call[]>();
  for (const c of ledger) if (c.ok) okByItem.set(c.itemId, [...(okByItem.get(c.itemId) ?? []), c]);
  const label = (it: Item): Record<string, unknown> => {
    const cs = (okByItem.get(it.id) ?? []).sort((a, b) => a.run - b.run).slice(0, RUNS);
    const A = cs.map((c) => (c.answer as Answer).A), B = cs.map((c) => (c.answer as Answer).B);
    return {
      itemId: it.id, runs: cs.map((c) => ({ run: c.run, A: (c.answer as Answer).A, B: (c.answer as Answer).B, why_not: (c.answer as Answer).why_not, note: (c.answer as Answer).note })),
      A_majority: majority(A), B_majority: majority(B),
    };
  };
  const calLabels = calibration.map(label);
  const labels = sample.map(label);
  fs.writeFileSync(`${DIR}/labels.json`, `${JSON.stringify({ id: 'MEAN-01-panel', model: MODEL, runsPerItem: RUNS, rule: 'majority of 3 runs per field; no value with >= 2 votes -> unsure; < 2 valid runs -> null (missing)', calibration: calLabels, items: labels }, null, 1)}\n`);

  const count = (xs: readonly unknown[]): Record<string, number> => {
    const o: Record<string, number> = { yes: 0, no: 0, unsure: 0, missing: 0 };
    for (const x of xs) o[x === null ? 'missing' : String(x)] = (o[x === null ? 'missing' : String(x)] ?? 0) + 1;
    return o;
  };
  const field = (f: 'A_majority' | 'B_majority'): Record<string, unknown> => {
    const valid = labels.filter((l) => l[f] !== null);
    const yes = valid.filter((l) => l[f] === 'yes').length;
    const strata = new Map<string, { N: number; byProject: Map<string, boolean[]> }>();
    for (const l of valid) {
      const row = rowOf.get(l.itemId as string);
      if (!row) throw new Error(`sample row missing for ${String(l.itemId)}`);
      const s = strata.get(row.stratum) ?? { N: row.N_h, byProject: new Map<string, boolean[]>() };
      s.byProject.set(row.project, [...(s.byProject.get(row.project) ?? []), l[f] === 'yes']);
      strata.set(row.stratum, s);
    }
    const Ntot = Object.values(meta.N_h).reduce((a, b) => a + b, 0);
    const est = (pick: (s: { N: number; byProject: Map<string, boolean[]> }) => boolean[]): number => {
      let p = 0;
      for (const s of strata.values()) { const xs = pick(s); p += (s.N / Ntot) * (xs.filter(Boolean).length / xs.length); }
      return p;
    };
    const pHat = est((s) => [...s.byProject.values()].flat());
    const rng = mulberry32(BOOT_SEED);
    const boots: number[] = [];
    for (let b = 0; b < BOOT_N; b++) {
      boots.push(est((s) => {
        const projs = [...s.byProject.keys()].sort();
        const out: boolean[] = [];
        for (let k = 0; k < projs.length; k++) out.push(...(s.byProject.get(projs[Math.floor(rng.next() * projs.length)] as string) as boolean[]));
        return out;
      }));
    }
    boots.sort((a, b) => a - b);
    const strataCovered = strata.size;
    return {
      counts: count(labels.map((l) => l[f])),
      stratifiedYesShare: r4(pHat),
      stratifiedCI95: [r4(boots[Math.floor(0.025 * BOOT_N)] as number), r4(boots[Math.floor(0.975 * BOOT_N) - 1] as number)],
      bootstrap: `stratified project-cluster percentile bootstrap, ${String(BOOT_N)} resamples, mulberry32 seed ${String(BOOT_SEED)}`,
      weightTotal: Ntot, strataWithLabels: strataCovered, strataInSample: Object.keys(meta.N_h).length,
      unweightedYesShare: r4(yes / Math.max(1, valid.length)), unweightedWilson95: wilson(yes, valid.length).map(r4), n: valid.length,
    };
  };
  const perStratum: Record<string, Record<string, Record<string, number>>> = {};
  const perStyle: Record<string, Record<string, number>> = {};
  for (const l of labels) {
    const row = rowOf.get(l.itemId as string) as SampleRow;
    perStratum[row.stratum] ??= { A: { yes: 0, no: 0, unsure: 0, missing: 0 }, B: { yes: 0, no: 0, unsure: 0, missing: 0 } };
    const ps = perStratum[row.stratum] as Record<string, Record<string, number>>;
    const ka = l.A_majority === null ? 'missing' : String(l.A_majority), kb = l.B_majority === null ? 'missing' : String(l.B_majority);
    (ps.A as Record<string, number>)[ka] = ((ps.A as Record<string, number>)[ka] ?? 0) + 1;
    (ps.B as Record<string, number>)[kb] = ((ps.B as Record<string, number>)[kb] ?? 0) + 1;
    perStyle[row.style] ??= { yes: 0, no: 0, unsure: 0, missing: 0 };
    (perStyle[row.style] as Record<string, number>)[ka] = ((perStyle[row.style] as Record<string, number>)[ka] ?? 0) + 1;
  }
  const axb: Record<string, number> = {};
  for (const l of labels) { const k = `A=${String(l.A_majority)}|B=${String(l.B_majority)}`; axb[k] = (axb[k] ?? 0) + 1; }
  const whyNot: Record<string, number> = {};
  for (const l of labels) for (const r of l.runs as { why_not: string }[]) if (r.why_not !== '') whyNot[r.why_not] = (whyNot[r.why_not] ?? 0) + 1;
  const runRows = (f: 'A' | 'B'): boolean[][] => labels.map((l) => (l.runs as Answer[]).map((r) => r[f] === 'yes'));
  const unanimous = (f: 'A' | 'B'): number => labels.filter((l) => { const rs = (l.runs as Answer[]).map((r) => r[f]); return rs.length === RUNS && rs.every((v) => v === rs[0]); }).length;
  const rawUnsure = labels.flatMap((l) => (l.runs as Answer[]).map((r) => r.A)).filter((v) => v === 'unsure').length;
  const rawA = labels.flatMap((l) => l.runs as Answer[]).length;
  const missing = labels.filter((l) => l.A_majority === null).map((l) => l.itemId);
  const failures: Record<string, number> = {};
  for (const c of ledger) if (!c.ok) failures[c.errorCode ?? '?'] = (failures[c.errorCode ?? '?'] ?? 0) + 1;
  const served = [...new Set(ledger.filter((c) => c.servedModel !== null).map((c) => c.servedModel))];
  const result = {
    id: 'MEAN-01-panel', claim: 'C3m', status: missing.length > 6 ? 'incomplete, below protocol (more than 6 items missing)' : 'complete',
    rater: { route: 'agy (Antigravity CLI) labeller home, one-shot, no tools, fresh empty cwd per call', requestedModel: MODEL, servedModels: served, runsPerItem: RUNS },
    primaryField: 'A_practitioner (codebook §2, L4 = A)',
    C3m: { definition: 'stratified share of the 60 sampled correct blocking findings whose primary field (A) majority label is yes: p = sum_h (N_h / N) * p_h (codebook §9.2)', A: field('A_majority'), B_secondary: field('B_majority') },
    unsure: { rawRunUnsureRateA: r4(rawUnsure / Math.max(1, rawA)), majorityUnsureA: labels.filter((l) => l.A_majority === 'unsure').length, flagAbove15pct: rawUnsure / Math.max(1, rawA) > 0.15 },
    missingItems: missing,
    perStratum, perStyleA: perStyle, AxB: axb, whyNotCodesAllRuns: whyNot,
    panelConsistency: { unanimousA: unanimous('A'), unanimousB: unanimous('B'), fleissKappaA_binary: (() => { const k = fleissKappaBinary(runRows('A')); return k === null ? null : r4(k); })(), fleissKappaB_binary: (() => { const k = fleissKappaBinary(runRows('B')); return k === null ? null : r4(k); })() },
    calibration: { items: calLabels.length, withMajorityA: calLabels.filter((l) => l.A_majority !== null).length, note: 'calibration answers never count (codebook §4.3); not compared with the worked answers here' },
    calls: { total: ledger.length, ok: ledger.filter((c) => c.ok).length, failed: ledger.length - ledger.filter((c) => c.ok).length, failuresByCode: failures, sampleCalls: ledger.filter((c) => c.itemId.startsWith('M')).length, calibrationCalls: ledger.filter((c) => c.itemId.startsWith('C')).length },
  };
  fs.writeFileSync(`${DIR}/result.json`, `${JSON.stringify(result, null, 1)}\n`);
  process.stdout.write(`labels: ${String(labels.length)} items, missing ${String(missing.length)}; A ${JSON.stringify(result.C3m.A.counts)}; C3m A ${String(result.C3m.A.stratifiedYesShare)} ${JSON.stringify(result.C3m.A.stratifiedCI95)}; calls ${String(result.calls.total)} (failed ${String(result.calls.failed)})\n`);
}

export function auditIds(): string[] {
  const ids = Array.from({ length: 60 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`);
  return [...mulberry32(AUDIT_SEED).pickDistinct(ids, AUDIT_N)].sort();
}

function promptShas(): void {
  const { calibration, sample } = allItems();
  const head = packetHead(), maps = layerMaps();
  const rows = [...calibration, ...sample].map((it) => ({ itemId: it.id, promptSha256: sha256(promptFor(it, head, maps)) }));
  fs.mkdirSync(`${DIR}/results`, { recursive: true });
  fs.writeFileSync(`${DIR}/results/prompt-sha256.json`, `${JSON.stringify({ templateSha256: sha256(`${PREFACE}\n${ANSWER_FORMAT}\n${RESPONSE_SCHEMA}`), packetHeadSha256: sha256(head), items: rows }, null, 1)}\n`);
  process.stdout.write(`prompt shas: ${String(rows.length)} items\n`);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'preflight') { await preflight(); return; }
  if (cmd === 'prompt-sha') { promptShas(); return; }
  if (cmd === 'run') { const i = rest.indexOf('--items'); await run(i >= 0 ? (rest[i + 1] ?? '') : 'sample'); return; }
  if (cmd === 'score') { score(); return; }
  if (cmd === 'audit') { process.stdout.write(`${auditIds().join(',')}\n`); return; }
  process.stdout.write('usage: panel.ts preflight|prompt-sha|run --items <ids|calibration|sample>|score|audit\n');
}

if ((process.argv[1] ?? '').endsWith('panel.ts')) void main();
