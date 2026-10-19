/**
 * EFF-01 token measures (design SC-4 to SC-6, DR-20). `extractModelUsage` keeps output tokens only, so the four
 * camelCase `modelUsage[*]` fields are read here, from the scrubbed envelope.
 */
import type { Transcript } from './transcript.js';
import type { ModelTokens, TokenUsage } from './types.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

function modelTokens(input: number, cacheCreation: number, cacheRead: number, output: number): ModelTokens {
  return { input, cacheCreation, cacheRead, output, processed: input + cacheCreation + cacheRead + output };
}

function summarise(byModel: Record<string, ModelTokens>, pinned: string, usageTotal: number | null): TokenUsage {
  let processed = 0;
  let uncached = 0;
  let output = 0;
  let aux = 0;
  for (const [id, t] of Object.entries(byModel)) {
    processed += t.processed;
    uncached += t.input + t.cacheCreation + t.output;
    output += t.output;
    if (id !== pinned) aux += t.processed;
  }
  return { processed, uncached, output, usageTotal, usageMismatch: usageTotal !== null && usageTotal !== processed, byModel, auxProcessed: aux };
}

/** The snake_case `usage` block's four-field total, or null when the block is absent. */
export function usageBlockTotal(envelope: Readonly<Record<string, unknown>>): number | null {
  const u = envelope.usage;
  if (!isRecord(u)) return null;
  return num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens) + num(u.output_tokens);
}

/** SC-4 to SC-6: from a result envelope; null when it has no `modelUsage`. */
export function tokensFromEnvelope(envelope: Readonly<Record<string, unknown>>, pinned: string): TokenUsage | null {
  const mu = envelope.modelUsage;
  if (!isRecord(mu)) return null;
  const byModel: Record<string, ModelTokens> = {};
  for (const id of Object.keys(mu).sort()) {
    const e = mu[id];
    byModel[id] = isRecord(e)
      ? modelTokens(num(e.inputTokens), num(e.cacheCreationInputTokens), num(e.cacheReadInputTokens), num(e.outputTokens))
      : modelTokens(0, 0, 0, 0);
  }
  return summarise(byModel, pinned, usageBlockTotal(envelope));
}

/** SC-6 on its own. */
export function usageMismatch(envelope: Readonly<Record<string, unknown>>, pinned: string): boolean {
  return tokensFromEnvelope(envelope, pinned)?.usageMismatch ?? false;
}

/** DR-20: a killed session's tokens, summed from the assistant messages' `usage` (it undercounts the last turn). */
export function tokensFromPartial(t: Transcript, pinned: string): TokenUsage {
  const byModel: Record<string, ModelTokens> = {};
  for (const id of Object.keys(t.partialUsageByModel).sort()) {
    const u = t.partialUsageByModel[id];
    if (u !== undefined) byModel[id] = modelTokens(u.input, u.cacheCreation, u.cacheRead, u.output);
  }
  return summarise(byModel, pinned, null);
}
