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
}

/** A rule that an import would break. */
export interface RuleHit {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly violationType: ViolationType;
  readonly reason: string;
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
}

export type FileVerdict = 'clean' | 'violations' | 'unknown';

export interface FileCheckResult {
  readonly path: string;
  readonly layer: string | null;
  readonly verdict: FileVerdict;
  /** One line an agent can act on without reading the rest. */
  readonly summary: string;
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
}

export interface DiffCheckResult {
  readonly verdict: FileVerdict;
  readonly summary: string;
  readonly files: readonly (FileCheckResult & {
    readonly change: 'added' | 'modified' | 'renamed';
  })[];
  readonly skipped: readonly { readonly path: string; readonly reason: string }[];
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
