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
import { checkDiff, diffOverrides } from './diff-check.js';
import { templateCheck } from './template-check.js';
import type { GraphEngine } from '../cypher-interp/engine.js';
import { suggestPlacement } from './placement.js';
import { normalisePath } from './layer-resolver.js';
import { ProjectView } from './project-files.js';
import { explainFinding } from './explain-finding.js';
import { inferProjectSpec, isIseStyle } from './infer-spec.js';
import { specRuleMeta } from './rule-meta.js';
import type { NeuralService } from './neural-service.js';
import { explainAndFix, reviewUnit } from './neural-tools.js';
import type { ExplainAndFixArgs, ExplainAndFixResult, FixHintSource, ReviewUnitArgs, ReviewUnitResult } from './neural-tools.js';
import type {
  ArchitectureSpecView,
  CheckImportResult,
  DiffCheckResult,
  EvaluateProjectResult,
  FileCheckResult,
  FindingExplanation,
  InferSpecResult,
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
  /** The tool's canonical presets (`presets/`), read by `infer_spec`. */
  readonly presetsDir?: string | undefined;
  /** The neural arm (`--neural`); absent means off: no neural tool is registered (v1.3, neural-arm-agent-tools.md). */
  readonly neural?: NeuralService | undefined;
  /** Deterministic fix hints for `explain_and_fix` (the fix-hints feature's `buildFixHint`, when the build has it). */
  readonly fixHints?: FixHintSource | undefined;
  /** Graph engine of `evaluate_project` and the template checks; absent = `neo4j` (the reference engine). */
  readonly graphEngine?: GraphEngine | undefined;
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
  const spec = loaded.data.spec;
  const res = checkImport(spec, {
    fromFile: toProjectRelative(ctx, args.from),
    module: args.module,
    ...(args.resolvedPath !== undefined
      ? { resolvedPath: toProjectRelative(ctx, args.resolvedPath) }
      : {}),
  });
  // MCP v2: each hit with its v1.3 tier, construct and source; the blocking answer.
  const violations = res.violations.map((v) => {
    const meta = specRuleMeta(spec, { id: v.ruleId, name: v.ruleName });
    return { ...v, tier: meta.tier, construct: meta.construct, source: meta.source, edgeView: meta.edgeView };
  });
  const blocking = violations.some((v) => v.tier === 'blocking');
  return ok({ ...res, violations, blockingVerdict: blocking ? 'block' : res.verdict === 'unknown' ? 'unknown' : 'pass' });
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
  args: { readonly path: string; readonly content: string; readonly spec?: string | undefined; readonly templates?: boolean | undefined },
): Promise<ToolOutcome<FileCheckResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  const rel = toProjectRelative(ctx, args.path);
  const fast = checkSource(loaded.data.spec, {
    path: rel,
    content: args.content,
    view: new ProjectView({ root: ctx.defaultProjectPath, overrides: new Map([[rel, args.content]]) }),
  });
  if (args.templates !== true) return ok(fast);
  const templates = await templateCheck({
    spec: loaded.data.spec,
    specPath: loaded.data.specPath,
    projectRoot: ctx.defaultProjectPath,
    before: new Map(),
    after: new Map([[rel, args.content]]),
    interp: interpOf(ctx),
  });
  return ok({ ...fast, templates });
}

/** The in-process evaluator when the server runs on cypher-interp (template checks never touch Neo4j). */
function interpOf(ctx: ServerContext): ServerContext['evaluateDeps']['interp'] {
  return ctx.graphEngine === 'cypher-interp' ? ctx.evaluateDeps.interp : undefined;
}

export async function checkDiffTool(
  ctx: ServerContext,
  args: { readonly diff: string; readonly spec?: string | undefined; readonly templates?: boolean | undefined },
): Promise<ToolOutcome<DiffCheckResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  const result = checkDiff(loaded.data.spec, args.diff, { projectRoot: ctx.defaultProjectPath });
  if (result.files.length === 0 && result.skipped.length === 0) {
    return fail('No file found in the diff: pass unified diff text (git diff or diff -u output).');
  }
  if (args.templates !== true) return ok(result);
  const { before, after, unreadable } = diffOverrides(args.diff, ctx.defaultProjectPath);
  const templates = await templateCheck({
    spec: loaded.data.spec,
    specPath: loaded.data.specPath,
    projectRoot: ctx.defaultProjectPath,
    before,
    after,
    interp: interpOf(ctx),
  });
  const note = unreadable.length > 0 ? { reason: `not rebuilt from the diff, evaluated as on disk: ${unreadable.join(', ')}` } : {};
  return ok({ ...result, templates: { ...templates, ...(templates.reason === undefined ? note : {}) } });
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

export async function inferSpecTool(
  ctx: ServerContext,
  args: { readonly project?: string | undefined; readonly style?: string | undefined; readonly mode?: 'preset-first' | 'infer-only' | undefined },
): Promise<ToolOutcome<InferSpecResult>> {
  const project = args.project ?? ctx.defaultProjectPath;
  if (project === undefined) return fail('No project configured: pass `project` or start the server with --project <path>.');
  if (args.style !== undefined && !isIseStyle(args.style)) return fail(`Unknown style "${args.style}": use clean-architecture, layered, hexagonal, nestjs or ddd.`);
  if (ctx.presetsDir === undefined) return fail('No presets directory: set DAEDALUS_PRESETS to the presets/ directory of DaedalusArch.');
  const res = await inferProjectSpec({
    projectPath: path.isAbsolute(project) || ctx.defaultProjectPath === undefined ? project : path.resolve(ctx.defaultProjectPath, project),
    presetsDir: ctx.presetsDir,
    ...(args.style !== undefined && isIseStyle(args.style) ? { style: args.style } : {}),
    ...(args.mode !== undefined ? { mode: args.mode } : {}),
  });
  return res.ok ? ok(res.data) : fail(res.message);
}

export async function explainFindingTool(
  ctx: ServerContext,
  args: { readonly rule: string; readonly location?: string | undefined; readonly file?: string | undefined; readonly line?: number | undefined; readonly spec?: string | undefined },
): Promise<ToolOutcome<FindingExplanation>> {
  const specPath = args.spec ?? ctx.defaultSpecPath;
  const loaded = specPath === undefined ? undefined : await ctx.loadSpec(specPath);
  if (args.spec !== undefined && loaded !== undefined && !loaded.ok) return loaded;
  const parsed = args.location !== undefined ? parseLocationArg(args.location) : undefined;
  const file = args.file ?? parsed?.file;
  const line = args.line ?? parsed?.line;
  const res = explainFinding(
    loaded?.ok === true ? loaded.data.spec : undefined,
    { rule: args.rule, ...(file !== undefined ? { file: toProjectRelative(ctx, file) } : {}), ...(line !== undefined ? { line } : {}) },
    new ProjectView({ root: ctx.defaultProjectPath }),
  );
  if (res === undefined) {
    return fail(
      `Unknown rule "${args.rule}". Use a rule id (FF-S01), a template name (context-isolation), a violation type (LAYER_VIOLATION) or a hint id (APG2.boundary-type-leak, CHEAP.repository-bypass).`,
    );
  }
  return ok(res);
}

function parseLocationArg(location: string): { file: string; line?: number } {
  const m = /^(.*?):(\d+)(?::\d+)?$/.exec(location.trim());
  return m === null ? { file: location.trim() } : { file: m[1] ?? location, line: Number(m[2]) };
}

/** `review_unit` (neural arm): the judge on demand over one file or module unit; advisory, never blocking. */
export async function reviewUnitTool(
  ctx: ServerContext,
  args: ReviewUnitArgs & { readonly spec?: string | undefined },
): Promise<ToolOutcome<ReviewUnitResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return reviewUnit({ neural: ctx.neural, defaultProjectPath: ctx.defaultProjectPath, toProjectRelative: (p) => toProjectRelative(ctx, p) }, loaded.data.spec, args);
}

/** `explain_and_fix` (neural arm): fix hint + judge explanation + code excerpt for one symbolic finding. */
export async function explainAndFixTool(
  ctx: ServerContext,
  args: ExplainAndFixArgs & { readonly spec?: string | undefined },
): Promise<ToolOutcome<ExplainAndFixResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return explainAndFix(
    { neural: ctx.neural, fixHints: ctx.fixHints, defaultProjectPath: ctx.defaultProjectPath, toProjectRelative: (p) => toProjectRelative(ctx, p) },
    loaded.data.spec,
    args,
  );
}
