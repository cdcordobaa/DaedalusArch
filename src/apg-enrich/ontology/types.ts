/**
 * Ontology v0: shared types of the grounded semantic layer over the APG.
 *
 * The layer lives in its own namespace: every node and edge label starts with `Sem`, every node and edge carries
 * provenance (model, prompt hash, run id, temperature), a confidence and grounded evidence (APG node ids plus file
 * line spans that the grounding validator checked). Symbolic APG facts are read, never modified. Design:
 * `Docs/v1.3/ontology-v0-design.md`.
 */
import type { LayerKind } from '../../shared/types/enums.js';

export const SEM_NODE_LABELS = ['SemCapability', 'SemBusinessRule', 'SemResponsibility', 'SemBusinessConcept'] as const;
export type SemNodeLabel = (typeof SEM_NODE_LABELS)[number];

export const SEM_EDGE_TYPES = ['SemREALIZES', 'SemENFORCES', 'SemRESPONSIBLE_FOR', 'SemEMBODIES', 'SemMISPLACED_IN'] as const;
export type SemEdgeType = (typeof SEM_EDGE_TYPES)[number];

/** The four model passes. `adjudicate` is the model step of the clustering pass (d). */
export const PASS_IDS = ['responsibility', 'capability', 'rules', 'adjudicate'] as const;
export type PassId = (typeof PASS_IDS)[number];

/** A model call's pass: one of the four C1d passes, or `interpret`, the C4 call (v1.4 U9; C4-01). */
export type CallPass = PassId | 'interpret';

/** Who produced an assertion. `temperature` is null when the route sends none (the Claude CLI has no such flag). */
export interface SemProvenance {
  readonly model: string;
  readonly promptHash: string;
  readonly runId: string;
  readonly temperature: number | null;
}

/** A citation as the model returns it, before grounding. */
export interface Citation {
  readonly nodeId: string;
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  /** Code copied from the cited lines; compared to the file with whitespace collapsed. */
  readonly quote: string;
}

/** A citation the grounding validator accepted. */
export interface GroundedEvidence extends Citation {
  readonly grounded: true;
}

export type Agreement = 'agreed' | 'single-run';

export interface SemNode {
  readonly id: string;
  readonly label: SemNodeLabel;
  readonly name: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly provenance: SemProvenance;
  readonly confidence: number;
  readonly evidence: readonly GroundedEvidence[];
  readonly agreement: Agreement;
}

export interface SemEdge {
  readonly id: string;
  readonly type: SemEdgeType;
  /** An APG node id (code side) or a Sem node id (SemMISPLACED_IN: the responsibility). */
  readonly sourceId: string;
  /** A Sem node id, or `layer:<kind>` for SemMISPLACED_IN. */
  readonly targetId: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly provenance: SemProvenance;
  readonly confidence: number;
  readonly evidence: readonly GroundedEvidence[];
  readonly agreement: Agreement;
}

// ── Model outputs (after JSON-schema validation, before grounding) ───────────────────────────────────────────────

export interface ResponsibilityOut {
  readonly name: string;
  readonly description: string;
  readonly naturalLayer: LayerKind;
  readonly confidence: number;
  readonly evidence: readonly Citation[];
}

export interface ConceptOut {
  readonly name: string;
  /** `defines`: the class models the concept (an entity or value of it); `uses`: it only handles one. */
  readonly relation: 'defines' | 'uses';
  readonly confidence: number;
  readonly evidence: readonly Citation[];
}

export interface ResponsibilityPassOut {
  readonly responsibilities: readonly ResponsibilityOut[];
  readonly concepts: readonly ConceptOut[];
}

export interface CapabilityOut {
  readonly name: string;
  readonly description: string;
  /** Class node ids of the group. */
  readonly realizedBy: readonly string[];
  readonly confidence: number;
  readonly evidence: readonly Citation[];
}

export interface CapabilityPassOut {
  readonly capabilities: readonly CapabilityOut[];
}

export const RULE_OPERATORS = ['>=', '>', '<=', '<', '==', '!=', 'other'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/**
 * What kind of check a rule is (v1.4 U3, BR-U3-11): `business`, a rule of the domain that must hold whichever entry
 * point is used; `input-validation`, a check of the form, type or size of incoming data. Only business rules are
 * clustered (BR-U3-18).
 */
export const RULE_KINDS = ['business', 'input-validation'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export interface RuleOut {
  readonly statement: string;
  readonly kind: RuleKind;
  readonly subject: string;
  readonly operator: RuleOperator;
  readonly threshold: number | null;
  readonly unit: string | null;
  /** Method node id of the class that enforces the rule. */
  readonly enforcedBy: string;
  readonly confidence: number;
  readonly evidence: readonly Citation[];
}

export interface RulePassOut {
  readonly rules: readonly RuleOut[];
}

export interface AdjudicationOut {
  readonly same: boolean;
  readonly confidence: number;
  readonly rationale: string;
}

// ── Grounding rejections (counted as hallucinations) ─────────────────────────────────────────────────────────────

export const REJECTION_REASONS = [
  'no-evidence', 'unknown-node', 'wrong-node-type', 'node-outside-item', 'unknown-file', 'node-file-mismatch',
  'span-out-of-range', 'span-outside-node', 'empty-quote', 'quote-mismatch',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export interface RejectionDetail {
  readonly reason: RejectionReason;
  /** Index of the failing citation, or -1 for a non-citation reference (`enforcedBy`, `realizedBy`). */
  readonly citation: number;
  readonly detail: string;
}

export interface Hallucination {
  readonly pass: PassId;
  readonly itemId: string;
  readonly runIndex: number;
  readonly assertionKind: 'responsibility' | 'concept' | 'capability' | 'rule';
  readonly assertion: string;
  readonly reasons: readonly RejectionDetail[];
}

// ── Derived findings ─────────────────────────────────────────────────────────────────────────────────────────────

export interface CodeSite {
  readonly nodeId: string;
  readonly file: string;
  readonly className: string;
  readonly methodName?: string;
  readonly component: string;
}

export type Verification =
  | { readonly verified: true; readonly method: 'comparison-pattern' | 'constant-pattern' | 'cheap-clone' | 'cheap-literal'; readonly detail: string }
  | { readonly verified: false; readonly method: 'none'; readonly detail: string };

export interface RuleDuplicationFinding {
  readonly kind: 'semantic-rule-duplication';
  readonly ruleId: string;
  readonly statement: string;
  readonly sites: readonly CodeSite[];
  readonly components: readonly string[];
  readonly verification: Verification;
  readonly confidence: number;
}

export interface MisplacedResponsibilityFinding {
  readonly kind: 'misplaced-responsibility';
  readonly responsibilityId: string;
  readonly responsibility: string;
  readonly site: CodeSite;
  readonly classLayer: LayerKind;
  readonly naturalLayer: LayerKind;
  /** Deterministic support: the highest cheap logic density among the cited methods (null when none is cited). */
  readonly citedLogicDensity: number | null;
  readonly confidence: number;
}

export interface ConceptFragmentationFinding {
  readonly kind: 'concept-fragmentation';
  readonly conceptId: string;
  readonly concept: string;
  readonly classes: readonly CodeSite[];
  readonly components: readonly string[];
  /** Jaccard of the classes' field-name sets (deterministic context, not a gate). */
  readonly fieldOverlap: number;
  readonly confidence: number;
}

export interface CapabilityScatterFinding {
  readonly kind: 'capability-scatter';
  readonly capabilityId: string;
  readonly capability: string;
  readonly classes: readonly CodeSite[];
  readonly components: readonly string[];
  readonly confidence: number;
}

export type OntologyFinding = RuleDuplicationFinding | MisplacedResponsibilityFinding | ConceptFragmentationFinding | CapabilityScatterFinding;

// ── Run accounting ───────────────────────────────────────────────────────────────────────────────────────────────

export interface PassAgreement {
  /** Items with two valid runs. */
  readonly items: number;
  /** Mean per-item Jaccard of the two runs' accepted assertion sets (1 when both are empty). */
  readonly meanJaccard: number | null;
  /** Assertions of run 0 that run 1 matched, over all run-0 assertions. */
  readonly agreedAssertions: number;
  readonly totalAssertions: number;
}

export interface CallStats {
  readonly providerCalls: number;
  readonly cacheHits: number;
  readonly invalid: number;
  readonly skippedForBudget: number;
  readonly cassetteMisses: number;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

export interface OntologyStop {
  readonly code: string;
  readonly message: string;
  readonly pass: CallPass;
}

export interface OntologyResult {
  readonly runId: string;
  readonly provider: { readonly provider: string; readonly model: string };
  readonly nodes: readonly SemNode[];
  readonly edges: readonly SemEdge[];
  readonly findings: readonly OntologyFinding[];
  readonly hallucinations: readonly Hallucination[];
  /** Accepted assertions per pass (both runs), to put the hallucination count in proportion. */
  readonly acceptedAssertions: Readonly<Record<PassId, number>>;
  readonly agreement: Readonly<Record<PassId, PassAgreement>>;
  readonly calls: CallStats;
  readonly budget: number;
  /** Set when a stop (usage limit, auth, isolation) ended the run early; the cache keeps what was recorded. */
  readonly stopped: OntologyStop | null;
}
