/**
 * Zero-call stand-in for the claude CLI, git and tar in EFF-01 dry runs and tests (design §4, DR-30).
 *
 * - `claude --version` → `2.1.301 (Claude Code)` (or the configured version).
 * - `git -C <clone> rev-parse HEAD` → the pin of the clone's repo (the clone's basename is the repo id);
 *   `git -C <clone> archive --format=tar -o <file> <sha>` writes a placeholder file;
 *   `tar -xf <file> -C <dest>` copies the fixture tree into `<dest>`.
 * - `claude -p <prompt> …` emits a stream-json transcript for the session (its id is read from the per-session `HOME`,
 *   the condition from the argv, the question from the prompt through `lookup`), with a scripted behaviour.
 * - Any other command is refused, so a dry run can never fall through to a real binary.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import { TOOL_NAMES } from '../../../../src/mcp-server/server.js';
import { DAEDALUS_MCP_SERVER } from '../../../lib/generators/arms.js';
import { FILE_TOOLS, FILE_TOOL_NAMES, sessionIdOfKey } from './argv.js';
import { DEFAULT_CLI_VERSION } from './types.js';
import type { Eff01Condition } from './types.js';

export type StubBehaviour =
  | 'key'
  | 'wrong'
  | 'no-answer'
  | 'unparsable'
  | 'max-turns'
  | 'timeout'
  | 'truncated'
  | 'leak-mcp-in-R'
  | 'read-outside-tree'
  | 'leak-builtin-in-G'
  | 'mcp-not-connected'
  | 'usage-limit-once'
  | 'model-mismatch'
  | 'tree-write'
  | 'no-graph';

export const STUB_BEHAVIOURS: readonly StubBehaviour[] = Object.freeze([
  'key', 'wrong', 'no-answer', 'unparsable', 'max-turns', 'timeout', 'truncated', 'leak-mcp-in-R', 'read-outside-tree',
  'leak-builtin-in-G', 'mcp-not-connected', 'usage-limit-once', 'model-mismatch', 'tree-write', 'no-graph',
]);

export interface StubTarget {
  readonly repoId: string;
  readonly questionId: string | null;
}

export interface StubOptions {
  readonly fixtureTree: string;
  /** repoId → pinned sha (a clone's basename is its repo id). */
  readonly pins: Readonly<Record<string, string>>;
  /** Finds the session's question from its prompt. */
  readonly lookup: (prompt: string) => StubTarget | undefined;
  /** The normalised key answer of a question (SC-7 shape). */
  readonly keyFor: (questionId: string) => Record<string, unknown> | undefined;
  readonly model: string;
  readonly behaviour?: StubBehaviour | ((sessionId: string, condition: Eff01Condition) => StubBehaviour);
  readonly cliVersion?: string;
  /** An absolute path outside every tree, read by `read-outside-tree`. */
  readonly outsidePath?: string;
}

function ok(stdout: string, extra: Partial<ProcessResult> = {}): DomainResult<ProcessResult> {
  return DomainResult.ok({ exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 5, ...extra });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A deterministic wrong answer: integers +1, booleans flipped, strings changed, lists shortened or padded. */
export function perturb(v: unknown): unknown {
  if (typeof v === 'number') return v + 1;
  if (typeof v === 'boolean') return !v;
  if (typeof v === 'string') return `${v}-wrong`;
  if (Array.isArray(v)) return v.length > 0 ? v.slice(0, -1) : ['src/wrong.ts'];
  if (isRecord(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, perturb(x)]));
  return v;
}

/** Path-bearing fields of an answer written as absolute paths under `cwd` (R reports absolute paths, SC-8). */
function absolutise(answer: Record<string, unknown>, cwd: string): Record<string, unknown> {
  const abs = (p: unknown): unknown => (typeof p === 'string' && p.startsWith('src/') ? path.join(cwd, p) : p);
  const out: Record<string, unknown> = { ...answer };
  const files: unknown = out.files;
  const impls: unknown = out.implementers;
  if (Array.isArray(files)) out.files = (files as unknown[]).map(abs);
  if (Array.isArray(impls)) out.implementers = (impls as unknown[]).map((x) => (isRecord(x) ? { ...x, file: abs(x.file) } : x));
  return out;
}

export class StubEff01Runner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];
  private readonly seenSessions = new Map<string, number>();

  constructor(private readonly opts: StubOptions) {}

  private behaviourOf(sessionId: string, condition: Eff01Condition): StubBehaviour {
    const b = this.opts.behaviour ?? 'key';
    return typeof b === 'function' ? b(sessionId, condition) : b;
  }

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    const base = path.basename(command);
    if (base === 'git') return Promise.resolve(this.git(args));
    if (base === 'tar') return Promise.resolve(this.tar(args));
    if (args[0] === '--version') return Promise.resolve(ok(`${this.opts.cliVersion ?? DEFAULT_CLI_VERSION} (Claude Code)\n`));
    if (args[0] === '-p' && typeof args[1] === 'string') return Promise.resolve(this.session(args, options));
    return Promise.resolve(
      DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: `stub refuses the command ${base}`, context: { command: base } }]),
    );
  }

  private git(args: readonly string[]): DomainResult<ProcessResult> {
    const clone = args[0] === '-C' ? (args[1] ?? '') : '';
    const sub = args.slice(2);
    if (sub[0] === 'rev-parse' && sub[1] === 'HEAD') {
      const pin = this.opts.pins[path.basename(clone)];
      return pin === undefined ? ok('', { exitCode: 128, stderr: 'not a git repository' }) : ok(`${pin}\n`);
    }
    if (sub[0] === 'archive' && sub[1] === '--format=tar' && sub[2] === '-o' && typeof sub[3] === 'string') {
      fs.writeFileSync(sub[3], 'stub tar placeholder\n');
      return ok('');
    }
    return DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: `stub refuses git ${sub[0] ?? ''}` }]);
  }

  private tar(args: readonly string[]): DomainResult<ProcessResult> {
    if (args[0] === '-xf' && typeof args[1] === 'string' && args[2] === '-C' && typeof args[3] === 'string') {
      if (!fs.existsSync(args[1])) return ok('', { exitCode: 2, stderr: 'no such tar file' });
      fs.cpSync(this.opts.fixtureTree, args[3], { recursive: true });
      return ok('');
    }
    return DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'stub refuses this tar call' }]);
  }

  private session(args: readonly string[], options: ProcessRunOptions): DomainResult<ProcessResult> {
    const prompt = args[1] ?? '';
    const sessionId = sessionIdOfKey(path.basename(options.env.HOME ?? 'unknown'));
    const toolsAt = args.indexOf('--tools');
    const condition: Eff01Condition = args.includes('--mcp-config') ? 'G' : args[toolsAt + 1] === FILE_TOOLS ? 'R' : 'N';
    const behaviour = this.behaviourOf(sessionId, condition);
    const count = (this.seenSessions.get(sessionId) ?? 0) + 1;
    this.seenSessions.set(sessionId, count);
    const target = this.opts.lookup(prompt);
    const cwd = options.cwd ?? '.';
    const model = this.opts.model;

    if (behaviour === 'usage-limit-once' && count === 1) {
      const ev = { type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 0, result: "You've hit your limit · resets later" };
      return ok(`${JSON.stringify(ev)}\n`, { exitCode: 1 });
    }

    const lines: string[] = [];
    const ownTools = TOOL_NAMES.map((n) => `mcp__${DAEDALUS_MCP_SERVER}__${n}`);
    lines.push(
      JSON.stringify({
        type: 'system',
        subtype: 'init',
        model,
        tools: condition === 'N' ? [] : condition === 'R' ? [...FILE_TOOL_NAMES] : [...FILE_TOOL_NAMES, ...ownTools],
        mcp_servers: condition === 'G' ? [{ name: DAEDALUS_MCP_SERVER, status: behaviour === 'mcp-not-connected' ? 'failed' : 'connected' }] : [],
      }),
    );
    let n = 0;
    const tool = (name: string, input: Record<string, unknown>, text: string): void => {
      const id = `toolu_stub_${String(n++)}`;
      lines.push(JSON.stringify({ type: 'assistant', message: { id: `msg_tool_${String(n)}`, model, content: [{ type: 'tool_use', id, name, input }], usage: { input_tokens: 5, cache_creation_input_tokens: 50, cache_read_input_tokens: 500, output_tokens: 20 } } }));
      lines.push(JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] } }));
    };
    let graphUsed = false;
    if (target !== undefined && target.questionId !== null && condition !== 'N') {
      tool('Read', { file_path: path.join(cwd, 'README.md') }, 'tree-mini readme');
      tool('Glob', { pattern: 'src/**/*.ts' }, 'src/domain/Book.ts');
      if (condition === 'G' && behaviour !== 'no-graph') {
        graphUsed = true;
        tool(`mcp__${DAEDALUS_MCP_SERVER}__evaluate_project`, {}, '{"violations":0}');
        this.appendCallLog(args, 'evaluate_project');
      }
      if (behaviour === 'leak-mcp-in-R' && condition === 'R') tool(`mcp__${DAEDALUS_MCP_SERVER}__which_layer`, { path: 'src/domain/Book.ts' }, 'domain');
      if (behaviour === 'leak-builtin-in-G' && condition === 'G') tool('Bash', { command: 'ls' }, 'src');
      if (behaviour === 'read-outside-tree') tool('Read', { file_path: this.opts.outsidePath ?? '/outside-the-tree/answers.json' }, '{}');
    }
    if (behaviour === 'tree-write' && condition !== 'N') fs.writeFileSync(path.join(cwd, 'STUB-WROTE.txt'), 'changed\n');

    let text: string;
    if (target?.questionId == null) {
      text = 'OK';
    } else {
      const key = this.opts.keyFor(target.questionId) ?? {};
      let answer: Record<string, unknown> = behaviour === 'wrong' ? (perturb(key) as Record<string, unknown>) : key;
      if (condition === 'R') answer = absolutise(answer, cwd);
      const cite = graphUsed ? `I checked this with evaluate_project.\n` : '';
      if (behaviour === 'no-answer') text = `${cite}I could not decide.`;
      else if (behaviour === 'unparsable') text = `${cite}ANSWER: {not json`;
      else text = `${cite}Here is my answer.\nANSWER: ${JSON.stringify(answer)}`;
    }
    lines.push(JSON.stringify({ type: 'assistant', message: { id: 'msg_final', model, content: [{ type: 'text', text }], usage: { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 } } }));

    if (behaviour === 'timeout') return ok(`${lines.join('\n')}\n`, { exitCode: -1, timedOut: true, durationMs: 600_000 });

    const other = 'claude-stub-auxiliary';
    const modelUsage: Record<string, Record<string, number>> = {
      [model]: { inputTokens: 10, cacheCreationInputTokens: 100, cacheReadInputTokens: 1000, outputTokens: 50, costUSD: 0.0123 },
    };
    const usage = { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 };
    if (behaviour === 'model-mismatch') {
      modelUsage[other] = { inputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: 500, costUSD: 0.5 };
      usage.input_tokens += 1;
      usage.output_tokens += 500;
    }
    const maxTurns = behaviour === 'max-turns';
    lines.push(
      JSON.stringify({
        type: 'result',
        subtype: maxTurns ? 'error_max_turns' : 'success',
        is_error: maxTurns,
        num_turns: maxTurns ? 31 : 3,
        duration_ms: 1200,
        result: text,
        session_id: 'stub-session',
        total_cost_usd: 0.0123,
        usage,
        modelUsage,
        permission_denials: [],
      }),
    );
    return ok(`${lines.join('\n')}\n`, behaviour === 'truncated' ? { truncated: true } : {});
  }

  /** Appends one `mcp-call/v1` line to the call log named in the session's MCP config. */
  private appendCallLog(args: readonly string[], toolName: string): void {
    const cfgPath = args[args.indexOf('--mcp-config') + 1];
    if (cfgPath === undefined || !fs.existsSync(cfgPath)) return;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { mcpServers: Record<string, { args: string[] }> };
    const sArgs = cfg.mcpServers[DAEDALUS_MCP_SERVER]?.args ?? [];
    const log = sArgs[sArgs.indexOf('--call-log') + 1];
    if (log === undefined) return;
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(
      log,
      `${JSON.stringify({ schema: 'mcp-call/v1', ts: '2026-10-18T00:00:00.000Z', seq: 1, tool: toolName, argsSha256: '0'.repeat(64), filesTouched: [], blockingCount: 0, verdict: null, durationMs: 1, error: null, treeChangedSinceStart: false })}\n`,
    );
  }
}
