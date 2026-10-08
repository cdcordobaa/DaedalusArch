/**
 * Tolerant reader of the CLI JSON envelope (FR-v1.2E-28; Q18; NFR-v1.2E-08; SECURITY-05; BR-U5a-46).
 *
 * - `parseEnvelope(stdout, knownSecrets)`: stdout must hold one JSON object (surrounding whitespace allowed; when the
 *   whole text does not parse, the last non-empty line is tried). Non-JSON, or JSON that is not an object ⇒
 *   `GEN_ENVELOPE_UNREADABLE` (the run becomes `failed-agent`, reason `envelope-unreadable`). Otherwise it returns the
 *   typed `CliEnvelopeSummary` and the full envelope after `scrubDeep`.
 * - Each of `is_error`, `subtype`, `num_turns`, `permission_denials`, `total_cost_usd`, `duration_ms`, `session_id`,
 *   `modelUsage` is extracted only when present with the expected type; a missing or mistyped field is absent, never
 *   fatal. `modelUsage[id].outputTokens` (or `output_tokens`) is kept when it is a non-negative number.
 * - `writeEnvelope(file, scrubbed)`: the stored copy beside `generation.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { scrubDeep } from '../../../src/shared/errors/scrub.js';
import type { CliEnvelopeSummary } from './types.js';

export const ENVELOPE_UNREADABLE = 'GEN_ENVELOPE_UNREADABLE';

export interface ParsedEnvelope {
  readonly summary: CliEnvelopeSummary;
  /** The full envelope after `scrubDeep`. */
  readonly scrubbed: Readonly<Record<string, unknown>>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function parseObject(stdout: string): Record<string, unknown> | undefined {
  const whole = tryParse(stdout.trim());
  if (isRecord(whole)) return whole;
  if (whole !== undefined) return undefined;
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const last = lines.length > 0 ? tryParse(lines[lines.length - 1] ?? '') : undefined;
  return isRecord(last) ? last : undefined;
}

function finiteNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function extractModelUsage(v: unknown): CliEnvelopeSummary['modelUsage'] {
  if (!isRecord(v)) return undefined;
  const out: Record<string, { outputTokens?: number }> = {};
  for (const [id, entry] of Object.entries(v)) {
    if (!isRecord(entry)) {
      out[id] = {};
      continue;
    }
    const tokens = finiteNumber(entry.outputTokens) ?? finiteNumber(entry.output_tokens);
    out[id] = tokens !== undefined && tokens >= 0 ? { outputTokens: tokens } : {};
  }
  return out;
}

export function summariseEnvelope(raw: Readonly<Record<string, unknown>>): CliEnvelopeSummary {
  const s: {
    -readonly [K in keyof CliEnvelopeSummary]: CliEnvelopeSummary[K];
  } = {};
  if (typeof raw.is_error === 'boolean') s.isError = raw.is_error;
  if (typeof raw.subtype === 'string') s.subtype = raw.subtype;
  const turns = finiteNumber(raw.num_turns);
  if (turns !== undefined) s.numTurns = turns;
  if (Array.isArray(raw.permission_denials)) s.permissionDenials = raw.permission_denials as unknown[];
  const cost = finiteNumber(raw.total_cost_usd);
  if (cost !== undefined) s.totalCostUsd = cost;
  const dur = finiteNumber(raw.duration_ms);
  if (dur !== undefined) s.durationMs = dur;
  if (typeof raw.session_id === 'string') s.sessionId = raw.session_id;
  const usage = extractModelUsage(raw.modelUsage);
  if (usage !== undefined) s.modelUsage = usage;
  return s;
}

export function parseEnvelope(stdout: string, knownSecrets: readonly string[]): DomainResult<ParsedEnvelope> {
  const raw = parseObject(stdout);
  if (raw === undefined) {
    return DomainResult.fail([
      {
        code: ENVELOPE_UNREADABLE,
        message: 'CLI stdout is not a JSON object',
        context: { failureReason: 'envelope-unreadable', stdoutBytes: Buffer.byteLength(stdout) },
      },
    ]);
  }
  const scrubbed = scrubDeep(raw, knownSecrets);
  return DomainResult.ok({ summary: summariseEnvelope(scrubbed), scrubbed });
}

/** Design signature (domain-entities §5): the summary only. */
export function readEnvelope(stdout: string): DomainResult<CliEnvelopeSummary> {
  const r = parseEnvelope(stdout, []);
  return r.success ? DomainResult.ok(r.data.summary) : DomainResult.fail(r.errors);
}

export function writeEnvelope(file: string, scrubbed: Readonly<Record<string, unknown>>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(scrubbed, null, 2)}\n`);
}
