/**
 * Ontology v0 model caller: cache, call budget, one retry, JSON-schema validation and the stop rule, in one place.
 *
 * - The budget counts provider calls (retries included), never cache hits. When it is spent, every further call is
 *   skipped and counted.
 * - A stop code (`STOP_CODES`: usage limit, auth, isolation, version drift, missing CLI) ends the run: the caller
 *   records the stop and answers every later call with `stopped`. What was recorded stays in the cache, so a rerun
 *   resumes where the run stopped.
 * - An answer that fails the pass's JSON schema is retried once, then the item is invalid.
 */
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import { canonicalJSON, sha256Hex } from '../../llm-critic/canonical-json.js';
import type { OntologyCache } from './cache.js';
import { cacheKeyOf, ONTOLOGY_CACHE_SCHEMA_VERSION } from './cache.js';
import type { OntologyModelRequest, OntologyProvider } from './provider.js';
import { STOP_CODES } from './provider.js';
import type { CallStats, OntologyStop, SemProvenance } from './types.js';

export type CallOutcome<T> =
  | { readonly kind: 'ok'; readonly value: T; readonly provenance: SemProvenance; readonly cached: boolean }
  | { readonly kind: 'invalid'; readonly reason: string }
  | { readonly kind: 'budget' }
  | { readonly kind: 'stopped' };

/** The key of `ModelCaller.recordedDates()`. */
export function recordedKey(promptHash: string, runIndex: number): string {
  return `${promptHash}|${String(runIndex)}`;
}

export interface CallerOptions {
  readonly provider: OntologyProvider;
  readonly cache: OntologyCache;
  readonly budget: number;
  readonly runId: string;
  readonly promptVersion: string;
  readonly omitPrompts?: boolean;
  readonly now?: () => string;
}

export class ModelCaller {
  private providerCalls = 0;
  private cacheHits = 0;
  private invalid = 0;
  private skippedForBudget = 0;
  private cassetteMisses = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private stop: OntologyStop | null = null;
  private readonly ajv = new Ajv({ strict: false, allErrors: false });
  private readonly validators = new Map<string, ValidateFunction>();
  /** `recordedAt` of every answer used, by `<promptHash>|<runIndex>` (A2 fact dates; a replay keeps the recorded date). */
  private readonly recorded = new Map<string, string>();

  constructor(private readonly options: CallerOptions) {}

  get stopped(): OntologyStop | null {
    return this.stop;
  }

  /** When each answer used by this run was recorded, keyed `<promptHash>|<runIndex>` (see `recordedKey`). */
  recordedDates(): ReadonlyMap<string, string> {
    return new Map(this.recorded);
  }

  stats(): CallStats {
    return {
      providerCalls: this.providerCalls, cacheHits: this.cacheHits, invalid: this.invalid,
      skippedForBudget: this.skippedForBudget, cassetteMisses: this.cassetteMisses,
      usage: { inputTokens: this.inputTokens, outputTokens: this.outputTokens },
    };
  }

  private validator(schema: Readonly<Record<string, unknown>>): ValidateFunction {
    const k = canonicalJSON(schema);
    let v = this.validators.get(k);
    if (v === undefined) {
      v = this.ajv.compile(schema);
      this.validators.set(k, v);
    }
    return v;
  }

  /** The cache key and prompt hash of a request (no I/O). */
  keyOf(req: Omit<OntologyModelRequest, 'itemName'>): { readonly key: string; readonly promptHash: string } {
    const d = this.options.provider.describe();
    const promptHash = sha256Hex(req.prompt);
    const key = cacheKeyOf({
      promptVersion: this.options.promptVersion, pass: req.pass, provider: d.provider, model: d.model,
      systemHash: sha256Hex(req.system), schemaHash: sha256Hex(canonicalJSON(req.schema)), promptHash, runIndex: req.runIndex,
    });
    return { key, promptHash };
  }

  /** True when the request is already in the cache (estimates). */
  isCached(req: Omit<OntologyModelRequest, 'itemName'>): boolean {
    return this.options.cache.get(this.keyOf(req).key) !== null;
  }

  async call<T>(req: OntologyModelRequest): Promise<CallOutcome<T>> {
    if (this.stop !== null) return { kind: 'stopped' };
    const d = this.options.provider.describe();
    const { key, promptHash } = this.keyOf(req);
    const validate = this.validator(req.schema);
    const provenance = (model: string): SemProvenance => ({ model, promptHash, runId: this.options.runId, temperature: d.temperature });
    const hit = this.options.cache.get(key);
    if (hit !== null) {
      this.cacheHits++;
      if (!validate(hit.response)) {
        this.invalid++;
        return { kind: 'invalid', reason: `cached answer fails the ${req.pass} schema` };
      }
      this.recorded.set(recordedKey(promptHash, req.runIndex), hit.recordedAt);
      return { kind: 'ok', value: hit.response as T, provenance: provenance(hit.resolvedModel), cached: true };
    }
    if (this.options.cache.mode === 'replay') {
      this.cassetteMisses++;
      this.invalid++;
      return { kind: 'invalid', reason: `cassette miss ${key}` };
    }
    let lastReason = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      if (this.providerCalls >= this.options.budget) {
        this.skippedForBudget++;
        return { kind: 'budget' };
      }
      this.providerCalls++;
      const res = await this.options.provider.complete(req);
      if (!res.success) {
        const e = res.errors[0];
        const code = e?.code ?? 'LLM_CALL_FAILED';
        if (STOP_CODES.has(code)) {
          this.stop = { code, message: e?.message ?? code, pass: req.pass };
          return { kind: 'stopped' };
        }
        lastReason = `${code}: ${e?.message ?? ''}`;
        continue;
      }
      this.inputTokens += res.data.usage.inputTokens;
      this.outputTokens += res.data.usage.outputTokens;
      if (!validate(res.data.json)) {
        lastReason = `answer fails the ${req.pass} schema: ${this.ajv.errorsText(validate.errors)}`;
        continue;
      }
      const recordedAt = (this.options.now ?? ((): string => new Date().toISOString()))();
      this.recorded.set(recordedKey(promptHash, req.runIndex), recordedAt);
      this.options.cache.put({
        schemaVersion: ONTOLOGY_CACHE_SCHEMA_VERSION,
        key,
        parts: {
          promptVersion: this.options.promptVersion, pass: req.pass, provider: d.provider, model: d.model,
          systemHash: sha256Hex(req.system), schemaHash: sha256Hex(canonicalJSON(req.schema)), promptHash, runIndex: req.runIndex,
        },
        itemId: req.itemId,
        itemName: req.itemName,
        ...(this.options.omitPrompts === true ? {} : { prompt: req.prompt }),
        response: res.data.json,
        resolvedModel: res.data.model,
        usage: res.data.usage,
        recordedAt,
      });
      return { kind: 'ok', value: res.data.json as T, provenance: provenance(res.data.model), cached: false };
    }
    this.invalid++;
    return { kind: 'invalid', reason: lastReason };
  }
}
