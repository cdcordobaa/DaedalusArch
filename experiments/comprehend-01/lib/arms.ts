/**
 * COMPREHEND-01 arms (design §2): the prompt frame, the condition sentences, and the CLI argv of each arm.
 * F (files only) is EFF-01's R argv, built by its `buildConditionArgs` (imported read-only). FG is the same argv plus
 * one MCP config naming the comprehension server alone and the four tools allowed by exact name; it is validated by
 * the same `checkArmArgs` and `checkEff01Args`. The pinned model and caps are EFF-01's.
 */
import * as path from 'node:path';
import { checkCallLogPath } from '../../../src/mcp-server/call-log.js';
import { checkArmArgs, mcpToolRules } from '../../../scripts/lib/generators/arms.js';
import type { McpConfigFile } from '../../../scripts/lib/generators/arms.js';
import { buildConditionArgs, checkEff01Args } from '../../../scripts/v1.3/lib/eff01/argv.js';
import { architectureBlock } from '../../../scripts/v1.3/lib/eff01/inputs.js';
import { CAP_TOKENS, CAP_TURNS, CAP_WALL_MS, DEFAULT_MODEL } from '../../../scripts/v1.3/lib/eff01/types.js';
import { COMPREHEND_SERVER_NAME, COMPREHEND_TOOLS } from '../../detect-02/mcp/comprehend-server.js';
import type { Item } from './bank.js';
import { sha256 } from './bank.js';

export type Arm = 'F' | 'FG';
export const ARMS: readonly Arm[] = ['F', 'FG'];
export const MODEL = DEFAULT_MODEL;
export const CAPS = { wallMs: CAP_WALL_MS, turns: CAP_TURNS, tokens: CAP_TOKENS } as const;

export const FILES_SENTENCE = "You can read the project's files with the Read, Grep and Glob tools; the project root is the working directory.";
export const GRAPH_SENTENCE = "You can also query the project's architecture graph with the context_map, who_writes, trace and impact tools. Check what they say against the code when it matters.";
export const CONDITION: Readonly<Record<Arm, string>> = { F: FILES_SENTENCE, FG: `${FILES_SENTENCE} ${GRAPH_SENTENCE}` };
export const CALIBRATION_PROMPT = 'Reply OK';

export const FRAME = [
  'You are answering one question about the architecture of a TypeScript project. Base your answer on evidence you gather in this session.',
  '',
  '{condition}',
  '',
  "The project's architecture spec (the `architecture:` block of its spec YAML):",
  '{spec}',
  '',
  'Conventions:',
  '{conventions}',
  '',
  'Question: {question}',
  '',
  'End your reply with exactly one line:',
  'ANSWER: {format}',
].join('\n');
export const FRAME_SHA256 = sha256(FRAME);

export function buildPrompt(arm: Arm, item: Item, specText: string, conventions: readonly string[]): string {
  const block = architectureBlock(specText, { stripComments: true });
  const spec = block.success ? block.data : '(no architecture block)';
  return FRAME.replace('{condition}', CONDITION[arm]).replace('{spec}', spec)
    .replace('{conventions}', conventions.map((c) => `- ${c}`).join('\n'))
    .replace('{question}', item.text).replace('{format}', JSON.stringify(item.answerFormat));
}

export const GRAPH_ALLOW_RULES: readonly string[] = mcpToolRules(COMPREHEND_SERVER_NAME, COMPREHEND_TOOLS);

/** The argv of one session (prompt included); FG needs an absolute per-session MCP config path. */
export function armArgs(arm: Arm, prompt: string, mcpConfigPath?: string): { ok: true; args: readonly string[] } | { ok: false; errors: string[] } {
  const built = buildConditionArgs('R', { prompt, model: MODEL });
  if (!built.success) return { ok: false, errors: built.errors.map((e) => `${e.code}: ${e.message}`) };
  // R2 (2026-10-22, after the two calibration smokes, before any question): `--safe-mode` disables every --mcp-config
  // server (FG's smoke saw `mcp_servers: []`), so both arms drop it and add `--disable-slash-commands`, as the
  // brownfield pilot of 2026-10-19 did. `--restricted` still ignores settings files; sessions run from tree copies.
  const base = { data: built.data.flatMap((a) => (a === '--safe-mode' ? ['--disable-slash-commands'] : [a])) };
  if (arm === 'F') return { ok: true, args: base.data };
  if (mcpConfigPath === undefined || !path.isAbsolute(mcpConfigPath)) return { ok: false, errors: ['FG needs an absolute --mcp-config path'] };
  const args = [...base.data];
  const at = args.indexOf('--strict-mcp-config');
  args.splice(at + 1, 0, '--mcp-config', mcpConfigPath, '--allowedTools', ...GRAPH_ALLOW_RULES);
  const checked = checkArmArgs(args, COMPREHEND_SERVER_NAME);
  const errors = [...(checked.success ? [] : checked.errors.map((e) => `${e.code}: ${e.message}`)), ...checkEff01Args(args).map((e) => `${e.code}: ${e.message}`)];
  return errors.length > 0 ? { ok: false, errors } : { ok: true, args };
}

export interface ServerLaunch { readonly nodeBinary: string; readonly entry: string; readonly spec: string; readonly tree: string; readonly tsconfig?: string | undefined; readonly callLog: string }

/** One stdio server: the comprehension server alone, confined, with a call log outside the tree. */
export function graphMcpConfig(s: ServerLaunch): { ok: true; config: McpConfigFile } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(s)) if (typeof v === 'string' && !path.isAbsolute(v)) errors.push(`${k} must be absolute`);
  const logProblem = errors.length === 0 ? checkCallLogPath(s.callLog, s.tree) : null;
  if (logProblem !== null) errors.push(logProblem);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      mcpServers: {
        [COMPREHEND_SERVER_NAME]: {
          type: 'stdio', command: s.nodeBinary,
          args: ['--import', 'tsx', s.entry, '--spec', s.spec, '--project', s.tree, ...(s.tsconfig ? ['--tsconfig', s.tsconfig] : []), '--confine', '--call-log', s.callLog],
          env: {},
        },
      },
    },
  };
}
