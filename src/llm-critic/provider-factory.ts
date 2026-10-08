import * as os from 'node:os';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { ProcessRunner } from '../shared/interfaces/process-runner.js';
import type { LLMProviderConfig, GeminiConfig } from '../shared/types/llm-config.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { NodeProcessRunner } from '../shared/process/node-process-runner.js';
import { MockLLMProvider } from './mock-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { NullLLMProvider } from './null-provider.js';
import { ClaudeCliProvider } from './claude-cli-provider.js';
import { CassetteLLMProvider } from './cassette-provider.js';
import type { CassetteOptions } from './cassette-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MODEL, JUDGE_TIMEOUT_MS } from './frozen.js';

/**
 * Provider factory (U4 Step 20, U4-K3; FR-23, FR-31, D-U0-8, D-U0-17; DE §5.6).
 *
 * `createLLMProvider` builds the inner provider: `claude-cli` → `ClaudeCliProvider`;
 * `gemini` → `GeminiProvider` with the configured, pinned model (no default id, VRD-09) and
 * `config.gemini.apiKey ?? GEMINI_API_KEY` (read only for Gemini, ISO-01); `mock` →
 * `MockLLMProvider`; anything unconfigured → `NullLLMProvider`.
 *
 * `createJudgeProvider` is the judge entry: it wraps the inner provider exactly once in a
 * `CassetteLLMProvider` (BR-U4-CAS-*), and for `claude-cli` in record mode first runs the
 * isolation pre-flight (ISO-04..06, ISO-09) so the decorator carries the CLI version and the
 * probe and listing hashes; a failed pre-flight is returned as its stop error.
 */

/** Extra inputs of the `claude-cli` provider (the shared `ClaudeCliConfig` has no judge dir). */
export interface ProviderFactoryDeps {
  readonly judgeConfigDir?: string;        // absolute; default `~/.firewall/judge-claude-config` expanded
  readonly projectRoot?: string;
  readonly runner?: ProcessRunner;         // default NodeProcessRunner
  readonly parentEnv?: NodeJS.ProcessEnv;  // default process.env
}

function defaultJudgeConfigDir(): string {
  return JUDGE_CONFIG_DIR_DEFAULT.replace(/^~(?=\/|$)/, os.homedir());
}

function judgeConfigDirOf(config: LLMProviderConfig, deps: ProviderFactoryDeps): string {
  const fromConfig = (config as LLMProviderConfig & { readonly judgeConfigDir?: string }).judgeConfigDir;
  return deps.judgeConfigDir ?? fromConfig ?? defaultJudgeConfigDir();
}

export function createLLMProvider(config?: LLMProviderConfig, deps: ProviderFactoryDeps = {}): LLMProvider {
  if (!config) {
    return new NullLLMProvider();
  }

  switch (config.provider) {
    case 'claude-cli': {
      const cli = config.claudeCli;
      return new ClaudeCliProvider(
        {
          binary: cli?.binary ?? 'claude',
          model: cli?.model ?? JUDGE_MODEL,
          effort: cli?.effort ?? JUDGE_EFFORT,
          timeoutMs: cli?.timeoutMs ?? JUDGE_TIMEOUT_MS,
          judgeConfigDir: judgeConfigDirOf(config, deps),
          mode: config.cassette.mode,
          ...(deps.projectRoot !== undefined ? { projectRoot: deps.projectRoot } : {}),
        },
        {
          runner: deps.runner ?? new NodeProcessRunner(),
          ...(deps.parentEnv !== undefined ? { parentEnv: deps.parentEnv } : {}),
          ...(cli?.neutralCwd !== undefined && cli.neutralCwd !== '' ? { tmpRoot: cli.neutralCwd } : {}),
        },
      );
    }

    case 'gemini': {
      const apiKey = config.gemini?.apiKey ?? process.env.GEMINI_API_KEY;
      const model = config.gemini?.model ?? '';
      // No key or no pinned model id → not configured (VRD-09: no default Gemini id).
      if (!apiKey || model === '') {
        return new NullLLMProvider();
      }

      const geminiConfig: GeminiConfig = {
        apiKey,
        model,
        temperature: config.gemini?.temperature ?? 0,
        maxTokens: config.gemini?.maxTokens ?? 4096,
      };

      return new GeminiProvider(geminiConfig);
    }

    case 'mock':
      return new MockLLMProvider();

    default:
      return new NullLLMProvider();
  }
}

/** Decorator options a caller may add (provenance, omit-prompt, secrets); mode and dir come from the config. */
export type JudgeCassetteOptions = Omit<CassetteOptions, 'mode' | 'dir' | 'interpret' | 'cliVersion' | 'isolationProbeSha256' | 'configListingSha256'>;

/**
 * The judge provider: the inner provider wrapped once in `CassetteLLMProvider`. For
 * `claude-cli` in record mode the isolation pre-flight runs first and a failure (version
 * drift, isolation, CLI not found, auth) is returned as the error.
 */
export async function createJudgeProvider(
  config: LLMProviderConfig,
  deps: ProviderFactoryDeps = {},
  cassetteOptions: JudgeCassetteOptions = {},
): Promise<DomainResult<CassetteLLMProvider>> {
  const inner = createLLMProvider(config, deps);
  const base: CassetteOptions = { ...cassetteOptions, mode: config.cassette.mode, dir: config.cassette.dir };
  if (!(inner instanceof ClaudeCliProvider)) {
    return DomainResult.ok(new CassetteLLMProvider(inner, base));
  }
  if (config.cassette.mode === 'replay') {
    return DomainResult.ok(new CassetteLLMProvider(inner, { ...base, interpret: inner.interpret }));
  }
  const prepared = await inner.prepare();
  if (!prepared.success) return DomainResult.fail(prepared.errors);
  return DomainResult.ok(new CassetteLLMProvider(inner, {
    ...base,
    interpret: inner.interpret,
    cliVersion: prepared.data.cliVersion,
    isolationProbeSha256: prepared.data.isolationProbeSha256,
    configListingSha256: prepared.data.configListingSha256,
  }));
}
