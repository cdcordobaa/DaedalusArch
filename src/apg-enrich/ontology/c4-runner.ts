/**
 * The C4 run (v1.4 U9; `ops/notes/c4-01-interpretation-design.md` §4, §5, §9). One call per finding per run, through
 * the ontology `ModelCaller`: the same cache key, cassettes, budget, one schema retry and stop codes as C1d, under the
 * pass id `interpret`. Every answer is schema-validated by the caller, then grounded (`groundC4Answer`) and merged
 * across runs (`mergeRuns`).
 *
 * - `estimateInterpretation` counts calls and prompt tokens and calls nothing (the `--estimate` of C4-01 §9).
 * - Replay answers from the cassettes only; a miss is an invalid run, never a call.
 * - `c4MockResponder` is a scripted, deterministic stand-in (NOT model output) for tests and dry runs: it answers
 *   what the zero-call keyword baseline says, so a mock run shows the pipeline end to end at 0 model calls.
 */
import * as path from 'node:path';
import { sha256Hex } from '../../llm-critic/canonical-json.js';
import { OntologyCache } from './cache.js';
import type { CacheMode } from './cache.js';
import { ModelCaller, recordedKey } from './caller.js';
import type { FileReader } from './grounding.js';
import type { OntologyModelRequest, OntologyProvider } from './provider.js';
import type { ProjectDoc } from './reading.js';
import type { CallStats, OntologyStop } from './types.js';
import { a5Entry, groundC4Answer, keywordBaseline } from './c4-contract.js';
import type { A5Entry, A5File, C4Run } from './c4-contract.js';
import { INTERPRETATION_PROMPT_VERSION, INTERPRETATION_SCHEMA, INTERPRETATION_SYSTEM, interpretationPrompt } from './interpretation.js';
import type { C4Answer, InterpretationContext } from './interpretation.js';

export const C4_DEFAULTS = Object.freeze({ runs: 2, budget: 80 });

export interface C4RunOptions {
  readonly provider: OntologyProvider;
  readonly cacheMode: CacheMode;
  readonly cacheDir: string | null;
  /** Provider calls allowed (retries included); cache hits are free. C4-01 §9 caps: pilot 24, six cases 80 per vendor. */
  readonly budget?: number;
  readonly runs?: number;
  readonly runId?: string;
  readonly now?: () => string;
}

export interface C4RunResult {
  readonly entries: readonly A5Entry[];
  readonly calls: CallStats;
  readonly stopped: OntologyStop | null;
}

export interface C4Item {
  readonly context: InterpretationContext;
  /** The project's docs and file reader, for grounding the answer. */
  readonly docs: readonly ProjectDoc[];
  readonly read: FileReader;
}

function request(item: C4Item, runIndex: number): OntologyModelRequest {
  return {
    pass: 'interpret', itemId: item.context.finding.id, itemName: `${item.context.finding.rule} ${item.context.finding.files[0] ?? ''}`.trim(),
    runIndex, system: INTERPRETATION_SYSTEM, prompt: interpretationPrompt(item.context), schema: INTERPRETATION_SCHEMA,
  };
}

function callerOf(o: C4RunOptions): ModelCaller {
  return new ModelCaller({
    provider: o.provider, cache: new OntologyCache(o.cacheMode, o.cacheDir), budget: o.budget ?? C4_DEFAULTS.budget,
    runId: o.runId ?? 'c4', promptVersion: INTERPRETATION_PROMPT_VERSION, ...(o.now !== undefined ? { now: o.now } : {}),
  });
}

/** Interprets every item `runs` times. Order: item by item, run 0 then run 1, so a stop leaves whole items recorded. */
export async function interpretFindings(items: readonly C4Item[], o: C4RunOptions): Promise<C4RunResult> {
  const caller = callerOf(o);
  const runs = o.runs ?? C4_DEFAULTS.runs;
  const entries: A5Entry[] = [];
  for (const item of items) {
    const out: C4Run[] = [];
    for (let r = 0; r < runs; r++) {
      const req = request(item, r);
      const promptHash = sha256Hex(req.prompt);
      const res = await caller.call<C4Answer>(req);
      if (res.kind === 'ok') {
        out.push({
          runIndex: r, grounded: groundC4Answer(res.value, item.docs, item.read), modelId: res.provenance.model, promptHash,
          date: caller.recordedDates().get(recordedKey(promptHash, r)) ?? null, invalidReason: null,
        });
      } else {
        out.push({ runIndex: r, grounded: null, modelId: null, promptHash, date: null, invalidReason: res.kind === 'invalid' ? res.reason : res.kind });
      }
    }
    entries.push(a5Entry(item.context.finding, INTERPRETATION_PROMPT_VERSION, out));
  }
  return { entries, calls: caller.stats(), stopped: caller.stopped };
}

export interface C4Estimate {
  readonly findings: number;
  readonly runs: number;
  /** Uncached findings × runs (C4-01 §9 "expected"). */
  readonly expectedCalls: number;
  /** Uncached findings × runs × (1 + one retry) (C4-01 §9 "upper bound"). */
  readonly upperBound: number;
  /** Calls already answered by the cache (free). */
  readonly cached: number;
  /** ~chars / 4 over every uncached prompt and the system prompt. */
  readonly promptTokens: number;
  readonly budget: number;
  readonly withinBudget: boolean;
}

/** Counts the calls and prompt tokens of a C4 run. Calls nothing; reads the cache only. */
export function estimateInterpretation(items: readonly C4Item[], o: Omit<C4RunOptions, 'now'>): C4Estimate {
  const caller = callerOf(o);
  const runs = o.runs ?? C4_DEFAULTS.runs;
  let cached = 0;
  let tokens = 0;
  for (const item of items) {
    for (let r = 0; r < runs; r++) {
      const req = request(item, r);
      if (caller.isCached(req)) cached++;
      else tokens += Math.ceil((req.prompt.length + req.system.length) / 4);
    }
  }
  const expectedCalls = items.length * runs - cached;
  const budget = o.budget ?? C4_DEFAULTS.budget;
  return { findings: items.length, runs, expectedCalls, upperBound: expectedCalls * 2, cached, promptTokens: tokens, budget, withinBudget: expectedCalls <= budget };
}

export function a5File(projectId: string, provider: { readonly provider: string; readonly model: string }, runs: number, exploratory: boolean, entries: readonly A5Entry[]): A5File {
  return {
    schemaVersion: 1, artifact: 'A5', project: { id: projectId },
    producer: { part: 'C4', promptVersion: INTERPRETATION_PROMPT_VERSION, provider: provider.provider, model: provider.model, runs, exploratory },
    entries,
  };
}

/**
 * The scripted C4 mock (NOT model output): for each request it answers what the keyword baseline says about that
 * finding. `items` maps a finding id to its item (the responder needs the docs and the class names).
 */
export function c4MockResponder(items: ReadonlyMap<string, C4Item & { readonly classNames: readonly string[] }>): (req: OntologyModelRequest) => unknown {
  return (req) => {
    const item = items.get(req.itemId);
    if (item === undefined || req.pass !== 'interpret') return null;
    const f = item.context.finding;
    const b = keywordBaseline(f, item.classNames, item.docs, item.read);
    const cite = b.citation === null ? [] : [`${b.citation.path}:${String(b.citation.startLine)}`];
    return {
      explanation: `scripted mock: ${f.rule} flags ${f.files.map((x) => path.posix.basename(x)).join(' -> ')}.`,
      intentMatch: { status: b.claimed ? 'consistent-with-declared-intent' : 'no-declared-intent', cites: cite },
      exceptionClaim: b.claimed ? { claimed: true, citation: b.citation, scope: f.files.join(' -> ') } : { claimed: false, citation: null, scope: null },
      severityClass: b.claimed ? 'low' : 'high',
      cites: cite,
    };
  };
}
