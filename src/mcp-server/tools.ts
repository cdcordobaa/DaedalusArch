/**
 * Tool handlers of the DaedalusArch MCP prototype. Each handler takes the server context and validated
 * arguments and returns a `ToolOutcome`: a typed record on success, a plain message on failure. No MCP types
 * here, so the handlers are unit-testable without a transport.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParsedSpec } from '../shared/types/spec.js';
import { parseSpec } from '../spec-parser/spec-parser.js';
import { checkImport } from './import-check.js';
import { evaluateProject } from './evaluate-project.js';
import type { EvaluateDeps } from './evaluate-project.js';
import { explainViolation } from './rule-explainer.js';
import { buildSpecView, whichLayer } from './spec-view.js';
import { checkSource } from './file-check.js';
import { checkDiff } from './diff-check.js';
import { suggestPlacement } from './placement.js';
import { normalisePath } from './layer-resolver.js';
import { defaultPresetsDir, proposeRules, summariseProposal } from '../rule-mining/index.js';
import type { ProposalSummary } from '../rule-mining/index.js';
import type {
  ArchitectureSpecView,
  CheckImportResult,
  DiffCheckResult,
  EvaluateProjectResult,
  FileCheckResult,
  PlacementResult,
  RuleExplanation,
  WhichLayerResult,
} from './types.js';

export type ToolOutcome<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly message: string };

export interface LoadedSpec {
  readonly spec: ParsedSpec;
  readonly specPath: string;
  readonly warnings: readonly string[];
}

export interface ServerContext {
  /** Default spec for tools called without `spec` (`--spec` or `DAEDALUS_SPEC`). */
  readonly defaultSpecPath?: string | undefined;
  /** Default project for `evaluate_project` and the root file paths are made relative to. */
  readonly defaultProjectPath?: string | undefined;
  readonly env: NodeJS.ProcessEnv;
  readonly evaluateDeps: EvaluateDeps;
  readonly loadSpec: (specPath: string) => Promise<ToolOutcome<LoadedSpec>>;
}

const ok = <T>(data: T): ToolOutcome<T> => ({ ok: true, data });
const fail = <T>(message: string): ToolOutcome<T> => ({ ok: false, message });

/** A spec loader that parses each file once per modification time (the spec is read-only during a session). */
export function createSpecLoader(): ServerContext['loadSpec'] {
  const cache = new Map<string, { readonly mtimeMs: number; readonly loaded: LoadedSpec }>();
  return async (specPath) => {
    const absolute = path.resolve(specPath);
    if (!fs.existsSync(absolute)) return fail(`Spec file not found: ${absolute}`);
    const mtimeMs = fs.statSync(absolute).mtimeMs;
    const cached = cache.get(absolute);
    if (cached?.mtimeMs === mtimeMs) return ok(cached.loaded);
    const parsed = await parseSpec({ specFilePath: absolute });
    if (!parsed.success)
      return fail(`Spec is invalid: ${parsed.errors.map((e) => e.message).join('; ')}`);
    const loaded: LoadedSpec = {
      spec: parsed.data,
      specPath: absolute,
      warnings: (parsed.warnings ?? []).map((w) => `${w.code}: ${w.message}`),
    };
    cache.set(absolute, { mtimeMs, loaded });
    return ok(loaded);
  };
}

async function specFor(
  ctx: ServerContext,
  spec: string | undefined,
): Promise<ToolOutcome<LoadedSpec>> {
  const specPath = spec ?? ctx.defaultSpecPath;
  if (specPath === undefined) {
    return fail(
      'No spec configured: pass `spec`, start the server with --spec <path>, or set DAEDALUS_SPEC.',
    );
  }
  return ctx.loadSpec(specPath);
}

/** A file path as the spec's globs see it: project-relative POSIX. Absolute paths are made relative to the project. */
export function toProjectRelative(ctx: ServerContext, filePath: string): string {
  const root = ctx.defaultProjectPath;
  if (root !== undefined && path.isAbsolute(filePath)) {
    return normalisePath(path.relative(path.resolve(root), filePath));
  }
  return normalisePath(filePath);
}

export async function getArchitectureSpec(
  ctx: ServerContext,
  args: { readonly spec?: string | undefined },
): Promise<ToolOutcome<ArchitectureSpecView>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return ok(buildSpecView(loaded.data.spec, loaded.data.specPath, loaded.data.warnings));
}

export async function whichLayerTool(
  ctx: ServerContext,
  args: { readonly path: string; readonly spec?: string | undefined },
): Promise<ToolOutcome<WhichLayerResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return ok(whichLayer(loaded.data.spec, toProjectRelative(ctx, args.path)));
}

export async function checkImportTool(
  ctx: ServerContext,
  args: {
    readonly from: string;
    readonly module: string;
    readonly resolvedPath?: string | undefined;
    readonly spec?: string | undefined;
  },
): Promise<ToolOutcome<CheckImportResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return ok(
    checkImport(loaded.data.spec, {
      fromFile: toProjectRelative(ctx, args.from),
      module: args.module,
      ...(args.resolvedPath !== undefined
        ? { resolvedPath: toProjectRelative(ctx, args.resolvedPath) }
        : {}),
    }),
  );
}

export async function explainViolationTool(
  ctx: ServerContext,
  args: { readonly rule: string; readonly spec?: string | undefined },
): Promise<ToolOutcome<RuleExplanation>> {
  // The spec only adds context; an unreadable default spec must not block the catalogue answer.
  const specPath = args.spec ?? ctx.defaultSpecPath;
  const loaded = specPath === undefined ? undefined : await ctx.loadSpec(specPath);
  if (args.spec !== undefined && loaded !== undefined && !loaded.ok) return loaded;
  const explanation = explainViolation(
    args.rule,
    loaded?.ok === true ? loaded.data.spec : undefined,
  );
  if (explanation === undefined) {
    return fail(
      `Unknown rule "${args.rule}". Use a rule id (FF-S01), a rule name (dependency-direction) or a violation type (LAYER_VIOLATION).`,
    );
  }
  return ok(explanation);
}

export async function evaluateProjectTool(
  ctx: ServerContext,
  args: { readonly project?: string | undefined; readonly spec?: string | undefined; readonly scoring?: 'v1.3' | 'v1.2e' | undefined },
): Promise<ToolOutcome<EvaluateProjectResult>> {
  const project = args.project ?? ctx.defaultProjectPath;
  if (project === undefined) {
    return fail('No project configured: pass `project` or start the server with --project <path>.');
  }
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  const result = await evaluateProject(
    { projectPath: project, specPath: loaded.data.specPath, ...(args.scoring !== undefined && { scoringMode: args.scoring }) },
    ctx.env,
    ctx.evaluateDeps,
  );
  if (!result.success) {
    const [first] = result.errors;
    return fail(`${first?.code ?? 'ERROR'}: ${first?.message ?? 'evaluation failed'}`);
  }
  return ok(result.data);
}

export async function checkFileTool(
  ctx: ServerContext,
  args: { readonly path: string; readonly content: string; readonly spec?: string | undefined },
): Promise<ToolOutcome<FileCheckResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return ok(
    checkSource(loaded.data.spec, {
      path: toProjectRelative(ctx, args.path),
      content: args.content,
    }),
  );
}

export async function checkDiffTool(
  ctx: ServerContext,
  args: { readonly diff: string; readonly spec?: string | undefined },
): Promise<ToolOutcome<DiffCheckResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  const result = checkDiff(loaded.data.spec, args.diff);
  if (result.files.length === 0 && result.skipped.length === 0) {
    return fail('No file found in the diff: pass unified diff text (git diff or diff -u output).');
  }
  return ok(result);
}

export async function suggestPlacementTool(
  ctx: ServerContext,
  args: {
    readonly purpose: string;
    readonly name?: string | undefined;
    readonly spec?: string | undefined;
  },
): Promise<ToolOutcome<PlacementResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return ok(suggestPlacement(loaded.data.spec, { purpose: args.purpose, name: args.name }));
}

/**
 * `propose_rules`: the implicit rules of a project that has no spec, mined from its graph (src/rule-mining). Every rule
 * is labelled a proposal. Reads the project through a snapshot (src/ and tsconfig.json); no Neo4j, no LLM, no writes.
 */
export async function proposeRulesTool(
  ctx: ServerContext,
  args: { readonly project?: string | undefined; readonly minConfidence?: number | undefined; readonly includeSpec?: boolean | undefined; readonly maxExceptions?: number | undefined },
): Promise<ToolOutcome<ProposalSummary>> {
  const project = args.project ?? ctx.defaultProjectPath;
  if (project === undefined) {
    return fail('No project configured: pass `project` or start the server with --project <path>.');
  }
  if (!fs.existsSync(path.join(path.resolve(project), 'src'))) return fail(`No src/ directory under ${path.resolve(project)}: rule mining reads src/ and tsconfig.json.`);
  try {
    const proposal = await proposeRules(path.resolve(project), { presetsDir: defaultPresetsDir(), ...(args.minConfidence !== undefined && { minConfidence: args.minConfidence }) });
    return ok(summariseProposal(proposal, { includeSpec: args.includeSpec ?? true, maxExceptions: args.maxExceptions ?? 20 }));
  } catch (e: unknown) {
    return fail(`Rule mining failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
