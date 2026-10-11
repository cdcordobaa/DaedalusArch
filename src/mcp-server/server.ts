/**
 * MCP server wiring: registers the five DaedalusArch tools on an `McpServer`. Transport-agnostic (`main.ts`
 * connects stdio; the tests connect an in-memory pair). Tools only read the spec and, for `evaluate_project`,
 * run the existing pipeline; none writes to the project under evaluation.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  checkImportTool,
  evaluateProjectTool,
  explainViolationTool,
  getArchitectureSpec,
  whichLayerTool,
} from './tools.js';
import type { ServerContext, ToolOutcome } from './tools.js';

export const SERVER_NAME = 'daedalus-arch';
export const SERVER_VERSION = '0.1.0';

/** Tool names in registration order. */
export const TOOL_NAMES: readonly string[] = Object.freeze([
  'get_architecture_spec',
  'which_layer',
  'check_import',
  'evaluate_project',
  'explain_violation',
]);

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
};
const explainShape = {
  rule: z.string().min(1).describe('Rule id, rule name or violation type.'),
  spec: specArg,
};

export function createServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const register = server.registerTool.bind(server) as unknown as RegisterTool;

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
        'Whether an import from file `from` of module `module` would violate a layer or purity rule, with rule id and reason. Spec-based and instant: no graph is built, so cycles and class-level rules are not covered (use evaluate_project). Path aliases cannot be resolved without tsconfig; pass resolvedPath for them.',
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
        'Runs the existing symbolic-only firewall pipeline on a project and returns the AHS, the verdict and the violations grouped by rule. Slow (extracts and ingests the whole project) and needs Neo4j via NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD; it replaces the graph in that database, so point it at a scratch instance. Fails with a clear message when Neo4j is unreachable.',
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

  return server;
}
