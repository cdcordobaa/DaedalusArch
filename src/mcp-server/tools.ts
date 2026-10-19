/**
 * Tool handlers of the DaedalusArch MCP prototype. Each handler takes the server context and validated
 * arguments and returns a `ToolOutcome`: a typed record on success, a plain message on failure. No MCP types
 * here, so the handlers are unit-testable without a transport.
 */
import { withPostSealRules } from '../fitness-compiler/post-seal-rules.js';
import type { SemanticFactsConfig } from './semantic-facts.js';
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
import { NO_ROOT_NOTE } from './interp-check.js';
import type { FastRulesEngine, InterpEvaluator } from './interp-check.js';
import { interpCheckDiff, interpCheckFile, interpCheckImport } from './interp-tools.js';
import type { InterpInput } from './interp-tools.js';
import { proposeWithBuiltinPresets } from '../ise/propose.js';
import type { SpecProposal } from '../ise/propose.js';
import type { NeuralService } from './neural-service.js';
import { explainAndFix, reviewUnit } from './neural-tools.js';
import type { ExplainAndFixArgs, ExplainAndFixResult, FixHintSource, ReviewUnitArgs, ReviewUnitResult } from './neural-tools.js';
import type { CallLogger } from './call-log.js';
import { defaultPresetsDir, proposeRules, summariseProposal } from '../rule-mining/index.js';
import type { ProposalSummary } from '../rule-mining/index.js';
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
  /** Default for the `hints` argument of check_file, check_diff and explain_violation (`--hints` or `DAEDALUS_HINTS=1`). */
  readonly hints?: boolean | undefined;
  readonly env: NodeJS.ProcessEnv;
  readonly evaluateDeps: EvaluateDeps;
  readonly loadSpec: (specPath: string) => Promise<ToolOutcome<LoadedSpec>>;
  /** ISE spec proposal for `propose_spec` (default: the tool's own presets). */
  readonly proposeSpec?: (projectDir: string) => Promise<SpecProposal>;
  /** The tool's canonical presets (`presets/`), read by `infer_spec`. */
  readonly presetsDir?: string | undefined;
  /**
   * `cypher-interp`: check_file, check_diff and check_import answer with the compiled rules on the project graph
   * (Docs/v1.3/mcp-interp-parity.md). Absent or `fast`: the fast path, unchanged.
   */
  readonly fastRulesEngine?: FastRulesEngine | undefined;
  /** The evaluator (and its state cache) the cypher-interp engine uses; required when that engine is selected. */
  readonly interp?: InterpEvaluator | undefined;
  /** The neural arm (`--neural`); absent means off: no neural tool is registered (v1.3, neural-arm-agent-tools.md). */
  readonly neural?: NeuralService | undefined;
  /** Deterministic fix hints for `explain_and_fix` (the fix-hints feature's `buildFixHint`, when the build has it). */
  readonly fixHints?: FixHintSource | undefined;
  /** Graph engine of `evaluate_project` and the template checks; absent = `neo4j` (the reference engine). */
  readonly graphEngine?: GraphEngine | undefined;
  /** Call log (`--call-log`, Docs/v1.3/mcp-call-log.md); absent means off: handlers are registered unwrapped. */
  readonly callLog?: CallLogger | undefined;
  /** Register the opt-in `propose_rules` tool (rule mining). Off by default. */
  readonly ruleMining?: boolean | undefined;
  /** v1.4 U9: register the read-only `semantic_facts` tool over this A2 directory. Off by default (absent). */
  readonly semanticFacts?: SemanticFactsConfig | undefined;
}

const ok = <T>(data: T): ToolOutcome<T> => ({ ok: true, data });
const fail = <T>(message: string): ToolOutcome<T> => ({ ok: false, message });

/**
 * A spec loader that parses each file once per modification time (the spec is read-only during a session).
 * `postSeal` (v1.4 U2, default true): apply the post-seal rules to the loaded spec; false keeps the sealed v1.3 rule
 * set (a replay of a recorded v1.3 session).
 */
export function createSpecLoader(opts: { readonly postSeal?: boolean } = {}): ServerContext['loadSpec'] {
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
      // v1.4 U2 (BR-U2-09): the MCP server serves the v1.3 rules, so its tools see the post-seal rules too.
      spec: opts.postSeal === false ? parsed.data : withPostSealRules(parsed.data),
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

/** The realpath of `p`; for a path that does not exist yet, the realpath of its nearest existing ancestor plus the rest. */
function realpathLoose(p: string): string {
  const rest: string[] = [];
  let cur = path.resolve(p);
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...rest.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

/**
 * A file path as the spec's globs see it: project-relative POSIX. An absolute path is made relative to the project
 * root with symlinks resolved on both sides (macOS /tmp -> /private/tmp). A path that leaves the root, or an absolute
 * path with no project configured, is refused: it would otherwise match no layer glob and pass every layer rule
 * (R05, post-merge review 2026-10-16).
 */
export function toProjectRelative(ctx: ServerContext, filePath: string): ToolOutcome<string> {
  const root = ctx.defaultProjectPath;
  let rel: string;
  if (path.isAbsolute(filePath)) {
    if (root === undefined) {
      return fail(`An absolute path (${filePath}) needs a project root: start the server with --project <path>, or pass a project-relative path.`);
    }
    rel = path.relative(realpathLoose(root), realpathLoose(filePath));
    if (path.isAbsolute(rel)) return fail(`The path ${filePath} is outside the project root ${root}.`);
  } else {
    rel = filePath;
  }
  const posix = path.posix.normalize(rel.replace(/\\/g, '/'));
  if (posix === '..' || posix.startsWith('../')) return fail(`The path ${filePath} is outside the project root${root !== undefined ? ` ${root}` : ''}.`);
  return ok(normalisePath(posix));
}

/** The interpreter input when the cypher-interp engine is on and a project root is configured; else undefined. */
function interpInput(ctx: ServerContext, loaded: LoadedSpec): InterpInput | undefined {
  if (ctx.fastRulesEngine !== 'cypher-interp' || ctx.interp === undefined || ctx.defaultProjectPath === undefined) return undefined;
  return { spec: loaded.spec, specPath: loaded.specPath, root: path.resolve(ctx.defaultProjectPath), evaluator: ctx.interp };
}

function interpFailedNote(e: unknown): string {
  return `fast-rules-engine cypher-interp failed (${e instanceof Error ? e.message : String(e)}); answered on the fast path`;
}

/** The interp answer, or the fast-path answer with the reason when the evaluation fails (never an exception). */
async function orFast<T extends { readonly notes: readonly string[] }>(fast: T, interp: () => Promise<T>): Promise<T> {
  try {
    return await interp();
  } catch (e) {
    return { ...fast, notes: [...fast.notes, interpFailedNote(e)] };
  }
}

/** The fast-path answer with the no-root note, when the cypher-interp engine is on but cannot run. */
function noRoot<T extends { readonly notes: readonly string[] }>(ctx: ServerContext, result: T): T {
  return ctx.fastRulesEngine === 'cypher-interp' ? { ...result, notes: [...result.notes, NO_ROOT_NOTE] } : result;
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
  const rel = toProjectRelative(ctx, args.path);
  if (!rel.ok) return rel;
  return ok(whichLayer(loaded.data.spec, rel.data));
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
  const from = toProjectRelative(ctx, args.from);
  if (!from.ok) return from;
  const resolved = args.resolvedPath !== undefined ? toProjectRelative(ctx, args.resolvedPath) : undefined;
  if (resolved !== undefined && !resolved.ok) return resolved;
  const res = checkImport(spec, {
    fromFile: from.data,
    module: args.module,
    ...(resolved !== undefined ? { resolvedPath: resolved.data } : {}),
  });
  // MCP v2: each hit with its v1.3 tier, construct and source; the blocking answer.
  const violations = res.violations.map((v) => {
    const meta = specRuleMeta(spec, { id: v.ruleId, name: v.ruleName });
    return { ...v, tier: meta.tier, construct: meta.construct, source: meta.source, edgeView: meta.edgeView };
  });
  const blocking = violations.some((v) => v.tier === 'blocking');
  const fast: CheckImportResult = { ...res, violations, blockingVerdict: blocking ? 'block' : res.verdict === 'unknown' ? 'unknown' : 'pass' };
  const interp = interpInput(ctx, loaded.data);
  if (interp === undefined) return ok(noRoot(ctx, fast));
  return ok(await orFast(fast, () => interpCheckImport(interp, fast, {
    from: from.data,
    module: args.module,
    ...(resolved !== undefined ? { resolvedPath: resolved.data } : {}),
  })));
}

export async function explainViolationTool(
  ctx: ServerContext,
  args: { readonly rule: string; readonly spec?: string | undefined; readonly hints?: boolean | undefined },
): Promise<ToolOutcome<RuleExplanation>> {
  // The spec only adds context; an unreadable default spec must not block the catalogue answer.
  const specPath = args.spec ?? ctx.defaultSpecPath;
  const loaded = specPath === undefined ? undefined : await ctx.loadSpec(specPath);
  if (args.spec !== undefined && loaded !== undefined && !loaded.ok) return loaded;
  const explanation = explainViolation(
    args.rule,
    loaded?.ok === true ? loaded.data.spec : undefined,
    { hints: args.hints ?? ctx.hints === true },
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
  args: {
    readonly path: string;
    readonly content: string;
    readonly spec?: string | undefined;
    readonly templates?: boolean | undefined;
    readonly hints?: boolean | undefined;
  },
): Promise<ToolOutcome<FileCheckResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  const relOutcome = toProjectRelative(ctx, args.path);
  if (!relOutcome.ok) return relOutcome;
  const rel = relOutcome.data;
  const hints = args.hints ?? ctx.hints === true;
  const fast = checkSource(loaded.data.spec, {
    path: rel,
    content: args.content,
    view: new ProjectView({ root: ctx.defaultProjectPath, overrides: new Map([[rel, args.content]]) }),
    ...(hints ? { hints } : {}),
  });
  const templates = args.templates === true
    ? await templateCheck({
      spec: loaded.data.spec,
      specPath: loaded.data.specPath,
      projectRoot: ctx.defaultProjectPath,
      before: new Map(),
      after: new Map([[rel, args.content]]),
      interp: interpOf(ctx),
    })
    : undefined;
  const withTemplates = (r: FileCheckResult): FileCheckResult => (templates === undefined ? r : { ...r, templates });
  const interp = interpInput(ctx, loaded.data);
  if (interp !== undefined) return ok(withTemplates(await orFast(fast, () => interpCheckFile(interp, rel, args.content))));
  return ok(withTemplates(noRoot(ctx, fast)));
}

/** The in-process evaluator when the server runs on cypher-interp (template checks never touch Neo4j). */
function interpOf(ctx: ServerContext): ServerContext['evaluateDeps']['interp'] {
  return ctx.graphEngine === 'cypher-interp' ? ctx.evaluateDeps.interp : undefined;
}

export async function checkDiffTool(
  ctx: ServerContext,
  args: { readonly diff: string; readonly spec?: string | undefined; readonly templates?: boolean | undefined; readonly hints?: boolean | undefined },
): Promise<ToolOutcome<DiffCheckResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  const hints = args.hints ?? ctx.hints === true;
  const result = checkDiff(loaded.data.spec, args.diff, { projectRoot: ctx.defaultProjectPath, ...(hints ? { hints } : {}) });
  if (result.files.length === 0 && result.skipped.length === 0) {
    return fail('No file found in the diff: pass unified diff text (git diff or diff -u output).');
  }
  let templates: DiffCheckResult['templates'];
  if (args.templates === true) {
    const { before, after, unreadable } = diffOverrides(args.diff, ctx.defaultProjectPath);
    const checked = await templateCheck({
      spec: loaded.data.spec,
      specPath: loaded.data.specPath,
      projectRoot: ctx.defaultProjectPath,
      before,
      after,
      interp: interpOf(ctx),
    });
    const note = unreadable.length > 0 ? { reason: `not rebuilt from the diff, evaluated as on disk: ${unreadable.join(', ')}` } : {};
    templates = { ...checked, ...(checked.reason === undefined ? note : {}) };
  }
  const withTemplates = (r: DiffCheckResult): DiffCheckResult => (templates === undefined ? r : { ...r, templates });
  if (ctx.fastRulesEngine !== 'cypher-interp') return ok(withTemplates(result));
  const interp = interpInput(ctx, loaded.data);
  if (interp === undefined) return ok(withTemplates({ ...result, files: result.files.map((f) => noRoot(ctx, f)) }));
  try {
    return ok(withTemplates(await interpCheckDiff(interp, args.diff)));
  } catch (e) {
    const note = interpFailedNote(e);
    return ok(withTemplates({ ...result, files: result.files.map((f) => ({ ...f, notes: [...f.notes, note] })) }));
  }
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
 * `propose_spec`: the spec `firewall init` would write for a project without one (ISE), as data plus the commented
 * YAML. Reads only the project's src/ and tsconfig.json; writes nothing.
 */
export async function proposeSpecTool(
  ctx: ServerContext,
  args: { readonly project?: string | undefined },
): Promise<ToolOutcome<SpecProposal>> {
  const project = args.project ?? ctx.defaultProjectPath;
  if (project === undefined) {
    return fail('No project configured: pass `project` or start the server with --project <path>.');
  }
  const propose = ctx.proposeSpec ?? proposeWithBuiltinPresets;
  try {
    return ok(await propose(path.resolve(project)));
  } catch (e: unknown) {
    return fail(`Cannot infer a spec for ${project}: ${e instanceof Error ? e.message : String(e)}`);
  }
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
  const rel = file !== undefined ? toProjectRelative(ctx, file) : undefined;
  if (rel !== undefined && !rel.ok) return rel;
  const res = explainFinding(
    loaded?.ok === true ? loaded.data.spec : undefined,
    { rule: args.rule, ...(rel !== undefined ? { file: rel.data } : {}), ...(line !== undefined ? { line } : {}) },
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

/**
 * Project-relative path for the neural tools, which take a plain string and confine every read to the project root
 * themselves (`readProjectFile`, `sourceFilesUnder`): a path `toProjectRelative` refuses (R05/R06) falls back to the
 * normalised path as given, which those reads then reject.
 */
function neuralRelative(ctx: ServerContext, p: string): string {
  const rel = toProjectRelative(ctx, p);
  return rel.ok ? rel.data : normalisePath(path.posix.normalize(p.replace(/\\/g, '/')));
}

/** `review_unit` (neural arm): the judge on demand over one file or module unit; advisory, never blocking. */
export async function reviewUnitTool(
  ctx: ServerContext,
  args: ReviewUnitArgs & { readonly spec?: string | undefined },
): Promise<ToolOutcome<ReviewUnitResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return reviewUnit({ neural: ctx.neural, defaultProjectPath: ctx.defaultProjectPath, toProjectRelative: (p) => neuralRelative(ctx, p) }, loaded.data.spec, args);
}

/** `explain_and_fix` (neural arm): fix hint + judge explanation + code excerpt for one symbolic finding. */
export async function explainAndFixTool(
  ctx: ServerContext,
  args: ExplainAndFixArgs & { readonly spec?: string | undefined },
): Promise<ToolOutcome<ExplainAndFixResult>> {
  const loaded = await specFor(ctx, args.spec);
  if (!loaded.ok) return loaded;
  return explainAndFix(
    { neural: ctx.neural, fixHints: ctx.fixHints, defaultProjectPath: ctx.defaultProjectPath, toProjectRelative: (p) => neuralRelative(ctx, p) },
    loaded.data.spec,
    args,
  );
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
    const proposal = await proposeRules(path.resolve(project), { presetsDir: ctx.presetsDir ?? defaultPresetsDir(), ...(args.minConfidence !== undefined && { minConfidence: args.minConfidence }) });
    return ok(summariseProposal(proposal, { includeSpec: args.includeSpec ?? true, maxExceptions: args.maxExceptions ?? 20 }));
  } catch (e: unknown) {
    return fail(`Rule mining failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
