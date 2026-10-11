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
}

// ── Environment ──────────────────────────────────────────────────────────────

/** The Neo4j settings `evaluate_project` reads from the environment (same variables as the CLI). */
export interface Neo4jEnv {
  readonly uri: string;
  readonly user: string;
  readonly password: string;
  readonly apgStorePath: string;
}
