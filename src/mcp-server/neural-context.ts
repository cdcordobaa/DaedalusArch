/**
 * Flags and wiring of the neural arm of the MCP server (v1.3; Docs/v1.3/neural-arm-agent-tools.md). OFF by default:
 * without `--neural` (or `DAEDALUS_NEURAL`) the server has no neural service, registers no neural tool and every
 * existing tool and description is byte-identical to the server without this file.
 *
 *   --neural off|claude-cli|mock|ensemble     (env DAEDALUS_NEURAL)
 *   --neural-cassettes <dir>                  cassette root (default .firewall/cassettes/mcp-neural)
 *   --neural-wait-ms <ms>                     latency budget of one tool call before `pending` (default 20000)
 *   --claude-config-dir <dir>                 isolated Claude config (default ~/.firewall/judge-claude-config)
 *   --judge-cli <path>                        Claude CLI binary (default ~/.firewall/judge-cli/node_modules/.bin/claude
 *                                             when it exists, else `claude` on PATH; the pre-flight pins 2.1.294)
 *   --ensemble-raters claude-cli,agy,gemini-api
 *   --ensemble-rule fail-if-both|fail-if-either   (default fail-if-both)
 *   --agy-model <name>   --agy-home <dir>
 *   --gemini-model <id>  --gemini-max-calls <n>  --gemini-max-tokens <n>  --gemini-max-usd <n (<= 5)>
 *   --gemini-ledger <file>                    spend ledger that persists across restarts
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ProcessRunner } from '../shared/interfaces/process-runner.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import { NodeProcessRunner } from '../shared/process/node-process-runner.js';
import { MockLLMProvider } from '../llm-critic/mock-provider.js';
import { ClaudeCliProvider } from '../llm-critic/claude-cli-provider.js';
import { expandHome } from '../llm-critic/agy-cli-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MODEL, JUDGE_TIMEOUT_MS } from '../llm-critic/frozen.js';
import {
  COMBINATION_RULES, EnsembleRater, agyRater, claudeCliRater, geminiApiRater,
} from '../llm-critic/ensemble.js';
import type { CombinationRule, NeuralRater, SpendCap } from '../llm-critic/ensemble.js';
import { EnsembleJudge, NeuralService, SingleJudge } from './neural-service.js';

export type NeuralMode = 'off' | 'claude-cli' | 'mock' | 'ensemble';
export const NEURAL_MODES: readonly NeuralMode[] = ['off', 'claude-cli', 'mock', 'ensemble'];
export type EnsembleRaterName = 'claude-cli' | 'agy' | 'gemini-api';
export const ENSEMBLE_RATER_NAMES: readonly EnsembleRaterName[] = ['claude-cli', 'agy', 'gemini-api'];
export const DEFAULT_NEURAL_CASSETTES = '.firewall/cassettes/mcp-neural';
/** The pinned judge CLI install the judge runs use (`scripts/judge-robustness-cli.ts`). */
export const JUDGE_CLI_DEFAULT = '~/.firewall/judge-cli/node_modules/.bin/claude';

/** `--judge-cli`, else the pinned install when present, else `claude` on PATH. */
export function judgeCliOf(args: Pick<NeuralArgs, 'judgeCli'>, home: string, exists: (p: string) => boolean = fs.existsSync): string {
  if (args.judgeCli !== undefined) return expandHome(args.judgeCli, home);
  const pinned = expandHome(JUDGE_CLI_DEFAULT, home);
  return exists(pinned) ? pinned : 'claude';
}

export interface NeuralArgs {
  readonly mode: NeuralMode;
  readonly cassettes?: string;
  readonly waitMs?: number;
  readonly claudeConfigDir?: string;
  readonly judgeCli?: string;
  readonly raters?: readonly EnsembleRaterName[];
  readonly rule?: CombinationRule;
  readonly agyModel?: string;
  readonly agyHome?: string;
  readonly geminiModel?: string;
  readonly geminiCap?: Partial<SpendCap>;
  readonly geminiLedger?: string;
}

const VALUE_FLAGS = new Set([
  '--neural', '--neural-cassettes', '--neural-wait-ms', '--claude-config-dir', '--judge-cli', '--ensemble-raters', '--ensemble-rule',
  '--agy-model', '--agy-home', '--gemini-model', '--gemini-max-calls', '--gemini-max-tokens', '--gemini-max-usd', '--gemini-ledger',
]);

function positive(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The neural flags (and `DAEDALUS_NEURAL`); `undefined` when none is given, `{ mode: 'off' }` when it is turned off
 * explicitly (a flag wins over the environment). An unknown mode, rater or rule
 * throws: a mistyped flag must not silently leave the arm off or pick another vendor.
 */
export function parseNeuralArgs(argv: readonly string[], env: NodeJS.ProcessEnv = {}): NeuralArgs | undefined {
  const v = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const eq = arg.indexOf('=');
    const flag = eq >= 0 ? arg.slice(0, eq) : arg;
    if (!VALUE_FLAGS.has(flag)) continue;
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[i + 1];
    if (value === undefined || value === '') continue;
    v.set(flag, value);
    if (eq < 0) i++;
  }
  const mode = v.get('--neural') ?? env.DAEDALUS_NEURAL;
  if (mode === undefined) return undefined;
  if (mode === 'off') return { mode: 'off' };
  if (!(NEURAL_MODES as readonly string[]).includes(mode)) throw new Error(`--neural ${mode}: expected one of ${NEURAL_MODES.join(', ')}`);
  const raters = v.get('--ensemble-raters')?.split(',').map((r) => r.trim()).filter((r) => r !== '');
  for (const r of raters ?? []) {
    if (!(ENSEMBLE_RATER_NAMES as readonly string[]).includes(r)) throw new Error(`--ensemble-raters ${r}: expected ${ENSEMBLE_RATER_NAMES.join(', ')}`);
  }
  const rule = v.get('--ensemble-rule');
  if (rule !== undefined && !(COMBINATION_RULES as readonly string[]).includes(rule)) throw new Error(`--ensemble-rule ${rule}: expected ${COMBINATION_RULES.join(' or ')}`);
  const cap: { maxCalls?: number; maxTokens?: number; maxUsd?: number } = {};
  const calls = positive(v.get('--gemini-max-calls'));
  const tokens = positive(v.get('--gemini-max-tokens'));
  const usd = positive(v.get('--gemini-max-usd'));
  if (calls !== undefined) cap.maxCalls = calls;
  if (tokens !== undefined) cap.maxTokens = tokens;
  if (usd !== undefined) cap.maxUsd = usd;
  const wait = positive(v.get('--neural-wait-ms'));
  const out: { -readonly [K in keyof NeuralArgs]: NeuralArgs[K] } = { mode: mode as NeuralMode };
  const strings: readonly [string, 'cassettes' | 'claudeConfigDir' | 'judgeCli' | 'agyModel' | 'agyHome' | 'geminiModel' | 'geminiLedger'][] = [
    ['--neural-cassettes', 'cassettes'], ['--claude-config-dir', 'claudeConfigDir'], ['--judge-cli', 'judgeCli'],
    ['--agy-model', 'agyModel'], ['--agy-home', 'agyHome'], ['--gemini-model', 'geminiModel'], ['--gemini-ledger', 'geminiLedger'],
  ];
  for (const [flag, field] of strings) {
    const value = v.get(flag);
    if (value !== undefined) out[field] = value;
  }
  if (wait !== undefined) out.waitMs = wait;
  if (raters !== undefined) out.raters = raters as EnsembleRaterName[];
  if (rule !== undefined) out.rule = rule as CombinationRule;
  if (Object.keys(cap).length > 0) out.geminiCap = cap;
  return out;
}

export interface NeuralDeps {
  readonly runner?: ProcessRunner;
  readonly home?: string;
  readonly cwd?: string;
  /** Replaces the provider of `--neural claude-cli` (tests). */
  readonly makeClaude?: () => LLMProvider;
  /** Replaces the ensemble's raters by name (tests: stub raters, no process). */
  readonly makeRater?: (name: EnsembleRaterName) => NeuralRater;
}

/** The neural service of the server, or `undefined` when the arm is off. Nothing is spawned here. */
export function buildNeuralService(args: NeuralArgs | undefined, env: NodeJS.ProcessEnv, deps: NeuralDeps = {}): NeuralService | undefined {
  if (args === undefined || args.mode === 'off') return undefined;
  const home = deps.home ?? os.homedir();
  const runner = deps.runner ?? new NodeProcessRunner();
  const cassette = { mode: 'record' as const, dir: path.resolve(deps.cwd ?? process.cwd(), args.cassettes ?? DEFAULT_NEURAL_CASSETTES) };
  const waitMs = args.waitMs !== undefined ? { waitMs: args.waitMs } : {};
  const configDir = expandHome(args.claudeConfigDir ?? JUDGE_CONFIG_DIR_DEFAULT, home);
  if (args.mode === 'mock') return new NeuralService({ judge: new SingleJudge(new MockLLMProvider(), { cassette }), ...waitMs });
  if (args.mode === 'claude-cli') {
    const provider = deps.makeClaude?.() ?? new ClaudeCliProvider(
      { binary: judgeCliOf(args, home), model: JUDGE_MODEL, effort: JUDGE_EFFORT, timeoutMs: JUDGE_TIMEOUT_MS, judgeConfigDir: configDir, mode: 'record' },
      { runner, parentEnv: env },
    );
    return new NeuralService({ judge: new SingleJudge(provider, { cassette }), ...waitMs });
  }
  const names = args.raters ?? ['claude-cli', 'agy'];
  const raters = names.map((name): NeuralRater => {
    if (deps.makeRater !== undefined) return deps.makeRater(name);
    if (name === 'claude-cli') return claudeCliRater({ configDir, binary: judgeCliOf(args, home) }, { runner, parentEnv: env, home });
    if (name === 'agy') return agyRater({ ...(args.agyModel !== undefined ? { model: args.agyModel } : {}), ...(args.agyHome !== undefined ? { home: args.agyHome } : {}) }, { runner, parentEnv: env, home });
    return geminiApiRater({
      ...(args.geminiModel !== undefined ? { model: args.geminiModel } : {}),
      ...(args.geminiCap !== undefined ? { cap: args.geminiCap } : {}),
      ...(args.geminiLedger !== undefined ? { ledgerFile: path.resolve(deps.cwd ?? process.cwd(), args.geminiLedger) } : {}),
    }, { env });
  });
  return new NeuralService({ judge: new EnsembleJudge(new EnsembleRater(raters, args.rule ?? 'fail-if-both')), ...waitMs });
}
