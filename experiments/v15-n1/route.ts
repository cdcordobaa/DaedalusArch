/**
 * N1 model route: the headless Claude CLI (`claude -p`), the same argv as the U4 S3 prototype
 * (`experiments/v15-u4/llm.ts`: json output, the S3 schema, the S3 system prompt, project settings only, no MCP, no
 * slash commands, no session persistence, no tools), prompt on stdin, from a fresh empty temporary directory.
 *
 * Two routes, recorded on every ledger line and cassette:
 * - `judge` (default, the registered "Claude CLI judge route"): the child env is the judge allow-list
 *   (`JUDGE_ENV_ALLOW`), `CLAUDE_CONFIG_DIR` = the judge config dir (default `~/.firewall/judge-claude-config`,
 *   subscription login, credentials in the macOS keychain) and `DISABLE_AUTOUPDATER=1`. Needs the author's machine.
 * - `ambient`: the parent env with `ANTHROPIC_API_KEY` removed and `DISABLE_AUTOUPDATER=1`; uses whatever login the
 *   `claude` on PATH has (a cloud session's). Untested at build time.
 */
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildJudgeChildEnv } from '../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT } from '../../src/llm-critic/frozen.js';
import type { CallRequest, CallResult, Caller } from './lib.js';

const TIMEOUT_MS = 300_000;
export type RouteKind = 'judge' | 'ambient';

export interface Route {
  readonly kind: RouteKind;
  /** As given (`~` form kept for the record; never an expanded personal path). */
  readonly configDir: string | null;
  readonly env: Readonly<Record<string, string>>;
}

const expand = (p: string): string => (p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

export function routeOf(kind: RouteKind, configDir: string = process.env['N1_JUDGE_CONFIG_DIR'] ?? JUDGE_CONFIG_DIR_DEFAULT): Route {
  if (kind === 'judge') return { kind, configDir, env: buildJudgeChildEnv(process.env, expand(configDir)) };
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== 'ANTHROPIC_API_KEY' && k !== 'CLAUDE_CONFIG_DIR') env[k] = v;
  env['DISABLE_AUTOUPDATER'] = '1';
  return { kind, configDir: null, env };
}

export const ARGV_FLAGS = ['-p', '--model', '--output-format=json', '--json-schema', '--system-prompt', '--setting-sources=project', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--tools='];

/** `claude --version` under the route's env (no model call); null when it cannot be read. */
export function cliVersion(route: Route): string | null {
  try {
    const out = execFileSync('claude', ['--version'], { env: route.env, encoding: 'utf8', timeout: 30_000, cwd: os.tmpdir() });
    return /(\d+\.\d+\.\d+)/.exec(out)?.[1] ?? null;
  } catch { return null; }
}

export function callerOf(route: Route): Caller {
  return (req: CallRequest): Promise<CallResult> => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-n1-call-'));
    const args = ['-p', '--model', req.model, '--output-format', 'json', '--json-schema', JSON.stringify(req.schema),
      '--system-prompt', req.system, '--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--tools', ''];
    const t0 = Date.now();
    return new Promise((resolve) => {
      const child = spawn('claude', args, { cwd, env: route.env, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('close', (code) => {
        clearTimeout(timer);
        fs.rmSync(cwd, { recursive: true, force: true });
        const durationMs = Date.now() - t0;
        let envl: Record<string, unknown> | null = null;
        try { envl = JSON.parse(stdout) as Record<string, unknown>; } catch { envl = null; }
        if (envl === null) { resolve({ answer: null, model: null, durationMs, error: `exit ${String(code)}; no JSON envelope; ${stderr.slice(0, 200)}`, inputTokens: null, outputTokens: null }); return; }
        const usage = envl['modelUsage'] as Record<string, unknown> | undefined;
        const model = usage !== undefined ? Object.keys(usage).sort().join('+') : null;
        const u = envl['usage'] as { input_tokens?: number; output_tokens?: number } | undefined;
        const tok = { inputTokens: u?.input_tokens ?? null, outputTokens: u?.output_tokens ?? null };
        if (envl['is_error'] === true || code !== 0) { resolve({ answer: null, model, durationMs, error: `exit ${String(code)}; ${String(envl['result'] ?? '').slice(0, 200)}`, ...tok }); return; }
        let answer: unknown = envl['structured_output'];
        if (answer === undefined && typeof envl['result'] === 'string') { try { answer = JSON.parse(envl['result']); } catch { answer = null; } }
        resolve({ answer: answer ?? null, model, durationMs, error: null, ...tok });
      });
      child.stdin.end(req.prompt);
    });
  };
}
