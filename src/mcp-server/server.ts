/**
 * MCP server wiring: registers the ten DaedalusArch tools (MCP v2: the eight v1 tools with v1.3 fields added, plus
 * `infer_spec` and `explain_finding`) on an `McpServer`, plus the two neural-arm tools (`review_unit`,
 * `explain_and_fix`) when the server runs with `--neural` (Docs/v1.3/neural-arm-agent-tools.md). Transport-agnostic (`main.ts`
 * connects stdio; the tests connect an in-memory pair). Tools only read the spec and, for `evaluate_project`,
 * run the existing pipeline; none writes to the project under evaluation.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  checkDiffTool,
  checkFileTool,
  checkImportTool,
  evaluateProjectTool,
  explainAndFixTool,
  explainFindingTool,
  explainViolationTool,
  getArchitectureSpec,
  inferSpecTool,
  reviewUnitTool,
  suggestPlacementTool,
  whichLayerTool,
} from './tools.js';
import { REVIEW_JUDGE_VERSIONS } from './neural-review.js';
import type { ServerContext, ToolOutcome } from './tools.js';

export const SERVER_NAME = 'daedalus-arch';
export const SERVER_VERSION = '0.2.0';

/** Tool names in registration order. */
export const TOOL_NAMES: readonly string[] = Object.freeze([
  'get_architecture_spec',
  'which_layer',
  'check_import',
  'evaluate_project',
  'explain_violation',
  'check_file',
  'check_diff',
  'suggest_placement',
  'infer_spec',
  'explain_finding',
]);

/** Tools that read only the spec: instant, no graph, no database (the set an experiment arm may allow-list). */
export const SPEC_TOOL_NAMES: readonly string[] = Object.freeze(
  TOOL_NAMES.filter((n) => n !== 'evaluate_project'),
);

/**
 * Neural-arm tools (v1.3, Docs/v1.3/neural-arm-agent-tools.md), registered after `TOOL_NAMES` only when the server
 * runs with `--neural`. They call an LLM, so they are never spec tools and no experiment arm allow-lists them.
 */
export const NEURAL_TOOL_NAMES: readonly string[] = Object.freeze(['review_unit', 'explain_and_fix']);

/** Sentence added to the symbolic tools' descriptions when the neural arm is on (absent otherwise: byte-identical). */
export const NEURAL_FOLLOW_UP =
  ' When the result has no blocking finding, call review_unit on the files you changed for the semantic risks rules cannot see; call explain_and_fix on a blocking finding whose fix is unclear.';

const specArg = z
  .string()
  .optional()
  .describe("Path to the firewall spec YAML; defaults to the server's configured spec.");

function toResult<T extends object>(outcome: ToolOutcome<T>): CallToolResult {
  if (!outcome.ok) return { isError: true, content: [{ type: 'text', text: outcome.message }] };
  return {
    content: [{ type: 'text', text: JSON.stringify(outcome.data, null, 2) }],
    structuredContent: Object.fromEntries(Object.entries(outcome.data)),
  };
}

/**
 * `registerTool` as this file uses it. The SDK's own generic signature recurses too deeply under the CommonJS
 * module resolution of the U0 test typecheck (TS2589), so registration goes through this narrow type and each
 * handler parses its arguments with the same zod object the SDK validates against.
 */
type RegisterTool = (
  name: string,
  config: {
    readonly title: string;
    readonly description: string;
    readonly inputSchema: z.ZodRawShape;
    readonly annotations: ToolAnnotations;
  },
  handler: (args: unknown) => Promise<CallToolResult>,
) => unknown;

const readOnly: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const getSpecShape = { spec: specArg };
const whichLayerShape = {
  path: z.string().min(1).describe('File path, relative to the project root.'),
  spec: specArg,
};
const checkImportShape = {
  from: z.string().min(1).describe('Importing file, relative to the project root.'),
  module: z
    .string()
    .min(1)
    .describe('The import specifier as written, e.g. "../domain/Task" or "typeorm".'),
  resolvedPath: z
    .string()
    .optional()
    .describe('Project-relative path the specifier resolves to, for alias imports.'),
  spec: specArg,
};
const evaluateShape = {
  project: z
    .string()
    .optional()
    .describe("Project root; defaults to the server's configured project."),
  spec: specArg,
  scoring: z
    .enum(['v1.3', 'v1.2e'])
    .optional()
    .describe('Scoring mode: v1.3 (default; the verdict comes from the blocking rules, advisory findings reported apart) or v1.2e (the registered Study 1 scoring).'),
};
const checkFileShape = {
  path: z
    .string()
    .min(1)
    .describe('Path of the file, relative to the project root (decides its layer).'),
  content: z.string().describe('The full proposed content of the file.'),
  spec: specArg,
};
const checkDiffShape = {
  diff: z.string().min(1).describe('A unified diff (git diff or diff -u output).'),
  spec: specArg,
};
const placementShape = {
  purpose: z
    .string()
    .min(1)
    .describe('What the new class or module is for, e.g. "repository for orders".'),
  name: z
    .string()
    .optional()
    .describe('Base name to use, e.g. "Order"; derived from the purpose when omitted.'),
  spec: specArg,
};
const explainShape = {
  rule: z.string().min(1).describe('Rule id, rule name or violation type.'),
  spec: specArg,
};
const inferShape = {
  project: z
    .string()
    .optional()
    .describe("Project root (with src/ and tsconfig.json); defaults to the server's configured project."),
  style: z
    .enum(['clean-architecture', 'layered', 'hexagonal', 'nestjs', 'ddd'])
    .optional()
    .describe('Force a style instead of classifying it.'),
  mode: z
    .enum(['preset-first', 'infer-only'])
    .optional()
    .describe('Layer mapping: preset globs first (default), or inferred from the code only.'),
};
const explainFindingShape = {
  rule: z
    .string()
    .min(1)
    .describe('The finding\'s ruleId (FF-S01, FF-DS02, APG2.boundary-type-leak, CHEAP.repository-bypass), a template name or a violation type.'),
  location: z.string().optional().describe('Where it was reported, as "file:line" (project-relative).'),
  file: z.string().optional().describe('Project-relative file (instead of location).'),
  line: z.number().int().positive().optional().describe('1-based line (instead of location).'),
  spec: specArg,
};

const waitShape = {
  wait: z.boolean().optional().describe('Wait for the judge up to waitMs (default true). false: start the job and return `pending` with a jobId at once.'),
  waitMs: z.number().int().min(0).max(120_000).optional().describe("Latency budget of this call in ms (default: the server's, 20000); past it the answer is `pending` with a jobId."),
  jobId: z.string().min(1).optional().describe('Poll a job an earlier call returned as `pending`.'),
};
const reviewUnitShape = {
  path: z.string().min(1).optional().describe('A file (judged for FF-N02, intent alignment) or a directory (its source files judged as one module for FF-N01, integrity); project-relative.'),
  paths: z.array(z.string().min(1)).max(12).optional().describe('The files of one module unit (FF-N01), project-relative.'),
  content: z.string().optional().describe('Proposed content of the single `path`, reviewed before it is written.'),
  judgeVersion: z.enum(REVIEW_JUDGE_VERSIONS as unknown as [string, ...string[]]).optional().describe('v1 (default: the frozen judge), v2 (opt-in: framework, transport and persistence leaks named per layer kind) or v2.2 (only when the build carries it).'),
  function: z.enum(['FF-N01', 'FF-N02']).optional().describe('Override the rubric: FF-N02 for one file, FF-N01 for a module (the default follows the unit).'),
  ...waitShape,
  spec: specArg,
};
const findingShape = z
  .object({
    ruleId: z.string().optional(),
    rule: z.string().optional(),
    ruleName: z.string().optional(),
    file: z.string().optional(),
    filePath: z.string().optional(),
    line: z.number().int().positive().optional(),
    message: z.string().optional(),
    reason: z.string().optional(),
    subject: z.string().optional(),
    target: z.string().optional(),
    severity: z.string().optional(),
    tier: z.string().optional(),
    fix: z.string().optional(),
    hint: z.unknown().optional(),
  })
  .passthrough()
  .describe('The finding as a symbolic tool reported it (a check_file / check_diff violation, or an evaluate_project row): ruleId or rule, file or filePath, and line, reason or message, target when present.');
const explainAndFixShape = {
  finding: findingShape,
  content: z.string().optional().describe("The file's proposed content, when it is not on disk yet."),
  ...waitShape,
  spec: specArg,
};

export function createServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const register = server.registerTool.bind(server) as unknown as RegisterTool;
  const followUp = ctx.neural !== undefined ? NEURAL_FOLLOW_UP : '';

  register(
    'get_architecture_spec',
    {
      title: 'Get architecture spec',
      description:
        'The firewall spec as structured data: layers (inner to outer) with their globs, which layers each may and may not import, the forbidden packages for the domain, and every rule with its status (active, disabled, not-applicable) and description. Call this before writing code to learn the architecture constraints.',
      inputSchema: getSpecShape,
      annotations: readOnly,
    },
    async (args) => toResult(await getArchitectureSpec(ctx, z.object(getSpecShape).parse(args))),
  );

  register(
    'which_layer',
    {
      title: 'Which layer is this file in',
      description:
        'The architectural layer of a file path (project-relative or absolute), plus the layers a file there may and may not import and the packages it may not import. Use it to decide where new code belongs.',
      inputSchema: whichLayerShape,
      annotations: readOnly,
    },
    async (args) => toResult(await whichLayerTool(ctx, z.object(whichLayerShape).parse(args))),
  );

  register(
    'check_import',
    {
      title: 'Check an import against the architecture rules',
      description:
        'Whether an import from file `from` of module `module` would violate a layer or purity rule, with rule id, v1.3 tier (blocking/advisory), construct, literature source and reason; blockingVerdict is the answer to act on. Spec-based and instant: no graph is built, so cycles and class-level rules are not covered (use check_file, check_diff or evaluate_project). Path aliases cannot be resolved without tsconfig; pass resolvedPath for them.',
      inputSchema: checkImportShape,
      annotations: readOnly,
    },
    async (args) => toResult(await checkImportTool(ctx, z.object(checkImportShape).parse(args))),
  );

  register(
    'evaluate_project',
    {
      title: 'Evaluate a project (symbolic-only)',
      description:
        'Runs the existing symbolic-only firewall pipeline on a project and returns the AHS, the verdict and the violations grouped by rule. Slow (extracts and ingests the whole project) and needs Neo4j via NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD; it replaces the graph in that database, so point it at a scratch instance. Fails with a clear message when Neo4j is unreachable.' + followUp,
      inputSchema: evaluateShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => toResult(await evaluateProjectTool(ctx, z.object(evaluateShape).parse(args))),
  );

  register(
    'explain_violation',
    {
      title: 'Explain a rule',
      description:
        "A rule's intent and fix guidance, from the rule template and the violation catalogue. Accepts a rule id (FF-S01), a rule name (dependency-direction) or a violation type (LAYER_VIOLATION).",
      inputSchema: explainShape,
      annotations: readOnly,
    },
    async (args) => toResult(await explainViolationTool(ctx, z.object(explainShape).parse(args))),
  );

  register(
    'check_file',
    {
      title: 'Check a proposed file against the architecture rules',
      description:
        'Checks one file before you write it against the v1.3 rules the spec makes active: layer direction and skipping (also over allowed_dependencies for hexagonal/ddd), core isolation, domain purity (through barrels), repository/port placement, constructor-injected infrastructure in the domain, DDD context isolation, aggregate boundary, value-object immutability, naming, and (with a project root) import cycles. Act on blockingVerdict: "block" means a blocking-tier violation. Each violation carries ruleId, tier (blocking/advisory), construct, literature source, file:line, reason and a concrete fix; hints (APG v2 and cheap proxies) are advisory. notChecked lists rules only evaluate_project decides. Fast (no graph database).' + followUp,
      inputSchema: checkFileShape,
      annotations: readOnly,
    },
    async (args) => toResult(await checkFileTool(ctx, z.object(checkFileShape).parse(args))),
  );

  register(
    'check_diff',
    {
      title: 'Check a unified diff against the architecture rules',
      description:
        'The check_file rules over a unified diff (git diff or diff -u). New files are checked whole; with a project root a modified file is rebuilt from the diff and the project and only what the change introduces is reported (else its added lines are checked). Act on blockingVerdict: "block" means a blocking-tier violation; each violation has ruleId, tier, construct, source, file:line, reason and fix; hints are advisory. Fast (no graph database).' + followUp,
      inputSchema: checkDiffShape,
      annotations: readOnly,
    },
    async (args) => toResult(await checkDiffTool(ctx, z.object(checkDiffShape).parse(args))),
  );

  register(
    'suggest_placement',
    {
      title: 'Suggest where new code belongs',
      description:
        'Given what a new class or module is for (e.g. "repository for orders", "use case to cancel an order"), returns the layer, a path that the spec maps to that layer, a class name that passes the naming rules, and what that file may import. A repository returns two placements: the interface and its implementation.',
      inputSchema: placementShape,
      annotations: readOnly,
    },
    async (args) => toResult(await suggestPlacementTool(ctx, z.object(placementShape).parse(args))),
  );

  register(
    'infer_spec',
    {
      title: 'Infer a firewall spec for a project (proposal)',
      description:
        'Zero-config onboarding: classifies the architectural style of the project (src/ and tsconfig.json), maps its folders to the style\'s layers and returns a PROPOSED spec YAML with the confidence, the evidence, the per-folder mapping and the spec validator\'s verdict. Nothing is written: review the proposal (the human or you must confirm it) and save it before using it as the spec. Takes seconds (it extracts the project).',
      inputSchema: inferShape,
      annotations: readOnly,
    },
    async (args) => toResult(await inferSpecTool(ctx, z.object(inferShape).parse(args))),
  );

  register(
    'explain_finding',
    {
      title: 'Explain a finding',
      description:
        'Given a finding\'s ruleId (and optionally its file:line), returns the construct, the literature source, the tier, a minimal violating and compliant example, and how the firewall checks it (the full evaluation\'s template and edge view, and what check_file/check_diff read). Use it when a blocking answer is unclear.',
      inputSchema: explainFindingShape,
      annotations: readOnly,
    },
    async (args) => toResult(await explainFindingTool(ctx, z.object(explainFindingShape).parse(args))),
  );

  if (ctx.neural !== undefined) registerNeuralTools(register, ctx);

  return server;
}

const neuralAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  // The judge is an external model (Claude CLI, agy, Gemini API).
  openWorldHint: true,
};

/** The neural-arm tools; their descriptions say WHEN an agent should call them (after a clean symbolic pass). */
function registerNeuralTools(register: RegisterTool, ctx: ServerContext): void {
  register(
    'review_unit',
    {
      title: 'Review a unit with the architecture judge (neural, advisory)',
      description:
        'Runs the LLM architecture judge on demand over one file (FF-N02: does every responsibility, signature and annotation belong to its layer?) or one module: a directory or a list of files (FF-N01: one concern, each business rule in one place, no bypass of the module\'s own abstractions). '
        + 'WHEN: after check_file or check_diff is clean on code you wrote or changed, to catch what the symbolic rules cannot see: business logic in a controller or an infrastructure adapter, the same business rule or validation written twice, framework, transport or ORM types leaking into domain or application signatures, persistence reached around the repository. Not for what check_file already reports. '
        + 'Advisory and never blocking: status pass, fail, inconclusive (invalid or ungrounded answer: do not act on it alone), error, pending or not-configured; a fail carries violations and citations checked against the shown code (file, lines, excerpt). '
        + 'Cached by content hash and judge version, so an unchanged unit is answered at once. A cache miss is slow (20-90 s with the Claude judge): the call answers within waitMs (default 20 s) or returns pending with a jobId; keep working and call again with {jobId}. judgeVersion: v1 (frozen, default) or v2.',
      inputSchema: reviewUnitShape,
      annotations: neuralAnnotations,
    },
    async (args) => toResult(await reviewUnitTool(ctx, z.object(reviewUnitShape).parse(args) as Parameters<typeof reviewUnitTool>[1])),
  );

  register(
    'explain_and_fix',
    {
      title: 'Explain a finding and how to fix it (neural, advisory)',
      description:
        'Turns one symbolic finding (a violation from check_file, check_diff or evaluate_project) into one actionable message: the deterministic fix hint when the build has one (else the finding\'s own fix), the judge\'s explanation of why this code breaks the rule (kept only when every line it cites exists in the shown code), and the numbered code excerpt around the finding. '
        + 'WHEN: a blocking finding whose fix is not obvious from its fix field, or code you did not write. '
        + 'status: explained (the judge confirms), disputed (the judge thinks the rule misfired here; the finding still stands), unexplained (no judge answer: hint and excerpt only) or pending (call again with {jobId}). Never changes a verdict; same latency and caching as review_unit.',
      inputSchema: explainAndFixShape,
      annotations: neuralAnnotations,
    },
    async (args) => toResult(await explainAndFixTool(ctx, z.object(explainAndFixShape).parse(args) as Parameters<typeof explainAndFixTool>[1])),
  );
}
