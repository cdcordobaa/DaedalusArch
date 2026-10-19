/**
 * One EFF-01 session (design DR-12, DR-13, DR-17 to DR-22, DR-24a, DR-26, DR-27, DR-27a; A1 DR-A1-3).
 *
 * Prepares the per-session `HOME` (and N's empty cwd; R and G run in the tree), checks isolation, writes G's MCP
 * config, spawns through `runWithRetries` with the EFF-01 disposition, decides the status in DR-22 order and writes the
 * scrubbed, cost-free and path-redacted session files. Every write passes `scrubDeep`, `stripCost` and `redactPaths`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../../src/shared/errors/domain-result.js';
import { scrubDeep, scrubSecrets } from '../../../../src/shared/errors/scrub.js';
import type { ProcessResult, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { parseEnvelope } from '../../../lib/generators/envelope.js';
import type { ParsedEnvelope } from '../../../lib/generators/envelope.js';
import { judgeModelUsage } from '../../../lib/generators/model-usage.js';
import { attemptDisposition, detectUsageLimit } from '../../../lib/generators/outcome.js';
import type { AttemptDisposition } from '../../../lib/generators/outcome.js';
import { DEFAULT_RETRY_POLICY, runWithRetries } from '../../../lib/generators/retry.js';
import type { Clock, RetryPolicy, Sleeper } from '../../../lib/generators/retry.js';
import type { CliEnvelopeSummary } from '../../../lib/generators/types.js';
import { redactPrompt } from '../../../lib/loop/agents.js';
import { checkIsolationBeforeSpawn, isolatedClaudeEnv } from '../../../lib/loop/isolation.js';
import { buildConditionArgs, callLogPathOf, eff01McpConfig, mcpConfigPathOf, sessionKeyOf } from './argv.js';
import { sha256Hex } from './inputs.js';
import { FRAME_SHA256 } from './prompt.js';
import { redactJsonl, redactPaths, redactString } from './redact.js';
import type { RedactRoot } from './redact.js';
import { extractAnswer } from './score.js';
import { tokensFromEnvelope, tokensFromPartial } from './tokens.js';
import { checkConfinement, readTranscript, stripCost, toolCallCounts } from './transcript.js';
import type { Transcript } from './transcript.js';
import { treeFingerprint } from './trees.js';
import { CAP_TOKENS, CAP_TURNS, CAP_WALL_MS, MAX_OUTPUT_BYTES, RECORD_SCHEMA, VALID_STATUSES } from './types.js';
import type { SessionRecord, SessionSpec, SessionStatus, TokenUsage } from './types.js';

export const SESSION_FILES = Object.freeze({ transcript: 'transcript.jsonl.gz', envelope: 'envelope.json', calls: 'calls.jsonl', record: 'record.json' });

/** Counts model-reaching attempts against `--confirm-sessions` + `--rerun-allowance` (DR-24a). */
export interface SpawnBudget {
  canSpawn(): boolean;
  record(modelReaching: boolean): void;
  readonly used: number;
  readonly limit: number;
}

export function createSpawnBudget(limit: number): SpawnBudget {
  let used = 0;
  return {
    canSpawn: () => used < limit,
    record: (reaching) => {
      if (reaching) used++;
    },
    get used() {
      return used;
    },
    limit,
  };
}

export interface SessionContext {
  readonly runner: ProcessRunner;
  readonly parentEnv: NodeJS.ProcessEnv;
  readonly clock: Clock;
  readonly sleep: Sleeper;
  readonly policy?: RetryPolicy;
  readonly claudeBinary: string;
  readonly model: string;
  readonly configDir: string;
  readonly harnessRoot: string;
  readonly runDir: string;
  readonly nodeBinary: string;
  readonly serverEntry: string;
  readonly knownSecrets: readonly string[];
  readonly redact: readonly RedactRoot[];
  readonly cliVersionStart: string | null;
  readonly dryRun: boolean;
  readonly hashes: { readonly questions: string; readonly answers: string };
  readonly budget: SpawnBudget;
}

export interface SessionInput {
  readonly spec: SessionSpec;
  readonly prompt: string;
  readonly treeDir: string;
  readonly specPath: string;
  readonly specSha256: string;
  readonly treeFingerprint: string;
}

interface AttemptValue {
  readonly cli: ProcessResult | null;
  readonly transcript: Transcript;
  readonly envelope: ParsedEnvelope | null;
}

function err(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code, message } : { code, message, context };
}

/** DR-21: spawn failure → infrastructure; usage limit; timeout → final `cap-wall`; else `attemptDisposition(…, 0)`. */
export function eff01Disposition(cli: ProcessResult | null, envelope: ParsedEnvelope | null): AttemptDisposition {
  if (cli === null) return { kind: 'infrastructure', label: 'spawn-failed' };
  const usage = detectUsageLimit(cli, envelope);
  if (usage !== null) return { kind: 'usage-limit', usage, label: 'usage-limit' };
  if (cli.timedOut) return { kind: 'final', label: 'cap-wall' };
  return attemptDisposition(cli, envelope, 0);
}

export function sessionDirOf(runDir: string, sessionId: string): string {
  return path.join(runDir, 'sessions', ...sessionId.split('/'));
}

function isRecordObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Scrub, strip cost, redact: the order every stored value goes through. */
function clean<T>(value: T, ctx: SessionContext): T {
  return redactPaths(stripCost(scrubDeep(value, ctx.knownSecrets)), ctx.redact);
}

function cleanText(text: string, ctx: SessionContext): string {
  return redactString(scrubSecrets(text, ctx.knownSecrets), ctx.redact);
}

function cleanJsonl(stdout: string, ctx: SessionContext): string {
  const lines = stdout.split('\n').map((line) => {
    if (line.trim() === '') return line;
    try {
      return JSON.stringify(stripCost(scrubDeep(JSON.parse(line) as unknown, ctx.knownSecrets)));
    } catch {
      return scrubSecrets(line, ctx.knownSecrets);
    }
  });
  return redactJsonl(lines.join('\n'), ctx.redact);
}

function writeAtomic(file: string, text: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${String(process.pid)}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function writeJson(file: string, value: unknown): void {
  writeAtomic(file, `${JSON.stringify(value, null, 1)}\n`);
}

/** The attempt's transcript and envelope in the session dir (overwritten by the next attempt). */
function storeAttempt(dir: string, value: AttemptValue, ctx: SessionContext): void {
  fs.mkdirSync(dir, { recursive: true });
  const stdout = value.cli?.stdout ?? '';
  fs.writeFileSync(path.join(dir, SESSION_FILES.transcript), zlib.gzipSync(Buffer.from(cleanJsonl(stdout, ctx))));
  const env = value.envelope !== null
    ? value.envelope.scrubbed
    : { unreadable: true, exitCode: value.cli?.exitCode ?? null, timedOut: value.cli?.timedOut ?? false, truncated: value.cli?.truncated === true, stderrTail: (value.cli?.stderr ?? '').slice(-2000) };
  writeJson(path.join(dir, SESSION_FILES.envelope), clean(env, ctx));
}

/** Moves the attempt files of the session dir (and G's call log) into `interrupted-<i>/`. */
function archiveAttempt(dir: string, target: string, callLog: string | null, ctx: SessionContext): void {
  fs.mkdirSync(target, { recursive: true });
  for (const f of [SESSION_FILES.transcript, SESSION_FILES.envelope]) {
    const src = path.join(dir, f);
    if (fs.existsSync(src)) fs.renameSync(src, path.join(target, f));
  }
  if (callLog !== null && fs.existsSync(callLog)) {
    fs.writeFileSync(path.join(target, SESSION_FILES.calls), redactJsonl(fs.readFileSync(callLog, 'utf8'), ctx.redact));
    fs.rmSync(callLog, { force: true });
  }
}

/** A timed-out session's model check reads the transcript (DR-22 row 3). */
function summaryFromTranscript(t: Transcript): CliEnvelopeSummary {
  const modelUsage: Record<string, { outputTokens?: number }> = {};
  for (const [id, u] of Object.entries(t.partialUsageByModel)) modelUsage[id] = { outputTokens: u.output };
  if (Object.keys(modelUsage).length === 0 && t.init?.model !== undefined) modelUsage[t.init.model] = { outputTokens: 0 };
  return { modelUsage };
}

function existingInterruptions(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((n) => /^interrupted-\d+$/.test(n)).length;
}

/** Clears a half-written session dir (no `record.json`), keeping archived interruptions. */
function resetSessionDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (/^interrupted-\d+$/.test(name)) continue;
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

export async function runSession(input: SessionInput, ctx: SessionContext): Promise<DomainResult<SessionRecord>> {
  const { spec } = input;
  const key = sessionKeyOf(spec.sessionId);
  const dir = sessionDirOf(ctx.runDir, spec.sessionId);
  resetSessionDir(dir);
  fs.mkdirSync(dir, { recursive: true });
  const home = path.join(ctx.harnessRoot, 'homes', key);

  // DR-12 / DR-A1-3: R and G run in the tree; N in a fresh empty directory.
  let cwd = input.treeDir;
  if (spec.condition === 'N') {
    cwd = path.join(ctx.harnessRoot, 'empty', key);
    fs.mkdirSync(cwd, { recursive: true });
    if (fs.readdirSync(cwd).length > 0) return DomainResult.fail([err('EFF01_CWD_NOT_EMPTY', `the N cwd of ${spec.sessionId} is not empty`)]);
  }
  const iso = checkIsolationBeforeSpawn(home, { configDir: ctx.configDir });
  if (!iso.success) return DomainResult.fail(iso.errors);
  const env = isolatedClaudeEnv(ctx.parentEnv, home, { configDir: ctx.configDir });

  let mcpConfigPath: string | undefined;
  let callLog: string | null = null;
  if (spec.condition === 'G') {
    callLog = callLogPathOf(ctx.harnessRoot, key);
    if (fs.existsSync(callLog)) return DomainResult.fail([err('EFF01_CALL_LOG_EXISTS', `the call log of ${spec.sessionId} already exists`)]);
    mcpConfigPath = mcpConfigPathOf(ctx.harnessRoot, key);
    const cfg = eff01McpConfig({ nodeBinary: ctx.nodeBinary, serverEntry: ctx.serverEntry, specPath: input.specPath, treeDir: input.treeDir, callLogPath: callLog });
    if (!cfg.success) return DomainResult.fail(cfg.errors);
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.mkdirSync(path.dirname(callLog), { recursive: true });
    fs.writeFileSync(mcpConfigPath, `${JSON.stringify(cfg.data, null, 2)}\n`, { mode: 0o600 });
  }
  const args = buildConditionArgs(spec.condition, { prompt: input.prompt, model: ctx.model, ...(mcpConfigPath !== undefined ? { mcpConfigPath } : {}) });
  if (!args.success) return DomainResult.fail(args.errors);

  const started = ctx.clock.now();
  let modelReaching = 0;
  const priorInterruptions = existingInterruptions(dir);
  const retried = await runWithRetries<AttemptValue>(
    {
      runAttempt: async () => {
        if (!ctx.budget.canSpawn()) {
          return DomainResult.fail([err('EFF01_SPAWN_BUDGET', `the spawn budget (${String(ctx.budget.limit)} model-reaching attempts) is used up`)]);
        }
        const r = await ctx.runner.run(ctx.claudeBinary, args.data, { cwd, env, timeoutMs: CAP_WALL_MS, maxOutputBytes: MAX_OUTPUT_BYTES });
        const cli = r.success ? r.data : null;
        const transcript = readTranscript(cli?.stdout ?? '');
        let envelope: ParsedEnvelope | null = null;
        if (transcript.resultEvent !== undefined) {
          const p = parseEnvelope(JSON.stringify(transcript.resultEvent), ctx.knownSecrets);
          envelope = p.success ? p.data : null;
        }
        const reaching = (envelope?.summary.numTurns ?? 0) >= 1 || transcript.assistantEvents > 0;
        ctx.budget.record(reaching);
        if (reaching) modelReaching++;
        const value: AttemptValue = { cli, transcript, envelope };
        storeAttempt(dir, value, ctx);
        return DomainResult.ok({ disposition: eff01Disposition(cli, envelope), value });
      },
      onInterruption: (i) => {
        const name = `interrupted-${String(priorInterruptions + i)}`;
        archiveAttempt(dir, path.join(dir, name), callLog, ctx);
        return DomainResult.ok(path.relative(ctx.runDir, path.join(dir, name)).split(path.sep).join('/'));
      },
      onRetry: () => {
        for (const f of [SESSION_FILES.transcript, SESSION_FILES.envelope]) fs.rmSync(path.join(dir, f), { force: true });
        if (callLog !== null) fs.rmSync(callLog, { force: true });
        return DomainResult.ok(undefined);
      },
    },
    ctx.policy ?? DEFAULT_RETRY_POLICY,
    ctx.clock,
    ctx.sleep,
  );
  if (!retried.success) return DomainResult.fail(retried.errors);
  const { last, exhausted, attempts, interruptions } = retried.data;
  const { cli, transcript, envelope } = last.value;
  const wallMs = ctx.clock.now() - started;

  // Tokens (SC-4; DR-20).
  let tokens: TokenUsage | null = null;
  let tokensSource: SessionRecord['tokensSource'] = 'envelope';
  if (envelope !== null) tokens = tokensFromEnvelope(envelope.scrubbed, ctx.model);
  if (tokens === null && transcript.assistantEvents > 0) {
    tokens = tokensFromPartial(transcript, ctx.model);
    tokensSource = 'transcript-partial';
  }

  // Model check (DR-22 row 3).
  const modelSource: SessionRecord['modelSource'] = envelope !== null ? 'envelope' : 'transcript';
  const verdict = judgeModelUsage(ctx.model, envelope !== null ? envelope.summary : summaryFromTranscript(transcript));
  const verdictReason = verdict.valid ? null : verdict.reason;
  const modelInvalid = !verdict.valid && !(spec.block === 'calibration' && verdictReason === 'pinned-not-dominant');

  const treeDir = spec.condition === 'N' ? null : input.treeDir;
  const confinement = checkConfinement(spec.condition, transcript, treeDir);
  const treeChanged = treeDir !== null && treeFingerprint(treeDir) !== input.treeFingerprint;
  const timedOut = cli?.timedOut === true;
  const truncated = cli?.truncated === true;
  const numTurns = envelope?.summary.numTurns ?? null;
  const subtype = envelope?.summary.subtype ?? null;

  let status: SessionStatus;
  let statusReason: string | null = null;
  if (exhausted || cli === null) {
    status = 'infrastructure';
    statusReason = last.disposition.label;
  } else if (truncated) {
    status = 'envelope-unreadable';
    statusReason = 'output-truncated';
  } else if (transcript.resultEvent === undefined && !timedOut) {
    status = 'envelope-unreadable';
    statusReason = 'no-result-event';
  } else if (modelInvalid) {
    status = 'model-mismatch';
    statusReason = verdictReason;
  } else if (!confinement.ok) {
    status = 'confinement-leak';
    statusReason = confinement.reasons.join('; ');
  } else if (treeChanged) {
    status = 'tree-changed';
  } else if (timedOut) {
    status = 'cap-wall';
  } else if (subtype === 'error_max_turns' || (numTurns !== null && numTurns > CAP_TURNS)) {
    status = 'cap-turns';
  } else if (tokens !== null && tokens.processed > CAP_TOKENS) {
    status = 'cap-tokens';
  } else {
    status = 'completed';
  }
  const isError = envelope?.summary.isError === true;

  // Final text (SC-1) and the call log (G).
  const rawFinal = typeof envelope?.scrubbed.result === 'string' ? envelope.scrubbed.result : (transcript.lastAssistantText ?? null);
  const finalText = rawFinal === null ? null : cleanText(rawFinal, ctx);
  const ex = extractAnswer(finalText);
  let mcpCallLog: SessionRecord['mcpCallLog'] = null;
  if (callLog !== null) {
    const text = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8') : '';
    const byTool: Record<string, number> = {};
    let lines = 0;
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      lines++;
      try {
        const e = JSON.parse(line) as unknown;
        const t = isRecordObj(e) && typeof e.tool === 'string' ? e.tool : 'unparsed';
        byTool[t] = (byTool[t] ?? 0) + 1;
      } catch {
        byTool.unparsed = (byTool.unparsed ?? 0) + 1;
      }
    }
    fs.writeFileSync(path.join(dir, SESSION_FILES.calls), redactJsonl(text, ctx.redact));
    mcpCallLog = { lines, byTool };
  }

  const record: SessionRecord = {
    schema: RECORD_SCHEMA,
    sessionId: spec.sessionId,
    block: spec.block,
    repoId: spec.repoId,
    questionId: spec.questionId,
    condition: spec.condition,
    run: spec.run,
    rerun: spec.rerun,
    lane: spec.lane,
    orderIndex: spec.orderIndex,
    argv: redactPrompt(args.data, input.prompt),
    promptSha256: sha256Hex(input.prompt),
    frameSha256: FRAME_SHA256,
    questionsSha256: ctx.hashes.questions,
    answersSha256: ctx.hashes.answers,
    specSha256: input.specSha256,
    treeFingerprint: input.treeFingerprint,
    cliVersionStart: ctx.cliVersionStart,
    cliVersionEnd: null,
    cliDrift: false,
    model: { pinned: ctx.model, verdict },
    modelSource,
    status,
    statusReason,
    valid: VALID_STATUSES.includes(status),
    exitCode: cli?.exitCode ?? null,
    timedOut,
    truncated,
    resultSubtype: subtype,
    isError,
    agentError: status === 'completed' && isError,
    tokens,
    tokensSource,
    numTurns,
    durationMs: envelope?.summary.durationMs ?? null,
    wallMs,
    toolCalls: toolCallCounts(transcript),
    mcpCallLog,
    confinement,
    attempts,
    interruptions,
    modelReachingAttempts: modelReaching,
    permissionDenials: envelope?.summary.permissionDenials?.length ?? 0,
    answerText: ex.answerLine ?? null,
    finalText,
    maxTurnsRejected: /unknown option[^\n]*max-turns/i.test(cli?.stderr ?? ''),
    dryRun: ctx.dryRun,
  };
  const stored = clean(record, ctx);
  writeJson(path.join(dir, SESSION_FILES.record), stored);
  return DomainResult.ok(stored);
}
