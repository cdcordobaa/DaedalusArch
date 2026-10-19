/**
 * Post-seal rules (v1.4 U2; `Docs/v1.4/adr-v14.md`, `Docs/v1.4/rule-tiers-post-seal.md`): the rules added to the
 * v1.3 rule sets after the seal, each a declared deviation with its own ADR. This table is the single source: nothing
 * else in the code names these rules by hand (design BR-U2-01).
 *
 * - FF-S02 `no-cyclic-deps` joins the DDD rule set (decision D5, N17). Membership only: the frozen template text and
 *   the sealed FF-S02 tier row are unchanged.
 * - FF-P07 `application-purity` (decision N3, construct question Q26): the delivery mechanism (the HTTP framework) is
 *   a detail, so no application-layer file depends on it. A new template in `POST_SEAL_TEMPLATES`; the frozen
 *   `CYPHER_TEMPLATES` is not touched.
 *
 * The rules are added at compile time by a spec overlay (`applyPostSealRules`), only when
 * `CompileOptions.postSealRules` is true (the v1.3 scoring mode). The presets are not edited (they are hashed in
 * `Docs/v1.3/sealed-hashes.md`). Cypher stays the only rule definition: neither rule has a TypeScript mirror.
 */
import type { CypherTemplate, CompilerInput, CompilerWarning, ResultMapping } from './types.js';
import type { FitnessFunction, ParsedSpec } from '../shared/types/spec.js';
import type { Dimension, Severity } from '../shared/types/enums.js';
import { functionId } from '../shared/types/value-objects.js';

export interface PostSealRule {
  readonly ruleId: 'FF-S02' | 'FF-P07';
  readonly name: 'no-cyclic-deps' | 'application-purity';
  readonly dimension: Dimension;
  readonly severity: Severity;
  /** Lower-cased `architecture.style` values the rule is added to. */
  readonly styles: readonly string[];
  readonly decision: 'D5' | 'N3';
  readonly adr: 'ADR-V14-01' | 'ADR-V14-02';
  /** FF-P07: the default forbidden list (a spec that declares FF-P07 keeps its own). */
  readonly forbiddenImports?: readonly string[];
}

/** FF-P07 default forbidden list: HTTP delivery-mechanism packages only (author question Q-B, design BR-U2-05). */
export const HTTP_DELIVERY_PACKAGES: readonly string[] = Object.freeze([
  'express', 'fastify', 'koa', '@koa/*', '@hapi/*', 'restify', '@nestjs/platform-express', '@nestjs/platform-fastify',
]);

export const APPLICATION_PURITY = 'application-purity';

export const POST_SEAL_RULES: readonly PostSealRule[] = Object.freeze([
  Object.freeze({
    ruleId: 'FF-S02', name: 'no-cyclic-deps', dimension: 'structural', severity: 'critical', styles: Object.freeze(['ddd']),
    decision: 'D5', adr: 'ADR-V14-01',
  }),
  Object.freeze({
    ruleId: 'FF-P07', name: APPLICATION_PURITY, dimension: 'pattern', severity: 'critical',
    styles: Object.freeze(['clean-architecture', 'hexagonal', 'nestjs', 'ddd']),
    decision: 'N3', adr: 'ADR-V14-02', forbiddenImports: HTTP_DELIVERY_PACKAGES,
  }),
] as const satisfies readonly PostSealRule[]);

/** The same T-MAP edge columns as `domain-purity` (`cypher-templates.ts` `DEP_EDGE`, `FR12_DEP_COLUMNS`; values copied, the frozen file untouched). */
const APPLICATION_PURITY_MAPPING: ResultMapping = {
  filePathColumn: 'source',
  messageTemplate: 'Application file {source} ({layer}) {verb} delivery-framework package {target}',
  targetColumn: 'target', lineColumn: 'line', linesColumn: 'lines', isTypeOnlyColumn: 'isTypeOnly',
  discriminatorColumns: ['relType'],
  metadataColumns: ['target', 'relType', 'line', 'lines', 'isTypeOnly'],
};

/**
 * FF-P07: the `domain-purity` pattern read over the application layers, minus composition roots (by layer role and
 * by file name) and test files. The only OR sits inside `ANY(…)`, so the predicate is a top-level conjunction
 * (BR-U1-44). Type-only imports count (D3).
 */
export const APPLICATION_PURITY_TEMPLATE: CypherTemplate = Object.freeze({
  functionName: APPLICATION_PURITY,
  template: `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(p:Package)
WHERE src.layer IN $applicationLayers
  AND NOT src.layer IN $compositionRootLayers
  AND NONE(sp IN $compositionRootPatterns WHERE src.filePath =~ sp)
  AND NONE(sp IN $testPatterns WHERE src.filePath =~ sp)
  AND ANY(fp IN $forbiddenImports WHERE p.name = fp OR (fp ENDS WITH '/*' AND p.name STARTS WITH left(fp, size(fp) - 1))) /*EXCLUDE:src*/
RETURN src.filePath AS source, p.name AS target, src.layer AS layer, type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`,
  requiredParams: Object.freeze(['applicationLayers', 'forbiddenImports', 'compositionRootLayers', 'compositionRootPatterns', 'testPatterns']),
  optionalParams: Object.freeze([]),
  description: 'Application files (not composition roots, not tests) importing or re-exporting an HTTP delivery-framework package (post-seal, ADR-V14-02)',
  resultMapping: APPLICATION_PURITY_MAPPING,
  tag: 'pattern-proxy',
  requiredLayerKinds: Object.freeze(['application']),
  applicableStyles: Object.freeze(['clean-architecture', 'hexagonal', 'nestjs', 'ddd']),
}) as CypherTemplate;

/** The post-seal template catalogue (`application-purity` only; FF-S02 uses the frozen `no-cyclic-deps`). */
export const POST_SEAL_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([[APPLICATION_PURITY, APPLICATION_PURITY_TEMPLATE]]);

/** The entries that apply to a style (lower-cased); [] for a spec without a style. */
export function postSealRulesFor(style: string | undefined): readonly PostSealRule[] {
  if (style === undefined) return [];
  const s = style.toLowerCase();
  return POST_SEAL_RULES.filter((r) => r.styles.includes(s));
}

/** One post-seal entry as a built-in function. */
export function postSealFunction(rule: PostSealRule): FitnessFunction {
  return {
    id: functionId(rule.ruleId), name: rule.name, dimension: rule.dimension, severity: rule.severity, route: 'symbolic',
    isBuiltIn: true, validated: false, enabled: true, excludePaths: [],
    ...(rule.forbiddenImports !== undefined ? { forbiddenImports: [...rule.forbiddenImports] } : {}),
  };
}

export interface PostSealOverlay<T> {
  /** The input with the added functions; the same object when nothing was added. */
  readonly value: T;
  /** Ids the overlay added, in table order (compile facts `postSealAdded`). */
  readonly added: readonly string[];
  /** One warning per entry not added because the spec declares its template under another id (BR-U2-03.6). */
  readonly warnings: readonly CompilerWarning[];
}

/** Design BR-U2-03 over a function list and a style. */
function overlayFunctions(functions: readonly FitnessFunction[], style: string | undefined): { functions: readonly FitnessFunction[]; added: string[]; warnings: CompilerWarning[] } {
  const added: string[] = [];
  const warnings: CompilerWarning[] = [];
  let out: FitnessFunction[] | undefined;
  for (const rule of postSealRulesFor(style)) {
    const current = out ?? functions;
    // 2. The spec declares the id: the spec wins (it may narrow FF-P07's list or disable the rule).
    if (current.some((f) => String(f.id) === rule.ruleId)) continue;
    // 6. The spec declares the template under another id: the spec wins, and the overlay says so.
    const other = current.find((f) => f.name === rule.name);
    if (other !== undefined) {
      warnings.push({
        code: 'COMPILER_004',
        message: `${rule.ruleId} (${rule.name}) not added: the spec declares ${rule.name} as ${String(other.id)} (post-seal rule, ${rule.adr})`,
        functionId: rule.ruleId,
      });
      continue;
    }
    // 1, 5. Appended after the spec's functions, so every existing query keeps its position.
    out = [...current, postSealFunction(rule)];
    added.push(rule.ruleId);
  }
  return { functions: out ?? functions, added, warnings };
}

/** The post-seal overlay of a compiler input, with what it added and the warnings (design BR-U2-03). */
export function postSealOverlay(input: CompilerInput): PostSealOverlay<CompilerInput> {
  const r = overlayFunctions(input.fitnessFunctions, input.style);
  return { value: r.added.length === 0 ? input : { ...input, fitnessFunctions: r.functions }, added: r.added, warnings: r.warnings };
}

/** The compiler input with the post-seal rules of its style; the same object when nothing applies. */
export function applyPostSealRules(input: CompilerInput): CompilerInput {
  return postSealOverlay(input).value;
}

/** The same overlay on a parsed spec (the MCP server's spec load, BR-U2-09); the same object when nothing applies. */
export function withPostSealRules(spec: ParsedSpec): ParsedSpec {
  const r = overlayFunctions(spec.fitnessFunctions, spec.style);
  return r.added.length === 0 ? spec : { ...spec, fitnessFunctions: r.functions };
}
