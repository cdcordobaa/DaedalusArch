/**
 * U5a mutation domain types (FR-v1.2E-24; `domain-entities.md` §2; D-U5a-14).
 *
 * This is the module path U5b imports (`PreparedBase`, U5b domain-entities §8). All shapes are immutable;
 * construction goes through the validating factories of the modules that own them (`prepare.ts`, `apply.ts`,
 * `manifest.ts`). Types only: no runtime code, no detector import (BR-U5a-06).
 */
import type { Project } from 'ts-morph';
import type { Dimension } from '../../../src/shared/types/enums.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { SeededRng } from './rng.js';

export type { Dimension, ParsedSpec, SeededRng };

// --- §2.1 Inputs ---------------------------------------------------------------------------------------------

export type BaseKind = 'fixture' | 'corpus' | 'generated';

/** Label-free projection of U4 `BaselineSelection` (U4 domain-entities §2.4; BR-U5a-27). */
export interface JudgeSelection {
  readonly template: 'intent-alignment' | 'architectural-integrity';
  /** Spec id of the probed function (FF-N02 / FF-N01 on clean-arch). */
  readonly functionId: string;
  /** `selectedUnitIds.length < candidateUnitIds.length`. */
  readonly capped: boolean;
  /** POSIX paths of the files of `selectedUnitIds`, sorted, unique. */
  readonly selectedFiles: readonly string[];
}

/** A prepared, read-only base (BR-U5b-76 names; filled by U5b for corpus bases, by U5a for fixture/generated). */
export interface PreparedBase {
  readonly projectId: string;
  readonly baseKind: BaseKind;
  /** Prepared, read-only source of copies. */
  readonly dir: string;
  /** 40 hex; fixture | corpus. */
  readonly baseCommit?: string;
  /** 40 hex; generated. */
  readonly baseGenerationTreeSha?: string;
  /** Relative to `dir`. */
  readonly tsconfigPath: string;
  /** Absolute, pinned. */
  readonly tscPath: string;
  /** Measured. */
  readonly tscVersion: string;
  /** Absent when nothing is installed. */
  readonly installLockSha256?: string;
  readonly overlays: readonly { readonly path: string; readonly sha256: string }[];
  /** Spec used to resolve `expected`. */
  readonly specPath: string;
  /** `= judgeSelection?.some(s => s.capped) ?? false`. */
  readonly capped: boolean;
  /** One entry per neural function, from U4's `BaselineSelection` (BR-U5a-27). */
  readonly judgeSelection?: readonly JudgeSelection[];
}

// --- §2.2 Operator, site, application ------------------------------------------------------------------------

export type SiteKind =
  | 'import-edge'
  | 'package-import'
  | 'created-file'
  | 'class-members'
  | 'interface-members'
  | 'class-rename'
  | 'field-new'
  | 'field-assignment'
  | 'dynamic-import'
  | 'guard-move'
  | 'invariant-split';

export const SITE_KINDS: readonly SiteKind[] = [
  'import-edge',
  'package-import',
  'created-file',
  'class-members',
  'interface-members',
  'class-rename',
  'field-new',
  'field-assignment',
  'dynamic-import',
  'guard-move',
  'invariant-split',
];

export interface MutationSite {
  /** POSIX, relative to the copy root. */
  readonly filePath: string;
  /** 1-based, base coordinates. */
  readonly line: number;
  readonly kind: SiteKind;
  /** e.g. `{ targetFile, symbol }`; keys sorted when serialised. */
  readonly detail: Readonly<Record<string, string>>;
}

export type LineRule = 'site-line' | 'first-edge-line' | 'none';

export type DiscriminatorColumn = 'class' | 'interface' | 'controller' | 'entity' | 'field' | 'relType' | 'cycle';

export interface LocationRule {
  /** Template name. */
  readonly template: string;
  readonly filePath: 'site' | 'created' | 'site-target';
  readonly target?: 'site-target' | 'package';
  readonly discriminator?: readonly DiscriminatorColumn[];
  readonly line: LineRule;
}

/** A ts-morph project over one prepared copy. */
export interface ProjectHandle {
  /** Absolute copy root. */
  readonly root: string;
  /** Absolute tsconfig path inside the copy. */
  readonly tsconfigPath: string;
  readonly project: Project;
}

export type PreconditionReason =
  | 'style-disabled'
  | 'edge-exists'
  | 'metric-already-violating'
  | 'threshold-arithmetic'
  | 'controller-or-entity'
  | 'entity-import'
  | 'not-removable-guard'
  | 'implementer-over-threshold'
  | 'judge-unit-not-selected'
  | 'type-shape'
  | 'already-imported'
  | 'cycle-cap';

export type PreconditionResult = { readonly ok: true } | { readonly ok: false; readonly reason: PreconditionReason };

/** Inputs a precondition may read besides the project and spec (base graph and caps; no detector output). */
export interface PreconditionContext {
  readonly base: PreparedBase;
  readonly baseGraph: ImportGraph;
  /** Simple cycles of the base graph (bounded by `maxCycleLength`), for the cycle-cap precondition (BR-U5a-13). */
  readonly baseCycleCount: number;
  readonly maxCycleLength: number;
  readonly cycleRowCap: number;
  /** Compiled threshold per template name the spec declares (BR-U5a-14 ii). */
  readonly thresholds: Readonly<Record<string, number>>;
}

export interface LineShift {
  readonly filePath: string;
  readonly afterLine: number;
  readonly delta: number;
}

export interface MutationEdit {
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly lineShifts: readonly LineShift[];
  /** Planned File→File edges; used by the cycle-cap precondition; must equal edges(G') − edges(G). */
  readonly newEdges: readonly { readonly source: string; readonly target: string }[];
}

export type OperatorRole = 'positive' | 'twin' | 'probe';
export type Coverage = 'in' | 'outside';
export type JudgeProbe = 'semantic' | 'integrity';

export interface MutationOperator {
  /** 'MO-S01', twins 'MO-S01n', probes 'SP-…'. */
  readonly id: string;
  readonly role: OperatorRole;
  readonly core: boolean;
  readonly twinOf?: string;
  /** [] for twins and judge probes. */
  readonly expectedTemplates: readonly LocationRule[];
  /** Keyed like `expectedTemplates` (BR-U5a-14). */
  readonly operatorCollateral: readonly LocationRule[];
  /** [] for outside-coverage operators. */
  readonly coveredByTemplates: readonly string[];
  readonly coverage: Coverage;
  readonly judgeProbe?: JudgeProbe;
  readonly expectedEdges?: readonly { readonly type: 'FLOWS_TO'; readonly via: 'new' | 'field-assignment' }[];
  /** Published source citation. */
  readonly source: string;
  findSites(project: ProjectHandle, spec: ParsedSpec): readonly MutationSite[];
  checkPreconditions(
    project: ProjectHandle,
    spec: ParsedSpec,
    site: MutationSite,
    ctx: PreconditionContext,
  ): PreconditionResult;
  apply(project: ProjectHandle, site: MutationSite, rng: SeededRng): DomainResult<MutationEdit>;
}

/** Cycle key form (BR-U5a-14 i; D-U5a-14). Explicit input, never inferred. */
export type CycleStrategy = 'simple-cycles' | 'scc';
export const CYCLE_STRATEGIES: readonly CycleStrategy[] = ['simple-cycles', 'scc'];

export interface ApplyOptions {
  /** D-U5a-14: required; set by `scripts/mutate.ts --cycle-strategy` and recorded in the manifest header. */
  readonly cycleStrategy: CycleStrategy;
  /** BR-U5a-55, fixtures and dev only. */
  readonly siteOverride?: {
    readonly filePath: string;
    readonly line?: number;
    readonly detail: Readonly<Record<string, string>>;
  };
  /** Application index for a forced site (default 0). */
  readonly k?: number;
}

export type SiteSelection = 'sampled' | 'forced';

export interface ProvisionedStub {
  readonly specifier: string;
  readonly path: string;
}

export interface TypecheckEvidence {
  readonly tscPath: string;
  readonly tscVersion: string;
  readonly baseErrors: 0;
  readonly mutantErrors: 0;
}

export interface MutationApplication {
  readonly operatorId: string;
  readonly site: MutationSite;
  readonly siteSelection: SiteSelection;
  /** Position in the stable site list. */
  readonly siteIndex: number;
  readonly edit: MutationEdit;
  readonly expected: ExpectedBlock;
  readonly provisionedStubs: readonly ProvisionedStub[];
  readonly typecheck: TypecheckEvidence;
}

// --- §2.3 Expected block and collateral ----------------------------------------------------------------------

/** U5b scorer key `(functionId, filePath, target, discriminator)` in U3 encoding, plus the line rule. */
export interface ExpectedKey {
  readonly functionId: string;
  /** File path; '<project>' for project-level rows; `String(cycle)` for Cypher cycle rows. */
  readonly filePath: string;
  /** '' when absent; cycle rows: `cycle[1]`. */
  readonly target: string;
  /** T-MAP disc values as strings; cycle rows: `[JSON.stringify(cycle)]`; SCC rows: `['scc']`. */
  readonly discriminator: readonly string[];
  /** Required; read by U5b BR-U5b-04 for `lineConfirmed`. */
  readonly lineRule: LineRule;
  /** Mutant coordinates; present ⇔ `lineRule ≠ 'none'`. */
  readonly line?: number;
}

export type CollateralCause = 'declared' | 'cycle' | 'metric-crossing' | 'created-without-test' | 'project-metric';

export interface SiteCollateral {
  readonly kind: 'operator' | 'site';
  readonly template: string;
  readonly functionId: string;
  readonly cause: CollateralCause;
  /** Required except `cause = 'project-metric'`. */
  readonly key?: ExpectedKey;
  /** `metric-crossing` only; `base: null` = file absent or excluded in G. */
  readonly metric?: { readonly base: number | null; readonly mutant: number; readonly threshold: number };
}

export interface FlowsToEdge {
  readonly type: 'FLOWS_TO';
  readonly source: string;
  readonly target: string;
  readonly via: 'new' | 'field-assignment';
}

export interface PositiveExpected {
  readonly negative?: undefined;
  /** [] for judge probes. */
  readonly functionIds: readonly string[];
  readonly disabledFunctionIds: readonly { readonly functionId: string; readonly reason: string }[];
  readonly absentTemplates: readonly string[];
  /** Symbolic member; judge probes: 'semantic' | 'integrity'. */
  readonly dimension: Dimension;
  readonly keys: readonly ExpectedKey[];
  readonly collateral: readonly SiteCollateral[];
  readonly coverage: Coverage;
  readonly judgeProbe?: JudgeProbe;
  readonly expectedEdges?: readonly FlowsToEdge[];
}

export interface NegativeExpected {
  readonly negative: true;
  readonly twinOf: string;
  readonly functionIds: readonly [];
  readonly keys: readonly [];
  readonly collateral: readonly SiteCollateral[];
  readonly coverage: Coverage;
  /** MO-DF01n. */
  readonly expectedEdges?: readonly FlowsToEdge[];
}

export type ExpectedBlock = PositiveExpected | NegativeExpected;

// --- §2.4 Import graph (BR-U5a-56) ---------------------------------------------------------------------------

export interface ImportGraphFile {
  readonly filePath: string;
  readonly layer: string | null;
  readonly isBarrel: boolean;
}

export interface ImportGraphEdge {
  readonly source: string;
  readonly target: string;
  readonly type: 'IMPORTS' | 'RE_EXPORTS';
}

export interface ImportGraph {
  readonly files: ReadonlyMap<string, ImportGraphFile>;
  /** Unique per (source, target, type), sorted. */
  readonly edges: readonly ImportGraphEdge[];
}

export type MetricTemplate =
  | 'domain-stability'
  | 'module-fan-out'
  | 'component-instability'
  | 'no-orphan-files'
  | 'max-fan-in';
