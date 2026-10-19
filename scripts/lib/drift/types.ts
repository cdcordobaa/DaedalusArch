/**
 * Violation identity across snapshots (C1e) and the drift metrics over a snapshot sequence (C5): the data contracts
 * and the presets (`aidlc-docs/construction/v1.4/U4/functional-design/design.md` §3).
 *
 * Every G08 choice (`ops/notes/g08-violation-identity.md`) is a named option, so each number carries its definition.
 * Records are plain JSON (serialisable through `scripts/lib/canonical-json.ts`).
 */
import type { Disappearance } from '../../v1.3/lib/fixes-mined.js';

/** Normalised finding: anything the adapters accept becomes this (the fix-mining `MinedViolation` shape plus tier). */
export interface IdFinding {
  /** Rule id. */
  readonly functionId: string;
  /** Source file, or a comma list for a cycle. */
  readonly filePath: string;
  readonly target?: string | undefined;
  readonly discriminator?: readonly string[] | undefined;
  readonly tier?: 'blocking' | 'advisory' | undefined;
  /** Carried for the memo grain only (D-8); not part of K or E. */
  readonly template?: string | undefined;
  /** Idem. */
  readonly ruleName?: string | undefined;
  /** Set only by an adapter fallback: a cycle whose member list the record does not hold (ID-4). */
  readonly cycleMembersKnown?: false | undefined;
}

/** One snapshot of a sequence (a commit, a tree, a loop step). */
export interface Snapshot {
  /** Sha, tree hash or step label. */
  readonly id: string;
  /**
   * Fingerprint of the instrument state Θ and the spec σ (ID-1). For a probe step file: spec, engine,
   * instrumentVersion and scoringMode; for fix mining: walk.json spec, engine, mode and scoring.
   */
  readonly contextId: string;
  /** ISO date; needed for survival only. */
  readonly date?: string | undefined;
  readonly ok: boolean;
  readonly findings: readonly IdFinding[];
  /** Files present (analysis-root relative), for the causes and `filesStay`. */
  readonly files?: readonly string[] | undefined;
  /** `s|t` file edges present, for the causes. */
  readonly edges?: readonly string[] | undefined;
  /** The snapshot holds the FF-S02 row cap (ID-19). An input; the module never infers it. */
  readonly s02Capped?: boolean | undefined;
}

/** old -> new, from `parseNameStatus` (ID-9). */
export type RenameMap = ReadonlyMap<string, string>;

/** Between two consecutive *valid* snapshots; indexed by the later snapshot. */
export interface Transition {
  readonly rename?: RenameMap | undefined;
  /**
   * Old paths renamed to a destination outside the analysis root (ID-10). Not in the design's §3 contract, which
   * needs it for the out-of-root rule; `parseNameStatus` returns it.
   */
  readonly outOfRoot?: ReadonlySet<string> | undefined;
  /** ID-9: git skipped rename detection (the `-l` limit), so `rename` may be incomplete. */
  readonly renameDetection?: 'full' | 'skipped' | undefined;
  /** Pair level only: a bot or mass commit (credit, never identity: ID-12). */
  readonly massOrBot?: boolean | undefined;
}

export interface IdentityOptions {
  /** `memo` only for MEMO_COMPAT (D-8). */
  readonly grain: 'fine' | 'edge' | 'memo';
  readonly cycleIdentity: 'edge-set' | 'sorted-files' | 'explode-edges';
  /** Edge grain: a file-level finding has no E (Study 2 counts edges only, ID-7). */
  readonly edgeOnly: boolean;
  readonly renamePolicy: 'continue' | 'end';
  /** ID-15. */
  readonly rePointed: boolean;
  /** ID-17. */
  readonly merged: boolean;
  /** ID-19: FF-S02 row cap (100). */
  readonly s02Cap: number;
  /** DR-2. LEGACY_FIXES_MINED uses 'grid-index-0'. */
  readonly leftCensor: 'grid-index-0' | 'first-valid';
}

/** Disappearance causes: the fix-mining taxonomy plus the two G08 classes (never credited as a fix). */
export type Cause = Disappearance | 'RE-POINTED' | 'MERGED';

export interface Lineage {
  /** The key at birth. */
  readonly key: string;
  /** The key at the end when renames moved it (`renamePolicy: 'continue'`); absent otherwise. Not in the §3 contract. */
  readonly finalKey?: string | undefined;
  /** More than one only for an edge key (FF-S01 + FF-S03). */
  readonly ruleIds: readonly string[];
  readonly edgeShaped: boolean;
  readonly tier?: 'blocking' | 'advisory' | undefined;
  /** Index into the snapshot list; 0 = left-censored under 'grid-index-0'. */
  readonly born: number;
  readonly ended: number | null;
  readonly cause?: Cause | undefined;
  readonly filesStay?: boolean | undefined;
  /** Snapshot indices where a rename moved the lineage (`renamePolicy: 'continue'`). */
  readonly renamedAt?: readonly number[] | undefined;
  /** ID-15, ID-16, ID-18. */
  readonly derivedFrom?: readonly string[] | undefined;
  readonly cycleMembersKnown?: false | undefined;
  /** Committed fix-mining records only (`readMinedLineages`): 'finding' or the unflagged import-edge baseline. */
  readonly kind?: 'finding' | 'edge' | undefined;
  /** Idem: the rule of a finding lineage. */
  readonly functionId?: string | undefined;
  /** Idem: 'layered' | 'crossLayer' | 'other' for an edge lineage. */
  readonly edgeKind?: string | undefined;
}

export interface DriftParams extends IdentityOptions {
  readonly kFrom: number;
  readonly kTo: number;
  readonly priorUnion: 'final-snapshots' | 'all-turns';
  readonly y1Min: number;
}

/**
 * The construct Study 2's D measures (REV-03 finding 3, `ops/notes/rev-03-study2-drift-fable.md`): the propagation of
 * inherited step-1 blocking patterns to new slices. It is not "drift from a common state".
 */
export const D_CONSTRUCT = 'propagation of inherited step-1 blocking patterns to new slices' as const;

/** Study 2, one run (D-1 to D-8). */
export interface DriftRun {
  readonly construct: typeof D_CONSTRUCT;
  readonly runId: string;
  readonly blockId: string;
  readonly cell: string;
  /** Inherited step-1 identities at the chosen grain, and at the fine grain. */
  readonly Y1: number | null;
  readonly Y1fine: number | null;
  /** Level at the last step counted (the old primary). */
  readonly Yk: number | null;
  /** Y1 >= y1Min. */
  readonly eligible: boolean | null;
  readonly D: number | null;
  readonly perStep: readonly { readonly step: number; readonly newCount: number | null; readonly afterUnscored?: true }[];
  readonly inheritedRemoved: number | null;
  readonly inheritedRemovedPerStep: readonly { readonly step: number; readonly removed: number | null }[];
  readonly DnoInheritedRemoval: number | null;
  readonly DperNewSlice: number | null;
  /** D / (k - 1). */
  readonly DperStep: number | null;
  readonly DperAddedKloc: number | null;
  /** Steps after step 1 until the first new identity (t - 1 for the first step t with a new one); null if none. */
  readonly stepsToFirstNew: number | null;
  readonly incomplete: boolean;
  readonly degradedCycleKeys: number;
  /** D-2: `renamePolicy: 'continue'` and a step without a rename map. */
  readonly renameMapMissing: boolean;
  /** D-6: D within each caller-supplied group, and D without it (leave one group out). */
  readonly byGroup?: Readonly<Record<string, { readonly D: number | null; readonly Dwithout: number | null }>> | undefined;
  /** Echoed, so every number carries its definition. */
  readonly params: DriftParams;
}

// ── Presets ─────────────────────────────────────────────────────────────────

/**
 * Fix mining as committed (`scripts/v1.3/fixes-mined-run.ts`, `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md`):
 * the fine key, a rename ends a lineage, no RE-POINTED or MERGED, and only grid index 0 left-censored (DR-2).
 */
export const LEGACY_FIXES_MINED: IdentityOptions = Object.freeze({
  grain: 'fine', cycleIdentity: 'edge-set', edgeOnly: false, renamePolicy: 'end',
  rePointed: false, merged: false, s02Cap: 100, leftCensor: 'grid-index-0',
} as const);

/** G08's proposal (`ops/notes/g08-violation-identity.md` §2): renames continue, RE-POINTED and MERGED on, edge-set cycles. */
export const G08_PROPOSED: IdentityOptions = Object.freeze({
  grain: 'fine', cycleIdentity: 'edge-set', edgeOnly: false, renamePolicy: 'continue',
  rePointed: true, merged: true, s02Cap: 100, leftCensor: 'first-valid',
} as const);

/**
 * Study 2's D as S2D-01 writes it (`ops/notes/s2d-01-study2-drift-design.md`): the edge key, a cycle as its sorted file
 * set, edges only, renames continue, prior union over step-final snapshots, steps 2..5, y1Min 1. Provisional (Q2, Q4).
 */
export const STUDY2_S2D01: DriftParams = Object.freeze({
  grain: 'edge', cycleIdentity: 'sorted-files', edgeOnly: true, renamePolicy: 'continue',
  rePointed: false, merged: false, s02Cap: 100, leftCensor: 'first-valid',
  kFrom: 2, kTo: 5, priorUnion: 'final-snapshots', y1Min: 1,
} as const);

/**
 * The pilot memo's identity (`Docs/v1.3/pilot-outcome-memo.md` §3, `findingIdentity` in `scripts/lib/loop/pilot-metrics.ts`),
 * with every turn of earlier steps in the prior union. Test only (D-8): the registered outcome keeps its own code.
 */
export const MEMO_COMPAT: DriftParams = Object.freeze({
  grain: 'memo', cycleIdentity: 'sorted-files', edgeOnly: false, renamePolicy: 'end',
  rePointed: false, merged: false, s02Cap: 100, leftCensor: 'first-valid',
  kFrom: 2, kTo: Number.MAX_SAFE_INTEGER, priorUnion: 'all-turns', y1Min: 1,
} as const);
