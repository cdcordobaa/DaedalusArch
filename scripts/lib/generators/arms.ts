/**
 * Tool arms of the v1.3 firewall-in-the-loop experiment (DRAFT, not registered; `Docs/prereg-drafts/firewall-in-the-loop.md`).
 *
 * An arm is the E1 Claude Code headless call (`buildGeneratorArgs`, SECURITY-11, BR-U5a-41) plus at most one MCP server:
 *
 * - `none`: the E1 argv, byte for byte. `--strict-mcp-config` with no `--mcp-config` loads no server.
 * - `daedalus-mcp`: `--mcp-config <H>/runs/<runId>/mcp-daedalus-mcp.json` naming only the DaedalusArch server (stdio,
 *   `--spec` and `--project` absolute, `--confine`), `--strict-mcp-config` kept so no user or project server loads, and the
 *   server's spec-only tools added to `--allowedTools` by exact name (`mcp__daedalus-arch__<tool>`, no wildcard).
 *   `evaluate_project` (Neo4j, replaces the graph, reads the scorer's objective) is never allowed and is also listed in
 *   `--disallowedTools`.
 * - `context-graph`: a placeholder for a third-party context tool (a code graph, no rules). It has no provider until
 *   one is plugged in (`ContextGraphProvider`); until then `buildArmArgs` refuses it with `ARM_NOT_CONFIGURED`.
 *
 * Every other confinement flag of BR-U5a-41 stays as `buildGeneratorArgs` emits it, in its order; `checkArmArgs`
 * re-asserts the invariants. Nothing here spawns a process: `generate-projects` is unchanged and runs no arm but `none`.
 */
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { FORBIDDEN_GENERATOR_FLAGS, buildGeneratorArgs } from './argv.js';
import { isInsideOrEqual } from './config.js';
import type { GenerationRequest, GeneratorCliConfig } from './types.js';

export type ExperimentArm = 'none' | 'context-graph' | 'daedalus-mcp';

export const EXPERIMENT_ARMS: readonly ExperimentArm[] = Object.freeze(['none', 'context-graph', 'daedalus-mcp']);

/** MCP server name of the DaedalusArch server in the arm's config (the `mcp__<server>__<tool>` prefix). */
export const DAEDALUS_MCP_SERVER = 'daedalus-arch';

/**
 * The DaedalusArch tools the `daedalus-mcp` arm allows: the spec-only tools of `src/mcp-server/server.ts`
 * (`SPEC_TOOL_NAMES`, pinned equal by a test), MCP v2: the seven v1 tools, then `infer_spec` and `explain_finding`
 * (both read-only: `infer_spec` reads a snapshot of the cwd's `src/` and writes nothing to it). Restated here so the
 * harness does not import the server module.
 */
export const DAEDALUS_ARM_TOOLS: readonly string[] = Object.freeze([
  'get_architecture_spec',
  'which_layer',
  'check_import',
  'explain_violation',
  'check_file',
  'check_diff',
  'suggest_placement',
  'infer_spec',
  'explain_finding',
]);

/** Tools of the DaedalusArch server an arm never allows (and lists in `--disallowedTools`). */
export const DAEDALUS_DENIED_TOOLS: readonly string[] = Object.freeze(['evaluate_project']);

/**
 * DRAFT tool sentence appended to the frozen E1 prompt per arm (T3: matched length and style between the two tool
 * arms). Not registered; the registered text would be hashed with the prompt templates.
 */
export const ARM_TOOL_SENTENCES: Readonly<Record<ExperimentArm, string>> = Object.freeze({
  none: '',
  'context-graph':
    'You have read-only tools from an MCP server that describe the files, symbols and imports of this project; use them while you work.',
  'daedalus-mcp':
    'You have read-only tools from an MCP server that check code against the architecture of this project; use them while you work.',
});

/** One stdio MCP server entry of a Claude Code `--mcp-config` file. */
export interface McpStdioServer {
  readonly type: 'stdio';
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export interface McpConfigFile {
  readonly mcpServers: Readonly<Record<string, McpStdioServer>>;
}

/** Where the DaedalusArch server comes from for the `daedalus-mcp` arm. All paths absolute. */
export interface DaedalusServerInput {
  /** Node binary that runs the server. */
  readonly nodeBinary: string;
  /** The built entry, `<repo>/dist/mcp-server/main.js` at a recorded commit. */
  readonly serverEntry: string;
  /** The spec the agent is checked against (the evaluator spec, `specs/clean-arch.yaml`). Outside every cwd. */
  readonly specPath: string;
}

/**
 * A context tool for the `context-graph` arm. To plug one in (Serena, graphify, or another code-graph MCP server):
 * 1. Install it at a pinned version outside the repository and outside `outputRoot` (as the skeleton is).
 * 2. Implement `server(req)` returning its stdio entry, with the run cwd as the only project root it may index.
 * 3. List its read-only tools in `tools` by exact name (no wildcard); leave out anything that writes, runs shell
 *    commands or reaches the network, and put those in `deniedTools`.
 * 4. Match the tool descriptions to the DaedalusArch arm in length and style (T3), then re-run the confinement probes.
 */
export interface ContextGraphProvider {
  /** MCP server name (the `mcp__<server>__` prefix). [A-Za-z0-9_-] only. */
  readonly serverName: string;
  readonly tools: readonly string[];
  readonly deniedTools: readonly string[];
  readonly server: (req: ArmRequest) => McpStdioServer;
}

/** Placeholder description printed by the dry run for an unconfigured `context-graph` arm. */
export const CONTEXT_GRAPH_PLACEHOLDER = Object.freeze({
  status: 'not configured',
  candidates: ['Serena (LSP-backed symbol tools, read-only subset)', 'graphify (code knowledge graph)'],
  steps: [
    'install the tool at a pinned version outside the repository and outside outputRoot',
    'implement ContextGraphProvider.server(req) with the run cwd as the only indexed root',
    'allow only its read-only tools by exact name; deny write, shell and network tools',
    'match tool descriptions to the daedalus-mcp arm (T3) and re-run the confinement probes (T7)',
  ],
});

/** The request fields an arm call reads (the E1 `GenerationRequest` satisfies it; so does a multi-step loop turn). */
export type ArmRequest = Pick<GenerationRequest, 'runId' | 'outputDir'>;

export interface ArmInput {
  readonly arm: ExperimentArm;
  readonly daedalus?: DaedalusServerInput;
  readonly contextGraph?: ContextGraphProvider;
}

/** The argv, the MCP config to write (if any) and where, for one arm and one request. */
export interface ArmCall {
  readonly arm: ExperimentArm;
  readonly args: readonly string[];
  readonly mcpConfigPath: string | null;
  readonly mcpConfig: McpConfigFile | null;
  readonly prompt: string;
}

const SERVER_NAME_RE = /^[A-Za-z0-9_-]+$/;
const TOOL_NAME_RE = /^[A-Za-z0-9_-]+$/;

function err(code: string, message: string): DomainError {
  return { code, message };
}

/** `mcp__<server>__<tool>` for each tool. */
export function mcpToolRules(server: string, tools: readonly string[]): readonly string[] {
  return tools.map((t) => `mcp__${server}__${t}`);
}

/** `<H>/runs/<runId>/mcp-<arm>.json`: harness-owned, outside every cwd (BR-U5a-42). */
export function armMcpConfigPath(harnessRoot: string, runId: string, arm: ExperimentArm): string {
  return path.posix.join(harnessRoot, 'runs', ...runId.split('/'), `mcp-${arm}.json`);
}

/** The frozen E1 prompt with the arm's tool sentence appended (unchanged for `none`). */
export function armPrompt(basePrompt: string, arm: ExperimentArm): string {
  const sentence = ARM_TOOL_SENTENCES[arm];
  return sentence === '' ? basePrompt : `${basePrompt.replace(/\s+$/, '')}\n\n${sentence}\n`;
}

/**
 * `confine` (the Claude arm, `buildArmCall`; the Claude S4 probe with MCP, probe d): appends `--confine`, so the tools'
 * `spec` and `project` arguments stay on the configured spec and the run cwd (src/mcp-server/confine.ts). The Gemini
 * home files call this without it, unchanged until their own S4 round adopts it.
 */
export function daedalusMcpConfig(input: DaedalusServerInput, req: ArmRequest, opts: { readonly confine?: boolean } = {}): McpConfigFile {
  return {
    mcpServers: {
      [DAEDALUS_MCP_SERVER]: {
        type: 'stdio',
        command: input.nodeBinary,
        // v1.3 npx mode: the server's engine default follows NEO4J_URI; an experiment arm names the reference engine.
        args: [input.serverEntry, '--spec', input.specPath, '--project', req.outputDir, '--engine', 'neo4j', ...(opts.confine === true ? ['--confine'] : [])],
        env: {},
      },
    },
  };
}

export function checkDaedalusInput(input: DaedalusServerInput, req: ArmRequest): DomainError[] {
  const errors: DomainError[] = [];
  for (const [field, value] of [
    ['nodeBinary', input.nodeBinary],
    ['serverEntry', input.serverEntry],
    ['specPath', input.specPath],
  ] as const) {
    if (!path.isAbsolute(value)) errors.push(err('ARM_PATH_NOT_ABSOLUTE', `${field} must be an absolute path`));
    else if (isInsideOrEqual(req.outputDir, value)) {
      errors.push(err('ARM_PATH_INSIDE_CWD', `${field} must lie outside the run cwd (the agent may edit the cwd)`));
    }
  }
  return errors;
}

/**
 * The arm's argv: `buildGeneratorArgs` with the arm's MCP allow rules added to `--allowedTools` (after the Bash rule,
 * or as a new `--allowedTools` before `--disallowedTools` in the no-Bash variant), its denied tools appended to
 * `--disallowedTools`, and `--mcp-config <path>` after `--strict-mcp-config`.
 */
export function withMcpServer(
  base: readonly string[],
  configPath: string,
  allowRules: readonly string[],
  denyRules: readonly string[],
): readonly string[] {
  const args = [...base];
  const disallowedAt = args.indexOf('--disallowedTools');
  const allowedAt = args.indexOf('--allowedTools');
  // Deny rules go after the existing deny values, which run up to the next flag.
  let denyEnd = disallowedAt + 1;
  while (denyEnd < args.length && !(args[denyEnd] ?? '').startsWith('--')) denyEnd++;
  args.splice(denyEnd, 0, ...denyRules);
  if (allowedAt >= 0) args.splice(allowedAt + 2, 0, ...allowRules);
  else args.splice(disallowedAt, 0, '--allowedTools', ...allowRules);
  const strictAt = args.indexOf('--strict-mcp-config');
  args.splice(strictAt + 1, 0, '--mcp-config', configPath);
  return Object.freeze(args);
}

export function buildArmCall(
  config: GeneratorCliConfig,
  req: ArmRequest,
  basePrompt: string,
  input: ArmInput,
): DomainResult<ArmCall> {
  const prompt = armPrompt(basePrompt, input.arm);
  const base = buildGeneratorArgs(config, req, prompt);
  if (input.arm === 'none') {
    return DomainResult.ok({ arm: 'none', args: base, mcpConfigPath: null, mcpConfig: null, prompt });
  }
  const configPath = armMcpConfigPath(config.harnessRoot, req.runId, input.arm);

  if (input.arm === 'daedalus-mcp') {
    if (input.daedalus === undefined) {
      return DomainResult.fail([err('ARM_NOT_CONFIGURED', 'the daedalus-mcp arm needs nodeBinary, serverEntry and specPath')]);
    }
    const errors = checkDaedalusInput(input.daedalus, req);
    if (errors.length > 0) return DomainResult.fail(errors);
    const args = withMcpServer(
      base,
      configPath,
      mcpToolRules(DAEDALUS_MCP_SERVER, DAEDALUS_ARM_TOOLS),
      mcpToolRules(DAEDALUS_MCP_SERVER, DAEDALUS_DENIED_TOOLS),
    );
    const checked = checkArmArgs(args, DAEDALUS_MCP_SERVER);
    if (!checked.success) return DomainResult.fail(checked.errors);
    return DomainResult.ok({
      arm: input.arm,
      args,
      mcpConfigPath: configPath,
      mcpConfig: daedalusMcpConfig(input.daedalus, req, { confine: true }),
      prompt,
    });
  }

  const provider = input.contextGraph;
  if (provider === undefined) {
    return DomainResult.fail([
      err('ARM_NOT_CONFIGURED', 'the context-graph arm is a placeholder: plug in a ContextGraphProvider (see CONTEXT_GRAPH_PLACEHOLDER)'),
    ]);
  }
  if (!SERVER_NAME_RE.test(provider.serverName) || provider.serverName === DAEDALUS_MCP_SERVER) {
    return DomainResult.fail([err('ARM_SERVER_NAME_INVALID', 'serverName must match [A-Za-z0-9_-]+ and differ from daedalus-arch')]);
  }
  if (provider.tools.length === 0 || ![...provider.tools, ...provider.deniedTools].every((t) => TOOL_NAME_RE.test(t))) {
    return DomainResult.fail([err('ARM_TOOLS_INVALID', 'tools must be a non-empty list of exact tool names (no wildcard)')]);
  }
  const args = withMcpServer(
    base,
    configPath,
    mcpToolRules(provider.serverName, provider.tools),
    mcpToolRules(provider.serverName, provider.deniedTools),
  );
  const checked = checkArmArgs(args, provider.serverName);
  if (!checked.success) return DomainResult.fail(checked.errors);
  return DomainResult.ok({
    arm: input.arm,
    args,
    mcpConfigPath: configPath,
    mcpConfig: { mcpServers: { [provider.serverName]: provider.server(req) } },
    prompt,
  });
}

/**
 * Invariants of an arm argv: no forbidden flag (BR-U5a-41), `--strict-mcp-config` present, at most one
 * `--mcp-config`, and every `mcp__` rule exact and naming `server` only.
 */
export function checkArmArgs(args: readonly string[], server: string | null): DomainResult<void> {
  const errors: DomainError[] = [];
  for (const flag of FORBIDDEN_GENERATOR_FLAGS) {
    if (args.includes(flag)) errors.push(err('ARM_FORBIDDEN_FLAG', `${flag} must not be emitted`));
  }
  if (!args.includes('--strict-mcp-config')) errors.push(err('ARM_NOT_STRICT', '--strict-mcp-config must be kept'));
  const configs = args.filter((a) => a === '--mcp-config').length;
  if (configs > (server === null ? 0 : 1)) errors.push(err('ARM_MCP_CONFIG_COUNT', 'an arm loads at most one MCP config'));
  for (const a of args.filter((x) => x.startsWith('mcp__'))) {
    const ok = server !== null && a.startsWith(`mcp__${server}__`) && TOOL_NAME_RE.test(a.slice(`mcp__${server}__`.length));
    if (!ok) errors.push(err('ARM_MCP_RULE_INVALID', `MCP rule ${a} is not an exact tool of ${server ?? 'no server'}`));
  }
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok(undefined);
}
