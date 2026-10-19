/**
 * EFF-01 argv and MCP config (design DR-9 to DR-11, as amended by A1 DR-A1-2).
 *
 * `buildArmCall` is not used (DR-10: it hard-codes the neo4j engine, the 9-tool Study 2 list, Write/Edit and
 * `acceptEdits`). The argv is built here from `mcpToolRules` and validated with `checkArmArgs` plus an EFF-01 check.
 */
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../../src/shared/errors/domain-result.js';
import { checkCallLogPath } from '../../../../src/mcp-server/call-log.js';
import { TOOL_NAMES } from '../../../../src/mcp-server/server.js';
import { checkArmArgs, DAEDALUS_MCP_SERVER, mcpToolRules } from '../../../lib/generators/arms.js';
import type { McpConfigFile } from '../../../lib/generators/arms.js';
import { FORBIDDEN_GENERATOR_FLAGS } from '../../../lib/generators/argv.js';
import { CAP_TURNS } from './types.js';
import type { Eff01Condition } from './types.js';

export const FILE_TOOLS = 'Read,Grep,Glob';
export const FILE_TOOL_NAMES: readonly string[] = Object.freeze(['Read', 'Grep', 'Glob']);

/** Flags and tool names no EFF-01 argv may carry (DR-9). */
export const EFF01_FORBIDDEN_FLAGS: readonly string[] = Object.freeze([...FORBIDDEN_GENERATOR_FLAGS, '--max-budget-usd', '--permission-mode']);
export const EFF01_FORBIDDEN_TOOLS: readonly string[] = Object.freeze(['Write', 'Edit', 'Bash', 'MultiEdit', 'NotebookEdit']);

/** The 11 G allow rules, in `TOOL_NAMES` order, by exact name. */
export function graphAllowRules(): readonly string[] {
  return mcpToolRules(DAEDALUS_MCP_SERVER, TOOL_NAMES);
}

/** A session key safe as one file name: the session id with `/` replaced by `__`. */
export function sessionKeyOf(sessionId: string): string {
  return sessionId.split('/').join('__');
}

export function sessionIdOfKey(key: string): string {
  return key.split('__').join('/');
}

/** `<H>/mcp/<sessionKey>.json` (DR-9, DR-11: per session). */
export function mcpConfigPathOf(harnessRoot: string, sessionKey: string): string {
  return path.join(harnessRoot, 'mcp', `${sessionKey}.json`);
}

/** `<H>/calls/<sessionKey>.jsonl` (DR-11). */
export function callLogPathOf(harnessRoot: string, sessionKey: string): string {
  return path.join(harnessRoot, 'calls', `${sessionKey}.jsonl`);
}

export interface ConditionArgsInput {
  readonly prompt: string;
  readonly model: string;
  /** Required for G. */
  readonly mcpConfigPath?: string;
}

function err(code: string, message: string): DomainError {
  return { code, message };
}

/** The extra EFF-01 check: no budget or permission-mode flag, and no write, edit or shell tool anywhere. */
export function checkEff01Args(args: readonly string[]): DomainError[] {
  const errors: DomainError[] = [];
  for (const flag of EFF01_FORBIDDEN_FLAGS) if (args.includes(flag)) errors.push(err('EFF01_FORBIDDEN_FLAG', `${flag} must not be emitted`));
  const toolsAt = args.indexOf('--tools');
  const toolList = toolsAt >= 0 ? (args[toolsAt + 1] ?? '').split(',').map((t) => t.trim()) : [];
  // args[1] is the prompt (free text), so it is not read as a tool name.
  for (const a of [...args.filter((_, i) => i !== 1), ...toolList]) {
    for (const t of EFF01_FORBIDDEN_TOOLS) {
      if (a === t || a.startsWith(`${t}(`)) errors.push(err('EFF01_FORBIDDEN_TOOL', `${t} must not be allowed`));
    }
  }
  return errors;
}

/** DR-9 / DR-A1-2: the argv of one condition, validated. */
export function buildConditionArgs(condition: Eff01Condition, input: ConditionArgsInput): DomainResult<readonly string[]> {
  const head = ['-p', input.prompt, '--model', input.model, '--output-format', 'stream-json', '--verbose', '--safe-mode', '--restricted', '--max-turns', String(CAP_TURNS)];
  let args: string[];
  if (condition === 'R') {
    args = [...head, '--tools', FILE_TOOLS, '--permission-prompts', 'none', '--no-session-persistence', '--strict-mcp-config'];
  } else if (condition === 'G') {
    if (input.mcpConfigPath === undefined || !path.isAbsolute(input.mcpConfigPath)) {
      return DomainResult.fail([err('EFF01_MCP_CONFIG', 'G needs an absolute per-session --mcp-config path')]);
    }
    args = [
      ...head,
      '--tools',
      FILE_TOOLS,
      '--strict-mcp-config',
      '--mcp-config',
      input.mcpConfigPath,
      '--allowedTools',
      ...graphAllowRules(),
      '--permission-prompts',
      'none',
      '--no-session-persistence',
    ];
  } else {
    args = [...head, '--tools', '', '--permission-prompts', 'none', '--no-session-persistence', '--strict-mcp-config'];
  }
  const checked = checkArmArgs(args, condition === 'G' ? DAEDALUS_MCP_SERVER : null);
  const extra = checkEff01Args(args);
  const errors = [...(checked.success ? [] : checked.errors), ...extra];
  if (errors.length > 0) return DomainResult.fail(errors);
  return DomainResult.ok(Object.freeze(args));
}

export interface Eff01ServerInput {
  readonly nodeBinary: string;
  readonly serverEntry: string;
  readonly specPath: string;
  readonly treeDir: string;
  readonly callLogPath: string;
}

/** DR-11: one stdio server, the in-process engine, a per-session call log outside the tree. */
export function eff01McpConfig(input: Eff01ServerInput): DomainResult<McpConfigFile> {
  const errors: DomainError[] = [];
  const fields: [string, string][] = [
    ['nodeBinary', input.nodeBinary],
    ['serverEntry', input.serverEntry],
    ['specPath', input.specPath],
    ['treeDir', input.treeDir],
    ['callLogPath', input.callLogPath],
  ];
  for (const [field, value] of fields) {
    if (!path.isAbsolute(value)) errors.push(err('EFF01_PATH_NOT_ABSOLUTE', `${field} must be an absolute path`));
  }
  if (errors.length === 0) {
    const logProblem = checkCallLogPath(input.callLogPath, input.treeDir);
    if (logProblem !== null) errors.push(err('EFF01_CALL_LOG', logProblem));
  }
  if (errors.length > 0) return DomainResult.fail(errors);
  return DomainResult.ok({
    mcpServers: {
      [DAEDALUS_MCP_SERVER]: {
        type: 'stdio',
        command: input.nodeBinary,
        args: [input.serverEntry, '--spec', input.specPath, '--project', input.treeDir, '--engine', 'cypher-interp', '--call-log', input.callLogPath],
        env: {},
      },
    },
  });
}
