/**
 * Typed records of the DaedalusArch MCP prototype (v1.3). Every tool returns one of these records as
 * structured content; nothing here touches the frozen instrument (specs, templates, scoring).
 */
import type {
  Dimension,
  OverallVerdict,
  Severity,
  Route,
  LayerKind,
} from '../shared/types/enums.js';
import type { ViolationType } from '../shared/taxonomy/violation-types.js';
import type { ScoringMode, TieredScoring } from '../shared/types/evaluation.js';
import type { RuleTier } from '../scoring-engine/rule-tiers.js';
import type { EdgeView } from '../fitness-compiler/edge-views.js';

// ── Rules ────────────────────────────────────────────────────────────────────

/** Why a spec rule is or is not in force for this spec (the compiler's own applicability decision). */
export type RuleStatus = 'active' | 'disabled' | 'not-applicable';

/** One fitness function of the spec with its resolved status and the template text that describes it. */
export interface RuleView {
  readonly id: string;
  readonly name: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly route: Route;
  readonly status: RuleStatus;
  /** Present when `status` is not `active`: the spec's `reason` or the compiler's applicability reason. */
  readonly statusReason?: string;
  readonly description: string;
  readonly excludePaths: readonly string[];
  /** True when `check_import` evaluates this rule without the graph (the four import-edge rules). */
  readonly checkedByCheckImport: boolean;
  // ── MCP v2 (v1.3) fields ──
  /** Status under the v1.3 compile options (style applicability, ADR-V13-02 draft); `status` stays the v1.2E one. */
  readonly v13Status: RuleStatus;
  readonly v13StatusReason?: string;
  readonly tier: RuleTier;
  readonly construct: string;
  readonly source: string;
  readonly edgeView: EdgeView;
  /** True when check_file / check_diff decide this rule (v1.3 active and covered by the fast path). */
  readonly checkedByFastPath: boolean;
}

/** A rule that an import would break. */
export interface RuleHit {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly violationType: ViolationType;
  readonly reason: string;
  // ── MCP v2 (v1.3) fields, set by check_import ──
  readonly tier?: RuleTier;
  readonly construct?: string;
  readonly source?: string;
  readonly edgeView?: EdgeView;
}

// ── get_architecture_spec / which_layer ──────────────────────────────────────

export interface LayerView {
  readonly name: string;
  /** Position in the spec's inner-to-outer order (0 = innermost). */
  readonly index: number;
  readonly kind?: LayerKind;
  readonly globs: readonly string[];
  readonly filePatterns: readonly string[];
  readonly roles: readonly string[];
  readonly mayImport: readonly string[];
  readonly mayNotImport: readonly string[];
}

export interface ArchitectureSpecView {
  readonly specPath: string;
  readonly specVersion: string;
  readonly style: string | null;
  /** Layer names, inner to outer; a layer may only import itself or layers listed before it (rule FF-S01). */
  readonly layerOrder: readonly string[];
  readonly layers: readonly LayerView[];
  /** `domain-purity` package patterns for the domain layer (exact name or `prefix/*`); empty when none apply. */
  readonly forbiddenPackages: readonly string[];
  readonly rules: readonly RuleView[];
  readonly verdictThresholds: {
    readonly pass: number;
    readonly warning: number;
    readonly softBlock: number;
  };
  readonly warnings: readonly string[];
}

export interface WhichLayerResult {
  readonly path: string;
  readonly layer: string | null;
  readonly matchedBy: 'directory' | 'filename' | null;
  readonly matchedGlob: string | null;
  readonly mayImport: readonly string[];
  readonly mayNotImport: readonly string[];
  readonly forbiddenPackages: readonly string[];
  readonly note?: string;
}

// ── check_import ─────────────────────────────────────────────────────────────

export type ImportTargetKind = 'internal' | 'external-package' | 'node-builtin' | 'unresolved';

export type ImportVerdict = 'allowed' | 'violation' | 'unknown';

export interface CheckImportResult {
  readonly verdict: ImportVerdict;
  readonly from: { readonly path: string; readonly layer: string | null };
  readonly to: {
    readonly specifier: string;
    readonly kind: ImportTargetKind;
    readonly path?: string;
    readonly package?: string;
    readonly layer: string | null;
  };
  readonly violations: readonly RuleHit[];
  readonly checkedRules: readonly string[];
  readonly notes: readonly string[];
  /** MCP v2: `block` when a violation is blocking under v1.3. */
  readonly blockingVerdict?: BlockingVerdict;
  /** Set only with `--fast-rules-engine cypher-interp` (Docs/v1.3/mcp-interp-parity.md): the compiled rules answered. */
  readonly engine?: 'cypher-interp';
}

// ── explain_violation ────────────────────────────────────────────────────────

export interface RuleExplanation {
  readonly ruleId: string | null;
  readonly ruleName: string;
  readonly violationType: ViolationType;
  readonly dimension: string | null;
  readonly severity: string | null;
  /** Template description (what the rule detects). */
  readonly detects: string;
  /** Catalogue explanation of why this is a violation. */
  readonly intent: string;
  /** Catalogue fix guidance. */
  readonly fix: string;
  readonly tag: string;
  readonly requiredLayerKinds: readonly string[];
  readonly applicableStyles: readonly string[] | null;
  /** Rule-specific context from the spec, when one was supplied. */
  readonly specContext: readonly string[];
}

// ── evaluate_project ─────────────────────────────────────────────────────────

export interface RuleViolationGroup {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly count: number;
  /** True when `violations` lists fewer rows than `count` (the per-rule listing is capped). */
  readonly truncated: boolean;
  readonly violations: readonly {
    readonly filePath: string;
    readonly line?: number;
    readonly target?: string;
    readonly message: string;
    readonly severity: Severity;
  }[];
}

export interface EvaluateProjectResult {
  readonly projectPath: string;
  readonly specPath: string;
  readonly evaluationMode: 'symbolic-only';
  readonly ahs: number | null;
  readonly verdict: OverallVerdict;
  readonly violationCount: number;
  readonly byRule: readonly RuleViolationGroup[];
  readonly durationMs: number;
  /** FR-V6: `v1.3` (default: `verdict` from the blocking rules) or `v1.2e` (the registered scoring). */
  readonly scoringMode: ScoringMode;
  /** v1.3 mode only: blocking and advisory counts per rule, N/A parts with denominators; `ahs` stays the v1.2E AHS. */
  readonly tiers?: TieredScoring;
}

// ── Environment ──────────────────────────────────────────────────────────────

/** The Neo4j settings `evaluate_project` reads from the environment (same variables as the CLI). */
export interface Neo4jEnv {
  readonly uri: string;
  readonly user: string;
  readonly password: string;
  readonly apgStorePath: string;
}

// ── check_file / check_diff (v1.3 loop) ──────────────────────────────────────

/** One rule a proposed file breaks, with the concrete change that would clear it. */
export interface FileViolation {
  readonly rule: string;
  readonly ruleName: string;
  readonly severity: Severity;
  /** 1-based line in the checked file (the new-file line for `check_diff`). */
  readonly line: number;
  /** What was flagged: `import "<specifier>"` or `class <Name>`. */
  readonly subject: string;
  readonly reason: string;
  readonly fix: string;
  // ── MCP v2 (v1.3) fields ──
  /** Same as `rule`: the spec id, or `APG2.<template>` / `CHEAP.<proxy>` for a hint. */
  readonly ruleId: string;
  /** v1.3 tier (Docs/v1.3/rule-tiers.md, by the spec's style): only `blocking` findings fail a v1.3 verdict. */
  readonly tier: RuleTier;
  /** `table` (rule-tiers.md), `untiered-default` (not in the table: advisory), `hint` (APG v2 / cheap proxy: advisory by design). */
  readonly tierSource: 'table' | 'untiered-default' | 'hint';
  /** APG v2 hints only: the tier APG2_TEMPLATE_TIERS proposes, not in force until an ADR adds it to the sealed table. */
  readonly candidateTier?: RuleTier;
  /** The architectural construct the rule encodes. */
  readonly construct: string;
  /** Literature source line (Docs/v1.3/style-rule-sources.md where it has a row). */
  readonly source: string;
  /** Edge view the full evaluation reads for the rule (ADR-V13-01, Docs/v1.3/edge-views.md). */
  readonly edgeView: EdgeView;
  /** `spec`: a spec fitness function; `apg2` / `cheap`: an advisory hint. */
  readonly check: 'spec' | 'apg2' | 'cheap';
  /** Project-relative path of the checked file. */
  readonly file: string;
  /** `file:line`. */
  readonly location: string;
  /** The imported file or package, or the class the finding is about, when there is one. */
  readonly target?: string;
  /** Resolved view: the barrels an import went through to reach `target`. */
  readonly viaBarrels?: readonly string[];
}

/** An active v1.3 rule the fast path does not decide, and why (run evaluate_project for it). */
export interface NotChecked {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly tier: RuleTier;
  readonly reason: string;
}

/** `block`: at least one blocking finding; `pass`: none; `unknown`: none found, but some imports could not be placed. */
export type BlockingVerdict = 'block' | 'pass' | 'unknown';

export type FileVerdict = 'clean' | 'violations' | 'unknown';

export interface FileCheckResult {
  readonly path: string;
  readonly layer: string | null;
  /** v1 contract: from `violations` (the import and naming rules). The v1.3 answer is `blockingVerdict`. */
  readonly verdict: FileVerdict;
  /** One line an agent can act on without reading the rest (v1 contract; see `blockingSummary`). */
  readonly summary: string;
  /** v1 contract: the import-rule and naming-rule violations, now with their v1.3 fields. Every one is also in `findings`. */
  readonly violations: readonly FileViolation[];
  /**
   * Same checks on `require()` and `import()` calls. The frozen firewall counts these calls but does not model them
   * as edges (BR-U2-25), so they never lower the score; they are listed so the agent can avoid them anyway.
   */
  readonly advisories: readonly FileViolation[];
  /** Imports the spec alone cannot place (path aliases); `verdict` is `unknown` when there are any and no violation. */
  readonly unresolved: readonly { readonly line: number; readonly specifier: string }[];
  readonly checkedRules: readonly string[];
  readonly notes: readonly string[];
  // ── MCP v2 (v1.3) fields ──
  /**
   * Every spec-rule finding of the v1.3 fast path: `violations` plus the rules v1 did not check (allowed-dependency
   * layering, DDD rules, repository/port placement, injected infrastructure in the domain, cycles). Line order.
   */
  readonly findings: readonly FileViolation[];
  /** The answer an agent acts on: `block` when any finding is blocking under v1.3. */
  readonly blockingVerdict: BlockingVerdict;
  readonly blockingCount: number;
  readonly advisoryCount: number;
  /** One line on the blocking answer. */
  readonly blockingSummary: string;
  /** APG v2 fast checks and cheap-proxy hints: always advisory. */
  readonly hints: readonly FileViolation[];
  /** Active v1.3 rules the fast path does not decide. */
  readonly notChecked: readonly NotChecked[];
  /** The project root was read (barrels followed, cycles checked, entry files found). */
  readonly projectAware: boolean;
  /** Set only with `--fast-rules-engine cypher-interp` (Docs/v1.3/mcp-interp-parity.md): the compiled rules answered. */
  readonly engine?: 'cypher-interp';
}

export interface DiffCheckResult {
  readonly verdict: FileVerdict;
  readonly summary: string;
  readonly files: readonly (FileCheckResult & {
    /** `affected` (cypher-interp only): a file outside the diff where the change made a rule fire. */
    readonly change: 'added' | 'modified' | 'renamed' | 'affected';
    /**
     * `whole-file`: an added file, checked whole; `delta`: a modified file rebuilt from the diff and the project, and
     * reported as what the new content has that the old does not; `added-lines`: only the added lines were readable.
     */
    readonly basis: 'whole-file' | 'delta' | 'added-lines';
  })[];
  readonly skipped: readonly { readonly path: string; readonly reason: string }[];
  // ── MCP v2 (v1.3) fields ──
  readonly blockingVerdict: BlockingVerdict;
  readonly blockingCount: number;
  readonly advisoryCount: number;
  readonly blockingSummary: string;
  /** Set only with `--fast-rules-engine cypher-interp` (Docs/v1.3/mcp-interp-parity.md): the compiled rules answered. */
  readonly engine?: 'cypher-interp';
}

// ── suggest_placement (v1.3 loop) ────────────────────────────────────────────

export interface Placement {
  readonly role: string;
  readonly layer: string;
  /** Project-relative path; the file name follows the spec's active naming rules. */
  readonly path: string;
  readonly className: string;
  /** Why this placement: the spec role or layer kind it was derived from. */
  readonly why: string;
  readonly mayImport: readonly string[];
  readonly forbiddenPackages: readonly string[];
}

export interface PlacementResult {
  readonly purpose: string;
  readonly summary: string;
  /** Best first; a split concern (an interface and its implementation) returns one entry per part. */
  readonly placements: readonly Placement[];
  readonly notes: readonly string[];
}

// ── infer_spec (MCP v2) ──────────────────────────────────────────────────────

export interface InferSpecResult {
  readonly projectPath: string;
  /** Always `proposed`: an agent or a human must confirm the spec before it is used. */
  readonly status: 'proposed';
  readonly style: string;
  readonly styleSource: 'classified' | 'forced';
  /** The classifier's confidence in `style` (0..1). */
  readonly confidence: number;
  /** Confidence under 0.5, or the runner-up within 0.1. */
  readonly lowConfidence: boolean;
  readonly ranked: readonly { readonly style: string; readonly confidence: number; readonly points: number; readonly evidence: readonly string[] }[];
  readonly mappingMode: string;
  readonly layers: readonly { readonly name: string; readonly directories: readonly string[]; readonly filePatterns: readonly string[] }[];
  /** Per source unit: the layer, how it was decided and with what confidence (the evidence of the mapping). */
  readonly units: readonly { readonly unit: string; readonly layer: string | null; readonly source: string; readonly confidence: number }[];
  /** ddd only: the inferred `architecture.ddd` block. */
  readonly ddd?: Readonly<Record<string, unknown>>;
  /** The proposed spec (a preset parameterised with the inferred globs). */
  readonly specYaml: string;
  /** The repository's spec validator on the proposal, against the project. */
  readonly validation: { readonly valid: boolean; readonly errors: readonly string[]; readonly warnings: readonly string[] };
  /** Style-free majority-vote rules the project follows (ISE option 1), strongest first. */
  readonly ruleCandidates: readonly { readonly id: string; readonly statement: string; readonly support: number; readonly instances: number; readonly mapsTo: readonly string[] }[];
  /** What to check before confirming. */
  readonly review: readonly string[];
  readonly durationMs: number;
}

// ── explain_finding (MCP v2) ─────────────────────────────────────────────────

export interface FindingExplanation {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly tier: RuleTier;
  readonly tierSource: 'table' | 'untiered-default' | 'hint';
  readonly candidateTier?: RuleTier;
  readonly construct: string;
  readonly literature: {
    readonly source: string;
    /** `style`: the spec style's own row of Docs/v1.3/style-rule-sources.md; `composed`: a composed style's row; `other`: outside the table. */
    readonly row: 'style' | 'composed' | 'other';
  };
  /** What the rule detects and why it is a violation (template and catalogue text). */
  readonly detects: string;
  readonly intent: string;
  readonly fix: string;
  /** A minimal violating and compliant pair for the construct. */
  readonly example: { readonly violating: string; readonly compliant: string; readonly note: string };
  readonly howChecked: {
    /** The full evaluation (evaluate_project): template, edge view and graph facts read. */
    readonly fullEvaluation: string;
    readonly edgeView: EdgeView;
    /** check_file / check_diff: what the fast path reads, or why it leaves the rule to evaluate_project. */
    readonly fastPath: string;
    readonly checkedByFastPath: boolean;
  };
  /** The location asked about, as the spec sees it. */
  readonly location?: {
    readonly file: string;
    readonly line?: number;
    readonly layer: string | null;
    /** The source line, when the project root is configured and the file exists. */
    readonly text?: string;
  };
  readonly specContext: readonly string[];
}
