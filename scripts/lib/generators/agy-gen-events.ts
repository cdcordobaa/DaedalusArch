/**
 * Gemini generator (`agy`, decision CDX): stream-json events → the tolerant envelope summary, the attempt disposition,
 * the turn status and the two stop rules (design §3.5).
 *
 * | agy outcome | status | retry |
 * |---|---|---|
 * | spawn failure, or exit before an `init` event | infrastructure | infrastructure (at most 2 retries) |
 * | `[agy] print timeout after` on stderr (exit 0, SUCCESS, empty answer) or the hard kill, files written | timeout | final |
 * | print timeout with no file written | infrastructure | infrastructure |
 * | an auth pattern | grid stop `LOOP_GEMINI_AUTH` | none |
 * | a COMPLETED step of a tool outside the arm's allow list | grid stop `LOOP_GEMINI_TOOL_ESCAPE` (envelope kept) | none |
 * | a model pattern, or `init.model` ≠ the pin | model-mismatch | final |
 * | a usage-limit pattern on an erroring call (UNVERIFIED patterns) | — | usage-limit (pause, resume) |
 * | `result.status` not SUCCESS, or `result.error` set | agent-error | final |
 * | otherwise | completed | final |
 *
 * The print timeout is read from stderr, never from the exit code (agy exits 0). `costUsd` is always null (a
 * subscription; no figure is recorded).
 *
 * agy 1.4.2 prints its `result` event and then never exits: the agent ends the process on that line
 * (`stopOnLine: isAgyResultLine`), and such a run counts as exit 0 (`agyGenExitCode`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { scrubDeep, scrubSecrets } from '../../../src/shared/errors/scrub.js';
import type { ProcessResult } from '../../../src/shared/interfaces/process-runner.js';
import { AGY_CLASSIFIER, deniedToolCount, executedTools, readAgyStream } from '../../../src/llm-critic/agy-cli-provider.js';
import type { AgyStream } from '../../../src/llm-critic/agy-cli-provider.js';
import { DAEDALUS_ARM_TOOLS, DAEDALUS_DENIED_TOOLS } from './arms.js';
import { AGY_GEN_ANSWER_TOOLS, AGY_GEN_COMMAND_TOOLS, AGY_GEN_FILE_TOOLS, AGY_GEN_MCP_TOOL } from './agy-gen-cli.js';
import type { AgyGenArm } from './agy-gen-cli.js';
import type { ParsedEnvelope } from './envelope.js';
import type { AttemptDisposition } from './outcome.js';

/** A tool step with its final state and parameters (the labeller reader keeps no parameters). */
export interface AgyGenToolStep {
  readonly index: number;
  readonly tool: string;
  readonly state: string;
  readonly params: Readonly<Record<string, unknown>>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Final state and parameters of every tool step, by step index. */
export function readAgyGenSteps(stdout: string): readonly AgyGenToolStep[] {
  const steps = new Map<number, AgyGenToolStep>();
  for (const line of stdout.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    let v: unknown;
    try {
      v = JSON.parse(t);
    } catch {
      continue;
    }
    if (!isRecord(v) || v.event !== 'step_update' || !isRecord(v.step_update)) continue;
    const s = v.step_update;
    if (s.step_type !== 'tool' || typeof s.step_index !== 'number') continue;
    const prev = steps.get(s.step_index);
    const info = isRecord(s.tool_info) ? s.tool_info : {};
    const params = isRecord(info.parameters) ? info.parameters : (prev?.params ?? {});
    steps.set(s.step_index, { index: s.step_index, tool: typeof s.tool_name === 'string' ? s.tool_name : (prev?.tool ?? ''), state: typeof s.state === 'string' ? s.state : '', params });
  }
  return [...steps.values()].sort((a, b) => a.index - b.index);
}

function conversationId(stdout: string): string | undefined {
  for (const line of stdout.split('\n')) {
    try {
      const v: unknown = JSON.parse(line.trim());
      if (isRecord(v) && v.event === 'init' && typeof v.conversation_id === 'string') return v.conversation_id;
    } catch {
      continue;
    }
  }
  return undefined;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/**
 * The envelope of one agy run: `CliEnvelopeSummary` (`isError`, `numTurns` = completed tool steps, `permissionDenials`
 * = denied steps, `sessionId` = `conversation_id`, `modelUsage[init.model].outputTokens`, `durationMs`) and a scrubbed
 * record (init model, result status, error, usage, tool steps by name and state; the answer text is not kept).
 * Fails when the stream has neither an `init` nor a `result` event.
 */
export function parseAgyGenRun(stdout: string, secrets: readonly string[]): DomainResult<ParsedEnvelope> {
  const stream = readAgyStream(stdout);
  if (stream.init === null && stream.result === null) {
    return DomainResult.fail([{ code: 'GEN_ENVELOPE_UNREADABLE', message: 'agy printed neither an init nor a result event' }]);
  }
  const r = stream.result;
  const usage = r?.usage ?? {};
  const model = stream.init?.model;
  const completed = executedTools(stream).filter((t) => !AGY_GEN_ANSWER_TOOLS.includes(t));
  const denied = deniedToolCount(stream);
  const durationS = num((r as Record<string, unknown> | null)?.duration_seconds);
  const sessionId = conversationId(stdout);
  const isError = r?.status !== 'SUCCESS' || (typeof r.error === 'string' && r.error !== '');
  const scrubbed = scrubDeep(
    {
      agy: true,
      init: { model: model ?? null, permission_mode: stream.init?.permission_mode ?? null, tools: stream.init?.tools?.length ?? null },
      result: r === null ? null : { status: r.status ?? null, error: r.error ?? null, responseLength: typeof r.response === 'string' ? r.response.length : null },
      usage: { input_tokens: num(usage.input_tokens) ?? null, output_tokens: num(usage.output_tokens) ?? null, cache_read_input_tokens: num(usage.cache_read_tokens) ?? null },
      tools: stream.tools,
      deniedTools: denied,
      duration_ms: durationS === undefined ? null : Math.round(durationS * 1000),
    },
    secrets,
  ) as Record<string, unknown>;
  const outputTokens = num(usage.output_tokens);
  return DomainResult.ok({
    summary: {
      isError,
      numTurns: completed.length,
      permissionDenials: Array.from({ length: denied }, (_, i) => ({ denied: i })),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(durationS !== undefined ? { durationMs: Math.round(durationS * 1000) } : {}),
      ...(model !== undefined ? { modelUsage: { [model]: outputTokens !== undefined ? { outputTokens } : {} } } : {}),
    },
    scrubbed,
  });
}

function matches(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

function errorText(cli: ProcessResult): string {
  const r = readAgyStream(cli.stdout).result;
  return `${r?.error ?? ''}\n${cli.stderr}`;
}

/** The print timeout (stderr pattern; agy exits 0) or the runner's hard kill. */
export function agyTimedOut(cli: ProcessResult): boolean {
  return cli.timedOut || matches(AGY_CLASSIFIER.TIMEOUT, cli.stderr);
}

/**
 * The exit code as agy meant it: a run the harness ended on the result event (`stoppedOnOutput`, agy 1.4.2 prints its
 * result and never exits) has the signal exit -1 but finished; it counts as exit 0, as in the labeller provider.
 */
export function agyGenExitCode(cli: ProcessResult, stream: AgyStream = readAgyStream(cli.stdout)): number {
  return cli.stoppedOnOutput === true && stream.result !== null ? 0 : cli.exitCode;
}

function erroring(cli: ProcessResult, stream: AgyStream): boolean {
  return agyGenExitCode(cli, stream) !== 0 || stream.result?.status !== 'SUCCESS' || (typeof stream.result.error === 'string' && stream.result.error !== '');
}

/** The attempt disposition of design §3.5 (`changed`: files the agent changed since the last snapshot). */
export function agyGenAttemptDisposition(cli: ProcessResult | null, _envelope: ParsedEnvelope | null, changed: number): AttemptDisposition {
  if (cli === null) return { kind: 'infrastructure', label: 'spawn-failed' };
  const text = errorText(cli);
  if (matches(AGY_CLASSIFIER.AUTH, text)) return { kind: 'final', label: 'auth' };
  const stream = readAgyStream(cli.stdout);
  if (erroring(cli, stream) && !agyTimedOut(cli) && matches(AGY_CLASSIFIER.USAGE_LIMIT, text)) {
    return { kind: 'usage-limit', usage: { subtype: 'usage-limit' }, label: 'usage-limit' };
  }
  if (agyTimedOut(cli)) return changed === 0 ? { kind: 'infrastructure', label: 'timeout-no-files' } : { kind: 'final', label: 'timeout' };
  if (stream.init === null) return { kind: 'infrastructure', label: `exit-${String(cli.exitCode)}-before-init` };
  return { kind: 'final', label: 'completed' };
}

/** The turn status (the `CallPlan.status` hook of `driveTurn`). */
export function agyGenTurnStatus(cli: ProcessResult | null, exhausted: boolean, envelope: ParsedEnvelope | null, modelId: string): 'completed' | 'agent-error' | 'timeout' | 'infrastructure' | 'envelope-unreadable' | 'model-mismatch' {
  if (cli === null || exhausted) return 'infrastructure';
  if (agyTimedOut(cli)) return 'timeout';
  if (envelope === null) return 'envelope-unreadable';
  const init = isRecord(envelope.scrubbed.init) ? envelope.scrubbed.init : {};
  if (matches(AGY_CLASSIFIER.MODEL, errorText(cli)) || init.model !== modelId) return 'model-mismatch';
  if (envelope.summary.isError === true) return 'agent-error';
  return 'completed';
}

export interface StopContext {
  readonly arm: AgyGenArm;
  readonly allowCommand: boolean;
  /** The run's exact type-check command. */
  readonly typecheckCommand: string;
  /**
   * U12: the turn's work directory. When given, a completed file-tool step with a path argument outside it is an
   * escape (the after-the-fact twin of the hook's path check); the daedalus-mcp arm may also read `mcpSchemaFiles`.
   */
  readonly workDir?: string;
  readonly mcpSchemaFiles?: readonly string[];
}

/** Absolute or relative strings under path-like keys of a tool step (the hook's `pathArgs`, simplified). */
function stepPaths(params: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (!/path|file|dir|uri/i.test(k) || /content|instruction|description|chunk|query|pattern|include|exclude|replacement|code/i.test(k)) continue;
    for (const x of Array.isArray(v) ? (v as unknown[]) : [v]) if (typeof x === 'string' && x !== '') out.push(x);
  }
  return out;
}

function realish(p: string): string {
  const rest: string[] = [];
  for (let at = path.resolve(p); ; at = path.dirname(at)) {
    try {
      return path.join(fs.realpathSync(at), ...rest.reverse());
    } catch {
      if (path.dirname(at) === at) return path.resolve(p);
      rest.push(path.basename(at));
    }
  }
}

function fileStepEscape(step: AgyGenToolStep, ctx: StopContext): string | null {
  if (ctx.workDir === undefined) return null;
  const work = realish(ctx.workDir);
  const schema = (ctx.mcpSchemaFiles ?? []).map(realish);
  for (const p of stepPaths(step.params)) {
    const r = realish(path.isAbsolute(p) ? p : path.join(work, p));
    if (ctx.arm === 'daedalus-mcp' && schema.includes(r)) continue;
    const rel = path.relative(work, r);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return `${step.tool} (a path outside the work directory)`;
  }
  return null;
}

function stringValues(o: Readonly<Record<string, unknown>>): string[] {
  return Object.values(o).filter((v): v is string => typeof v === 'string');
}

/** Why a COMPLETED tool step is outside the arm's allow list, or null when it is allowed. */
export function escapeReason(step: AgyGenToolStep, ctx: StopContext): string | null {
  if (step.state === 'ERROR') return null;
  if (AGY_GEN_ANSWER_TOOLS.includes(step.tool)) return null;
  if (AGY_GEN_FILE_TOOLS.includes(step.tool)) return fileStepEscape(step, ctx);
  if (AGY_GEN_COMMAND_TOOLS.includes(step.tool)) {
    if (!ctx.allowCommand) return `${step.tool} (commands are not allowed)`;
    if (step.tool === 'command_status') return null;
    const line = typeof step.params.CommandLine === 'string' ? step.params.CommandLine.trim() : null;
    return line === ctx.typecheckCommand ? null : `${step.tool} (a command other than the run's type-check)`;
  }
  if (step.tool === AGY_GEN_MCP_TOOL) {
    if (ctx.arm === 'none') return `${step.tool} (no MCP tool in the none arm)`;
    const values = stringValues(step.params);
    if (values.some((v) => DAEDALUS_DENIED_TOOLS.includes(v))) return `${step.tool} (${DAEDALUS_DENIED_TOOLS.join(', ')})`;
    // UNVERIFIED (S4 G9): the parameter names of a call_mcp_tool step; any allowed tool name among them passes.
    return values.some((v) => DAEDALUS_ARM_TOOLS.includes(v)) ? null : `${step.tool} (not a spec-only tool)`;
  }
  return step.tool === '' ? 'an unnamed tool' : step.tool;
}

/** The grid-stop rules: an auth pattern, or a completed tool step outside the arm's allow list; null otherwise. */
export function agyGenStop(cli: ProcessResult | null, ctx: StopContext, secrets: readonly string[] = []): DomainError | null {
  if (cli === null) return null;
  if (matches(AGY_CLASSIFIER.AUTH, errorText(cli))) return { code: 'LOOP_GEMINI_AUTH', message: 'agy is not signed in to the generator home (the grid stops)' };
  const escapes = readAgyGenSteps(cli.stdout).map((s) => escapeReason(s, ctx)).filter((x): x is string => x !== null);
  if (escapes.length > 0) {
    return { code: 'LOOP_GEMINI_TOOL_ESCAPE', message: scrubSecrets(`agy completed tool step(s) outside the ${ctx.arm} allow list: ${[...new Set(escapes)].sort().join('; ')} (the grid stops)`, secrets) };
  }
  return null;
}
