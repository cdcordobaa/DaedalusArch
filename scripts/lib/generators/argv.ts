/**
 * Exact confinement argv of the Claude Code headless call (FR-v1.2E-28; SECURITY-11; BR-U5a-41).
 *
 * `buildGeneratorArgs` emits exactly the BR-U5a-41 set, in that order. The Bash allow rule is the one exact
 * type-check command (`typecheckCommand`), with no wildcard. `--bare`, `--add-dir` and
 * `--dangerously-skip-permissions` are never emitted. When `config.allowBash` is false (a failed live confinement
 * probe, BR-U5a-43), the no-Bash variant drops `Bash` from `--tools` and drops `--allowedTools` with its rule.
 */
import * as path from 'node:path';
import type { GenerationRequest, GeneratorCliConfig } from './types.js';

export const GENERATOR_TOOLS_WITH_BASH = 'Read,Write,Edit,Glob,Grep,Bash';
export const GENERATOR_TOOLS_NO_BASH = 'Read,Write,Edit,Glob,Grep';
export const FORBIDDEN_GENERATOR_FLAGS: readonly string[] = ['--bare', '--add-dir', '--dangerously-skip-permissions'];

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
  req: GenerationRequest,
  prompt: string,
): readonly string[] {
  const args: string[] = [
    '-p',
    prompt,
    '--model',
    config.modelId,
    '--output-format',
    'json',
    '--safe-mode',
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
