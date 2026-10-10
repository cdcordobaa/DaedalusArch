/**
 * Codex run evidence: the `exec --json` event stream plus the session rollout, read into the shared envelope shape
 * (FR-v1.2E-28; BR-U5a-46, 47 read for the Codex arm; ADR-029; `Docs/generator-protocol.md` §12).
 *
 * stdout of `codex exec --json` is JSONL (`thread.started`, `turn.started`, `item.completed`, `turn.completed`,
 * `turn.failed`, `error`). It does not name the serving model and, for a `code_mode_only` model, does not list the
 * tool calls. The rollout (`<CODEX_HOME>/sessions/YYYY/MM/DD/rollout-*-<thread_id>.jsonl`) does: every turn records
 * `turn_context.model`, a served-model switch is an `event_msg` of type `model_reroute` (`from_model`, `to_model`),
 * and each response has a `token_usage_record`. The adapter moves the rollout out of `CODEX_HOME` after each call
 * (`takeRollout`) and stores a sanitised copy in `envelope.json`.
 *
 * - `parseCodexRun(stdout, rollout, knownSecrets)`: stdout must hold at least one JSON event (else
 *   `GEN_ENVELOPE_UNREADABLE`). The summary maps onto `CliEnvelopeSummary`: `isError` (a `turn.failed` or `error`
 *   event, or no `turn.completed`), `subtype`, `numTurns` (completed agent steps: messages and tool calls),
 *   `permissionDenials` (tool outputs reporting a sandbox or permission denial; reported, never decisive),
 *   `durationMs`, `sessionId` (thread id), and `modelUsage`: output tokens per served model, from the rollout
 *   (each response's tokens go to the turn's `turn_context.model`, or to the `to_model` of a reroute in that turn).
 *   Without a rollout there is no `modelUsage`, so the pre-registered model-usage rule fails closed
 *   (`no-model-usage`).
 * - `codexUsageLimit(...)`: a usage, credit or rate limit (Codex error codes `usage_limit_reached`,
 *   `quota_exceeded`, `usage_not_included`, the `*_credits_depleted` / `*_usage_limit_reached` kinds, HTTP 429, or
 *   the "You've hit your usage limit" text), with the reset time from the last `rate_limits` snapshot when given.
 *   The patterns come from the CLI 0.162.1 binary; no natural sample was seen in the Gate probe (marked unverified,
 *   as ADR-018 item 5 does for the judge).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { scrubDeep } from '../../../src/shared/errors/scrub.js';
import type { ProcessResult } from '../../../src/shared/interfaces/process-runner.js';
import type { ParsedEnvelope } from './envelope.js';
import { ENVELOPE_UNREADABLE } from './envelope.js';
import type { UsageLimitSignal } from './outcome.js';
import type { CliEnvelopeSummary } from './types.js';

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** Every JSON object line of a JSONL text (other lines are counted, not fatal). */
export function parseJsonl(text: string): { readonly records: readonly Json[]; readonly unreadableLines: number } {
  const records: Json[] = [];
  let unreadableLines = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t === '') continue;
    try {
      const v = JSON.parse(t) as unknown;
      if (isRecord(v)) records.push(v);
      else unreadableLines++;
    } catch {
      unreadableLines++;
    }
  }
  return { records, unreadableLines };
}

// --- rollout -----------------------------------------------------------------------------------------------------

/** Rollout files of `threadId` under `<codexHome>/sessions` (normally exactly one). */
export function findRolloutFiles(codexHome: string, threadId: string): readonly string[] {
  if (!/^[0-9a-f-]{8,}$/i.test(threadId)) return [];
  const root = path.join(codexHome, 'sessions');
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith(`-${threadId}.jsonl`)) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Reads and removes the rollout(s) of `threadId` from `codexHome` (sessions must not accumulate there), returning the
 * parsed records. Missing ⇒ `null`.
 */
export function takeRollout(codexHome: string, threadId: string | undefined): readonly Json[] | null {
  if (threadId === undefined) return null;
  const files = findRolloutFiles(codexHome, threadId);
  if (files.length === 0) return null;
  const records: Json[] = [];
  for (const f of files) {
    records.push(...parseJsonl(fs.readFileSync(f, 'utf8')).records);
    fs.rmSync(f, { force: true });
  }
  return records;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The stored copy of a rollout: account identifiers dropped, the base instructions replaced by their sha256 and
 * length, encrypted reasoning replaced by its length. Everything else (turn contexts, tool calls and outputs,
 * messages, token counts, rate-limit snapshots, world state) is kept.
 */
export function sanitiseRollout(records: readonly Json[]): readonly Json[] {
  return records.map((r) => {
    const payload = r.payload;
    if (!isRecord(payload)) return r;
    const p: Json = { ...payload };
    if (r.type === 'session_meta') {
      delete p.creator_user_id;
      delete p.creator_account_id;
      const bi = p.base_instructions;
      const text = typeof bi === 'string' ? bi : isRecord(bi) && typeof bi.text === 'string' ? bi.text : undefined;
      if (text !== undefined) p.base_instructions = { sha256: sha256(text), chars: text.length };
    }
    if (p.type === 'reasoning' && typeof p.encrypted_content === 'string') p.encrypted_content = { chars: p.encrypted_content.length };
    return { ...r, payload: p };
  });
}

/** Output tokens per served model (see the module header). */
export function rolloutModelUsage(records: readonly Json[]): Record<string, { outputTokens: number }> {
  const usage: Record<string, { outputTokens: number }> = {};
  let current: string | undefined;
  for (const r of records) {
    const p = r.payload;
    if (!isRecord(p)) continue;
    if (r.type === 'turn_context') current = str(p.model) ?? current;
    else if (r.type === 'event_msg' && p.type === 'model_reroute') current = str(p.to_model) ?? current;
    else if (r.type === 'token_usage_record' && current !== undefined) {
      const u = isRecord(p.usage) ? p.usage : isRecord(p.turn_token_usage) ? p.turn_token_usage : undefined;
      const out = u !== undefined ? num(u.output_tokens) : undefined;
      if (out !== undefined) usage[current] = { outputTokens: (usage[current]?.outputTokens ?? 0) + out };
    }
  }
  return usage;
}

/** The last `rate_limits` snapshot of a rollout (`token_count` events). */
export function lastRateLimits(records: readonly Json[]): Json | undefined {
  let last: Json | undefined;
  for (const r of records) {
    const p = r.payload;
    if (isRecord(p) && p.type === 'token_count' && isRecord(p.rate_limits)) last = p.rate_limits;
  }
  return last;
}

/** Served-model switches recorded in a rollout. */
export function rolloutReroutes(records: readonly Json[]): readonly { readonly from?: string; readonly to?: string }[] {
  const out: { from?: string; to?: string }[] = [];
  for (const r of records) {
    const p = r.payload;
    if (r.type === 'event_msg' && isRecord(p) && p.type === 'model_reroute') {
      const from = str(p.from_model);
      const to = str(p.to_model);
      out.push({ ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) });
    }
  }
  return out;
}

const DENIAL_TEXT = /operation not permitted|permission denied|EPERM|EACCES|sandbox (?:denied|restriction)|rejected by (?:the )?(?:sandbox|policy|user)|writing outside of the project|not in the writable roots/i;

function outputText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(outputText).join('\n');
  if (isRecord(v)) return [v.text, v.output, v.content].map(outputText).join('\n');
  return '';
}

/** Tool calls and their outputs in a rollout (`function_call`, `custom_tool_call`, `local_shell_call` and outputs). */
export function rolloutToolActivity(records: readonly Json[]): { readonly calls: number; readonly denials: readonly Json[] } {
  let calls = 0;
  const denials: Json[] = [];
  for (const r of records) {
    const p = r.payload;
    if (r.type !== 'response_item' || !isRecord(p)) continue;
    const t = str(p.type) ?? '';
    if (t === 'function_call' || t === 'custom_tool_call' || t === 'local_shell_call') calls++;
    if (t === 'function_call_output' || t === 'custom_tool_call_output') {
      const text = outputText(p.output);
      if (DENIAL_TEXT.test(text)) denials.push({ call_id: p.call_id ?? null, excerpt: text.slice(0, 300) });
    }
  }
  return { calls, denials };
}

/** Total task duration recorded by the rollout (`task_complete.duration_ms`). */
function rolloutDuration(records: readonly Json[]): number | undefined {
  let total: number | undefined;
  for (const r of records) {
    const p = r.payload;
    if (r.type === 'event_msg' && isRecord(p) && p.type === 'task_complete') {
      const d = num(p.duration_ms);
      if (d !== undefined) total = (total ?? 0) + d;
    }
  }
  return total;
}

// --- usage limits ------------------------------------------------------------------------------------------------

const CODEX_LIMIT_TEXT =
  /usage[ _]limit|you'?ve hit your usage limit|quota[ _]exceeded|usage[ _]not[ _]included|credits[ _]depleted|rate[ _-]?limit|too many requests|\b429\b/i;

/** Reset time (epoch ms) of the binding window of a `rate_limits` snapshot, when it reports one. */
export function rateLimitResetAt(rateLimits: Json | undefined): number | undefined {
  if (rateLimits === undefined) return undefined;
  const resets: number[] = [];
  for (const k of ['primary', 'secondary']) {
    const w = rateLimits[k];
    if (isRecord(w)) {
      const at = num(w.resets_at);
      const used = num(w.used_percent);
      if (at !== undefined && (used === undefined || used >= 100 || rateLimits.rate_limit_reached_type != null)) resets.push(at * 1000);
    }
  }
  return resets.length > 0 ? Math.max(...resets) : undefined;
}

/** A usage limit is read only from an erroring call (non-zero exit, unreadable stream or an error event). */
export function codexUsageLimit(cli: ProcessResult, envelope: ParsedEnvelope | null): UsageLimitSignal | null {
  const erroring = cli.exitCode !== 0 || envelope === null || envelope.summary.isError === true;
  if (!erroring) return null;
  const parts: string[] = [cli.stderr.slice(-4000)];
  if (envelope !== null) {
    const errs = envelope.scrubbed.errors;
    if (Array.isArray(errs)) parts.push(...errs.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))));
  } else {
    parts.push(cli.stdout.slice(-4000));
  }
  const text = parts.join('\n');
  if (!CODEX_LIMIT_TEXT.test(text)) return null;
  const rl = envelope !== null && isRecord(envelope.scrubbed.rateLimits) ? envelope.scrubbed.rateLimits : undefined;
  const resetAt = rateLimitResetAt(rl);
  const subtype = /rate[ _-]?limit|too many requests|\b429\b/i.test(text) && !/usage[ _]limit|credits|quota/i.test(text) ? 'rate-limit' : 'usage-limit';
  return resetAt === undefined ? { subtype } : { subtype, resetAt };
}

// --- the run envelope --------------------------------------------------------------------------------------------

export const CODEX_ENVELOPE_FORMAT = 'codex-exec-jsonl+rollout';

/** Reads a Codex run into the shared envelope shape (see the module header). */
export function parseCodexRun(stdout: string, rollout: readonly Json[] | null, knownSecrets: readonly string[]): DomainResult<ParsedEnvelope> {
  const { records: events, unreadableLines } = parseJsonl(stdout);
  if (events.length === 0) {
    return DomainResult.fail([
      {
        code: ENVELOPE_UNREADABLE,
        message: 'codex exec stdout holds no JSON event',
        context: { failureReason: 'envelope-unreadable', stdoutBytes: Buffer.byteLength(stdout) },
      },
    ]);
  }
  let threadId: string | undefined;
  let completedTurns = 0;
  let failed = false;
  const errors: string[] = [];
  let finalMessage: string | undefined;
  let steps = 0;
  for (const e of events) {
    const t = str(e.type);
    if (t === 'thread.started') threadId = str(e.thread_id) ?? threadId;
    else if (t === 'turn.completed') completedTurns++;
    else if (t === 'turn.failed') {
      failed = true;
      const m = isRecord(e.error) ? str(e.error.message) : undefined;
      if (m !== undefined) errors.push(m);
    } else if (t === 'error') {
      failed = true;
      const m = str(e.message);
      if (m !== undefined) errors.push(m);
    } else if (t === 'item.completed' && isRecord(e.item)) {
      const it = str(e.item.type);
      if (it === 'agent_message') {
        steps++;
        finalMessage = str(e.item.text) ?? finalMessage;
      } else if (it === 'error') {
        const m = str(e.item.message);
        if (m !== undefined) errors.push(m);
      } else if (it !== 'reasoning') steps++;
    }
  }
  const activity = rollout !== null ? rolloutToolActivity(rollout) : { calls: 0, denials: [] };
  const isError = failed || completedTurns === 0;
  const modelUsage = rollout !== null ? rolloutModelUsage(rollout) : undefined;
  const rateLimits = rollout !== null ? lastRateLimits(rollout) : undefined;
  const limitHit = errors.some((m) => CODEX_LIMIT_TEXT.test(m));
  const subtype = !isError ? 'success' : limitHit ? 'usage-limit' : failed ? 'turn-failed' : 'no-completed-turn';
  const raw: Json = {
    format: CODEX_ENVELOPE_FORMAT,
    is_error: isError,
    subtype,
    num_turns: steps + activity.calls,
    permission_denials: activity.denials,
    session_id: threadId ?? null,
    ...(rollout !== null ? { duration_ms: rolloutDuration(rollout) ?? null } : {}),
    ...(modelUsage !== undefined ? { modelUsage } : {}),
    ...(rateLimits !== undefined ? { rateLimits } : {}),
    reroutes: rollout !== null ? rolloutReroutes(rollout) : [],
    result: finalMessage ?? errors[errors.length - 1] ?? null,
    errors,
    unreadableLines,
    events,
    rollout: rollout !== null ? sanitiseRollout(rollout) : null,
  };
  const scrubbed = scrubDeep(raw, knownSecrets);
  const summary: { -readonly [K in keyof CliEnvelopeSummary]: CliEnvelopeSummary[K] } = {
    isError,
    subtype,
    numTurns: steps + activity.calls,
    permissionDenials: activity.denials,
  };
  const dur = rollout !== null ? rolloutDuration(rollout) : undefined;
  if (dur !== undefined) summary.durationMs = dur;
  if (threadId !== undefined) summary.sessionId = threadId;
  if (modelUsage !== undefined) summary.modelUsage = modelUsage;
  return DomainResult.ok({ summary, scrubbed });
}
