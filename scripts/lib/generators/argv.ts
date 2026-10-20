/**
 * Exact confinement argv of the Claude Code headless call (FR-v1.2E-28; SECURITY-11; BR-U5a-41).
 *
 * `buildGeneratorArgs` emits exactly the BR-U5a-41 set, in that order. The Bash allow rule is the one exact
 * type-check command (`typecheckCommand`), with no wildcard. `--bare`, `--add-dir` and
 * `--dangerously-skip-permissions` are never emitted. When `config.allowBash` is false (a failed live confinement
 * probe, BR-U5a-43), the no-Bash variant drops `Bash` from `--tools` and drops `--allowedTools` with its rule.
 *
 * Customizations off (`GENERATOR_CUSTOMIZATIONS_OFF`, DELEG3 option D, 2026-10-20): the explicit flags that replace
 * `--safe-mode`. On CLI 2.1.304 `--safe-mode` also drops every `--mcp-config` server, so the `daedalus-mcp` arm had
 * no tool. Both arms share this set; MCP comes only through `--strict-mcp-config` (no server in `none`, exactly the
 * daedalus server in `daedalus-mcp`). Evidence: the `equivalence/` folder of the S4-with-MCP results (one turn under each set:
 * same tools, servers, plugins and permission mode, no skill, slash command or CLAUDE.md). Stages A and B ran with
 * `--safe-mode`.
 */
import * as path from 'node:path';
import type { GenerationRequest, GeneratorCliConfig } from './types.js';

export const GENERATOR_TOOLS_WITH_BASH = 'Read,Write,Edit,Glob,Grep,Bash';
export const GENERATOR_TOOLS_NO_BASH = 'Read,Write,Edit,Glob,Grep';
export const FORBIDDEN_GENERATOR_FLAGS: readonly string[] = ['--bare', '--add-dir', '--dangerously-skip-permissions'];

/**
 * What `--safe-mode` disabled, minus MCP, as explicit flags (CLI 2.1.304):
 * - `--setting-sources ""`: no user, project or local settings source, so no CLAUDE.md, CLAUDE.local.md or
 *   `.claude/rules` of those sources, none of their hooks, enabled plugins, agents or output styles;
 * - `--settings {autoMemoryEnabled:false, disableAllHooks:true}`: auto-memory off, and no settings or plugin hook
 *   (only managed hooks would remain, as under `--safe-mode`; none is installed);
 * - `--disable-slash-commands`: no skill and no custom or built-in slash command.
 * Not reproducible by a flag (inert here): the built-in `statusline-setup` agent stays listed (no Agent tool in
 * `--tools`); the managed CLAUDE.md and org memory, which `--safe-mode` skips through `CLAUDE_CODE_DISABLE_CLAUDE_MDS`
 * and its own switch, are absent on the study machine.
 */
export const GENERATOR_CUSTOMIZATIONS_OFF: readonly string[] = Object.freeze([
  '--setting-sources',
  '',
  '--settings',
  '{"autoMemoryEnabled":false,"disableAllHooks":true}',
  '--disable-slash-commands',
]);

/** `<H>/bin/tsc`: the harness-owned launcher of the pinned skeleton typescript. */
export function harnessTscPath(harnessRoot: string): string {
  return path.posix.join(harnessRoot, 'bin', 'tsc');
}

/** `<H>/runs/<runId>/tsconfig.json`. */
export function harnessTsconfigPath(harnessRoot: string, runId: string): string {
  return path.posix.join(harnessRoot, 'runs', ...runId.split('/'), 'tsconfig.json');
}

/** The exact type-check command (also the `{{TYPECHECK_COMMAND}}` of the prompt, BR-U5a-52). */
export function typecheckCommand(harnessRoot: string, runId: string): string {
  return `${harnessTscPath(harnessRoot)} --noEmit --incremental false -p ${harnessTsconfigPath(harnessRoot, runId)}`;
}

/** The single Bash allow rule of BR-U5a-41. */
export function bashAllowRule(harnessRoot: string, runId: string): string {
  return `Bash(${typecheckCommand(harnessRoot, runId)})`;
}

export function buildGeneratorArgs(
  config: GeneratorCliConfig,
  req: Pick<GenerationRequest, 'runId'>,
  prompt: string,
): readonly string[] {
  const args: string[] = [
    '-p',
    prompt,
    '--model',
    config.modelId,
    '--output-format',
    'json',
    ...GENERATOR_CUSTOMIZATIONS_OFF,
    '--restricted',
    '--tools',
    config.allowBash ? GENERATOR_TOOLS_WITH_BASH : GENERATOR_TOOLS_NO_BASH,
  ];
  if (config.allowBash) {
    args.push('--allowedTools', bashAllowRule(config.harnessRoot, req.runId));
  }
  args.push(
    '--disallowedTools',
    'Write(node_modules/**)',
    'Edit(node_modules/**)',
    '--permission-mode',
    'acceptEdits',
    '--permission-prompts',
    'none',
    '--no-session-persistence',
    '--strict-mcp-config',
  );
  return Object.freeze(args);
}
