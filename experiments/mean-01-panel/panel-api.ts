/**
 * MEAN-01 model panel over the Gemini Developer API (PROTOCOL.md addendum 1). Same prompt, schema and parser as
 * panel.ts; no tools offered; the key is read from GEMINI_API_KEY in the environment and never written anywhere.
 *
 *   npx tsx --env-file=<path to .env> experiments/mean-01-panel/panel-api.ts calibration   # C1-C5 x 3, cap 20
 *   npx tsx --env-file=<path to .env> experiments/mean-01-panel/panel-api.ts sample        # 60 x 3, cap 80 per run
 *   npx tsx --env-file=<path to .env> experiments/mean-01-panel/panel-api.ts complete      # addendum 3: only runs that can change a label
 */
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toGeminiResponseSchema } from '../../src/llm-critic/gemini-provider.js';
import { RESPONSE_SCHEMA, allItems, parseAnswer, promptFor } from './panel.js';

const MODEL = 'gemini-4-argon';
const SYSTEM = 'You label one item for a research study. Reply with the requested JSON object only.';
const RUNS = 3;
const PAUSE_MS = 4000;
const LEDGER = 'experiments/mean-01-panel/results/api-calls.jsonl';
const POLICY_RE = /policy|safety|blocked|violat(e|es|ion)|abuse|prohibited/i;
const STOP_STATUS = new Set([401, 403, 429]);

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const which = process.argv[2] ?? '';
  if (which !== 'calibration' && which !== 'sample' && which !== 'complete') { process.stdout.write('usage: panel-api.ts calibration|sample|complete\n'); return; }
  const key = process.env.GEMINI_API_KEY ?? '';
  if (key === '') { process.stdout.write('STOP: GEMINI_API_KEY not set\n'); return; }
  const cap = which === 'calibration' ? 20 : 80;
  const { calibration, sample } = allItems();
  const items = which === 'calibration' ? calibration : sample;
  if (which === 'complete') return complete(key, sample);
  const done = new Set(fs.existsSync(LEDGER)
    ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { itemId: string; run: number; ok: boolean })
      .filter((c) => c.ok).map((c) => `${c.itemId}#${String(c.run)}`)
    : []);
  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiResponseSchema(RESPONSE_SCHEMA),
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingLevel: 'high' },
    } as never,
  });
  let calls = 0; let failStreak = 0;
  const totals = { prompt: 0, thoughts: 0, output: 0, cached: 0 };
  for (let run = 1; run <= RUNS; run++) {
    for (const it of items) {
      if (done.has(`${it.id}#${String(run)}`)) continue;
      const prompt = promptFor(it);
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (calls >= cap) { process.stdout.write(`STOP: call cap ${String(cap)} reached\n`); return report(totals, calls); }
        const t0 = Date.now(); calls++;
        const base = { itemId: it.id, run, attempt, at: new Date().toISOString(), route: 'gemini-api', requestedModel: MODEL, thinkingLevel: 'high', promptSha256: sha256(prompt) };
        let line: Record<string, unknown>; let ok = false; let stop = '';
        try {
          const res = await model.generateContent(prompt);
          const r = res.response as unknown as { candidates?: { content?: { parts?: { functionCall?: unknown }[] }; finishReason?: string }[]; modelVersion?: string; usageMetadata?: Record<string, number>; text: () => string };
          const u = r.usageMetadata ?? {};
          const usage = { prompt: u.promptTokenCount ?? 0, thoughts: u.thoughtsTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, cached: u.cachedContentTokenCount ?? 0 };
          totals.prompt += usage.prompt; totals.thoughts += usage.thoughts; totals.output += usage.output; totals.cached += usage.cached;
          const fn = (r.candidates ?? []).some((c) => (c.content?.parts ?? []).some((p) => p.functionCall !== undefined));
          if (fn) { stop = 'TOOL_USE'; line = { ...base, ok: false, errorCode: 'TOOL_USE', usage }; }
          else {
            const ans = parseAnswer(r.text());
            ok = ans !== null;
            line = { ...base, servedModel: r.modelVersion ?? null, finishReason: r.candidates?.[0]?.finishReason ?? null, usage, ok, ...(ans ? { answer: ans } : { errorCode: 'PARSE' }) };
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const status = (e as { status?: number }).status;
          if (POLICY_RE.test(msg)) stop = 'POLICY_SUSPECT';
          else if (status !== undefined && STOP_STATUS.has(status)) stop = `HTTP_${String(status)}`;
          line = { ...base, ok: false, errorCode: stop || `ERROR${status !== undefined ? `_${String(status)}` : ''}`, errorMessage: msg.replace(/key=[^&\s]+/gi, 'key=<redacted>').slice(0, 300) };
        }
        fs.appendFileSync(LEDGER, `${JSON.stringify({ ...line, durationMs: Date.now() - t0 })}\n`);
        process.stdout.write(`${it.id} run ${String(run)} attempt ${String(attempt)}: ${ok ? 'ok' : String(line.errorCode)} (${String(Math.round((Date.now() - t0) / 1000))} s)\n`);
        if (stop !== '') { process.stdout.write(`STOP: ${stop}; no further calls\n`); return report(totals, calls); }
        if (ok) { failStreak = 0; break; }
        if (++failStreak >= 3) { process.stdout.write('STOP: 3 failed calls in a row\n'); return report(totals, calls); }
        await sleep(PAUSE_MS);
      }
      await sleep(PAUSE_MS);
    }
  }
  report(totals, calls);
}

type LedgerLine = { itemId: string; run: number; ok: boolean; answer?: { A: string; B: string } };
const readLedger = (): LedgerLine[] => (fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LedgerLine) : []);
const SPEND_CAP_USD = 0.75;

/** Addendum 3: the lowest run without a valid answer, for an item whose majority on A or B can still change; null when none. */
function nextNeeded(ids: readonly string[], tried: ReadonlySet<string>): { id: string; run: number } | null {
  const valid = new Map<string, Map<number, { A: string; B: string }>>();
  for (const l of readLedger()) if (l.ok && l.answer) { if (!valid.has(l.itemId)) valid.set(l.itemId, new Map()); valid.get(l.itemId)?.set(l.run, l.answer); }
  for (const id of ids) {
    const v = valid.get(id) ?? new Map();
    const a = [...v.values()];
    const open = a.length < 2 || (a.length === 2 && (a[0]?.A !== a[1]?.A || a[0]?.B !== a[1]?.B));
    if (!open) continue;
    for (let run = 1; run <= RUNS; run++) if (!v.has(run) && !tried.has(`${id}#${String(run)}`)) return { id, run };
  }
  return null;
}

async function complete(key: string, items: ReturnType<typeof allItems>['sample']): Promise<void> {
  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiResponseSchema(RESPONSE_SCHEMA),
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingLevel: 'high' },
    } as never,
  });
  const byId = new Map(items.map((it) => [it.id, it]));
  const tried = new Set<string>();
  const totals = { prompt: 0, thoughts: 0, output: 0, cached: 0 };
  let calls = 0; let failStreak = 0;
  const spent = (): number => (totals.prompt * 2 + (totals.thoughts + totals.output) * 10) / 1e6;
  for (;;) {
    const next = nextNeeded(items.map((it) => it.id), tried);
    if (next === null) { process.stdout.write('DONE: no item can change its majority\n'); return report(totals, calls); }
    tried.add(`${next.id}#${String(next.run)}`);
    const it = byId.get(next.id);
    if (it === undefined) throw new Error(`unknown item ${next.id}`);
    const prompt = promptFor(it);
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (spent() >= SPEND_CAP_USD) { process.stdout.write(`STOP: spend guard (${spent().toFixed(2)} >= ${String(SPEND_CAP_USD)})\n`); return report(totals, calls); }
      const t0 = Date.now(); calls++;
      const base = { itemId: it.id, run: next.run, attempt, at: new Date().toISOString(), route: 'gemini-api', requestedModel: MODEL, thinkingLevel: 'high', promptSha256: sha256(prompt), mode: 'complete' };
      let line: Record<string, unknown>; let ok = false; let stop = '';
      try {
        const res = await model.generateContent(prompt);
        const r = res.response as unknown as { candidates?: { content?: { parts?: { functionCall?: unknown }[] }; finishReason?: string }[]; modelVersion?: string; usageMetadata?: Record<string, number>; text: () => string };
        const u = r.usageMetadata ?? {};
        const usage = { prompt: u.promptTokenCount ?? 0, thoughts: u.thoughtsTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, cached: u.cachedContentTokenCount ?? 0 };
        totals.prompt += usage.prompt; totals.thoughts += usage.thoughts; totals.output += usage.output; totals.cached += usage.cached;
        const fn = (r.candidates ?? []).some((c) => (c.content?.parts ?? []).some((p) => p.functionCall !== undefined));
        if (fn) { stop = 'TOOL_USE'; line = { ...base, ok: false, errorCode: 'TOOL_USE', usage }; }
        else {
          const ans = parseAnswer(r.text());
          ok = ans !== null;
          line = { ...base, servedModel: r.modelVersion ?? null, finishReason: r.candidates?.[0]?.finishReason ?? null, usage, ok, ...(ans ? { answer: ans } : { errorCode: 'PARSE' }) };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = (e as { status?: number }).status;
        if (POLICY_RE.test(msg)) stop = 'POLICY_SUSPECT';
        else if (status !== undefined && (STOP_STATUS.has(status) || status === 402)) stop = `HTTP_${String(status)}`;
        line = { ...base, ok: false, errorCode: stop || `ERROR${status !== undefined ? `_${String(status)}` : ''}`, errorMessage: status === 402 ? '[402 Payment Required] (billing text redacted)' : msg.replace(/key=[^&\s]+/gi, 'key=<redacted>').slice(0, 300) };
      }
      fs.appendFileSync(LEDGER, `${JSON.stringify({ ...line, durationMs: Date.now() - t0 })}\n`);
      process.stdout.write(`${it.id} run ${String(next.run)} attempt ${String(attempt)}: ${ok ? 'ok' : String(line.errorCode)} (${String(Math.round((Date.now() - t0) / 1000))} s, spent ${spent().toFixed(2)})\n`);
      if (stop !== '') { process.stdout.write(`STOP: ${stop}; no further calls\n`); return report(totals, calls); }
      if (ok) { failStreak = 0; break; }
      if (++failStreak >= 3) { process.stdout.write('STOP: 3 failed calls in a row\n'); return report(totals, calls); }
      await sleep(PAUSE_MS);
    }
    await sleep(PAUSE_MS);
  }
}

function report(t: { prompt: number; thoughts: number; output: number; cached: number }, calls: number): void {
  process.stdout.write(`${JSON.stringify({ calls, tokens: t })}\n`);
}

void main();
