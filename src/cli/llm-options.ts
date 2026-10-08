/**
 * LLM and judge CLI options (U4 DE §5.6; BR-U4-ISO-01, ISO-04, VRD-09, CAS-05, CAS-08,
 * OPS-01; FR-23, FR-31; D-U0-8, D-U0-17).
 *
 * `parseLLMOptions(argv, env)` reads only the options below from `argv` (any other argument
 * is left to the caller's parser) and, from `env`, only `GEMINI_API_KEY`, and only when the
 * provider is `gemini`. No Anthropic or OpenAI key is read anywhere: Claude is reached only
 * through the CLI under the subscription login (ISO-01). `cli.ts` wiring is U3's application
 * of U4's C9 hunks (D-U4-7).
 *
 * | Option                          | Default                                   |
 * |---------------------------------|-------------------------------------------|
 * | `--llm-provider <p>`            | `claude-cli` (`claude-cli`, `gemini`, `mock`) |
 * | `--llm-model <id>`              | `claude-opus-5-5` (claude-cli, mock); none for gemini |
 * | `--llm-effort <level>`          | `high`                                    |
 * | `--cassette-mode <m>`           | `record` (`record`, `replay`; `bypass` rejected) |
 * | `--cassette-dir <dir>`          | `./.firewall/cassettes`                   |
 * | `--judge-repetition <n>`        | `0`                                       |
 * | `--judge-config-dir <dir>`      | `~/.firewall/judge-claude-config`         |
 * | `--judge-baseline-report <path>`| none                                      |
 * | `--cassette-omit-prompt`        | off                                       |
 */
import * as os from 'node:os';
import * as path from 'node:path';
import type { LLMEffort } from '../shared/interfaces/llm-provider.js';
import type { LLMProviderConfig, VCRMode } from '../shared/types/llm-config.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import {
  DEFAULT_CASSETTE_DIR, JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL, JUDGE_TIMEOUT_MS,
} from '../llm-critic/frozen.js';
import { configDirPlacementProblem } from '../llm-critic/claude-cli-provider.js';
import type { JudgeRunSettings } from '../llm-critic/types.js';

export type LLMProviderName = LLMProviderConfig['provider'];

/** Per-run judge settings the critic reads (subset of DE §5.5 `NeuronalRunOptions`). */
/** The parsed run settings (DE §5.6); the same type the C9 hunks pass to the critic stage. */
export type LLMRunSettings = JudgeRunSettings;

/** `LLMProviderConfig` plus the judge config dir and the run settings (DE §5.6). */
export type ParsedLLMOptions = LLMProviderConfig & {
  readonly judgeConfigDir: string;
  readonly run: LLMRunSettings;
};

export interface LLMOptionsContext {
  /** The evaluated project; a judge config dir inside it is refused (ISO-04). */
  readonly projectRoot?: string;
  /** Home directory for `~` expansion (default `os.homedir()`; never read from `env`). */
  readonly homeDir?: string;
}

const PROVIDERS: readonly LLMProviderName[] = ['claude-cli', 'gemini', 'mock'];
const EFFORTS: readonly LLMEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const MODES: readonly VCRMode[] = ['record', 'replay'];
const VALUE_OPTIONS = [
  '--llm-provider', '--llm-model', '--llm-effort', '--cassette-mode', '--cassette-dir',
  '--judge-repetition', '--judge-config-dir', '--judge-baseline-report',
] as const;
const FLAG_OPTIONS = ['--cassette-omit-prompt'] as const;

type ValueOption = (typeof VALUE_OPTIONS)[number];

function configError<T>(message: string): DomainResult<T> {
  return DomainResult.fail([{ code: 'LLM_CONFIG_INVALID', message }]);
}

/** `~` and `~/x` expand to the home directory; the result is absolute. */
export function expandHome(dir: string, homeDir: string = os.homedir()): string {
  if (dir === '~') return homeDir;
  if (dir.startsWith('~/')) return path.join(homeDir, dir.slice(2));
  return path.resolve(dir);
}

function collect(argv: readonly string[]): DomainResult<{ values: Partial<Record<ValueOption, string>>; flags: Set<string> }> {
  const values: Partial<Record<ValueOption, string>> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if ((FLAG_OPTIONS as readonly string[]).includes(name)) {
      if (eq !== -1) return configError(`${name} takes no value`);
      flags.add(name);
      continue;
    }
    if (!(VALUE_OPTIONS as readonly string[]).includes(name)) continue;
    let value: string | undefined;
    if (eq !== -1) value = arg.slice(eq + 1);
    else {
      value = argv[i + 1];
      i++;
    }
    if (value === undefined || value === '' || (eq === -1 && value.startsWith('--'))) return configError(`${name} needs a value`);
    values[name as ValueOption] = value;
  }
  return DomainResult.ok({ values, flags });
}

/**
 * Parses the LLM and judge options (DE §5.6). Configuration errors (`LLM_CONFIG_INVALID`):
 * unknown provider, effort or cassette mode (`bypass` included); Gemini without
 * `--llm-model` (no default id, VRD-09) or without `GEMINI_API_KEY` (ISO-01 b: an
 * Anthropic key never stands in); a non-integer or negative repetition; for
 * `claude-cli`, a judge config dir inside the evaluated project or a git repository (ISO-04).
 */
export function parseLLMOptions(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  context: LLMOptionsContext = {},
): DomainResult<ParsedLLMOptions> {
  const parsed = collect(argv);
  if (!parsed.success) return DomainResult.fail(parsed.errors);
  const { values, flags } = parsed.data;

  const provider = (values['--llm-provider'] ?? 'claude-cli') as LLMProviderName;
  if (!PROVIDERS.includes(provider)) return configError(`--llm-provider must be one of ${PROVIDERS.join(', ')}`);

  const effort = (values['--llm-effort'] ?? JUDGE_EFFORT) as LLMEffort;
  if (!EFFORTS.includes(effort)) return configError(`--llm-effort must be one of ${EFFORTS.join(', ')}`);

  const mode = (values['--cassette-mode'] ?? 'record') as VCRMode;
  if (!MODES.includes(mode)) return configError(`--cassette-mode must be record or replay (got ${values['--cassette-mode'] ?? ''})`);

  const repetitionText = values['--judge-repetition'] ?? '0';
  if (!/^[0-9]+$/.test(repetitionText)) return configError('--judge-repetition must be a non-negative integer');
  const repetition = Number(repetitionText);

  const model = values['--llm-model'] ?? (provider === 'gemini' ? undefined : JUDGE_MODEL);
  if (model === undefined) return configError('--llm-provider gemini requires --llm-model (there is no default Gemini id)');

  const homeDir = context.homeDir ?? os.homedir();
  const judgeConfigDir = expandHome(values['--judge-config-dir'] ?? JUDGE_CONFIG_DIR_DEFAULT, homeDir);
  if (provider === 'claude-cli') {
    const problem = configDirPlacementProblem(judgeConfigDir, context.projectRoot);
    if (problem !== null) return configError(`--judge-config-dir: ${problem}`);
  }

  let gemini: LLMProviderConfig['gemini'];
  if (provider === 'gemini') {
    const apiKey = env.GEMINI_API_KEY;
    if (apiKey === undefined || apiKey === '') return configError('--llm-provider gemini requires GEMINI_API_KEY');
    gemini = { apiKey, model, temperature: 0, maxTokens: JUDGE_MAX_TOKENS };
  }

  const cassette = { mode, dir: values['--cassette-dir'] ?? DEFAULT_CASSETTE_DIR };
  const baselineReport = values['--judge-baseline-report'];
  return DomainResult.ok({
    provider,
    ...(gemini !== undefined ? { gemini } : {}),
    ...(provider === 'claude-cli'
      ? { claudeCli: { binary: 'claude', model, effort, timeoutMs: JUDGE_TIMEOUT_MS, neutralCwd: os.tmpdir() } }
      : {}),
    cassette,
    judgeConfigDir,
    run: {
      llm: { model, effort, maxTokens: JUDGE_MAX_TOKENS },
      repetition,
      cassette: { ...cassette, omitPrompt: flags.has('--cassette-omit-prompt') },
      ...(baselineReport !== undefined ? { baselineReport } : {}),
    },
  });
}
