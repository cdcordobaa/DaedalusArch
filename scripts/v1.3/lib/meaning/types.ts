/**
 * MEAN-01 meaning analysis (C3m): data contracts (design `aidlc-docs/construction/v1.4/U7/functional-design/design.md`
 * §3; codebook `ops/notes/mean-01-codebook-and-sample.md` §4, §9).
 *
 * In the JSON output an undefined statistic is `null` (JSON has no `undefined`); the Markdown prints it as the word
 * `undefined` (BR-51). No `NaN` ever leaves the library.
 */

export type Answer = 'yes' | 'no' | 'unsure';
export const ANSWERS: readonly Answer[] = ['yes', 'no', 'unsure'];

export type ReasonCode = 'T' | 'W' | 'F' | 'M' | 'C' | 'X';
export const REASON_CODES: readonly ReasonCode[] = ['T', 'W', 'F', 'M', 'C', 'X'];

export type Field = 'A_practitioner' | 'B_style_fidelity';
export const FIELDS: readonly Field[] = ['A_practitioner', 'B_style_fidelity'];

export const otherField = (f: Field): Field => (f === 'A_practitioner' ? 'B_style_fidelity' : 'A_practitioner');

/** Codebook protocol constants (§4.5, §4.6, §4.7, §6, §9.2). */
export const PROTOCOL = {
  seed: 20261018,
  resamples: 10_000,
  frameN: 784,
  items: 60,
  minN: 54,
  gate: 0.6,
} as const;

/** Tolerance of every threshold comparison (BR-14, BR-28). */
export const EPS = 1e-9;

/** One row of `mean-01-sample.csv`. */
export interface SampleItem {
  readonly itemId: string;
  readonly findingId: string;
  readonly stratum: string;
  readonly Nh: number;
  readonly nh: number;
  readonly project: string;
  readonly style: string;
  readonly ruleId: string;
  readonly wave: number;
  readonly testOrMock: boolean;
  readonly cycleViaBarrel: boolean;
}

export interface Sample {
  readonly sha256: string;
  /** Sorted by itemId. */
  readonly items: readonly SampleItem[];
  /** Sorted stratum names. */
  readonly strata: readonly string[];
  readonly frameN: number;
}

/** One row of an answer sheet. `null` = blank. */
export interface AnswerRow {
  readonly itemId: string;
  readonly rater: string;
  readonly A: Answer | null;
  readonly B: Answer | null;
  readonly whyNot: ReasonCode | null;
  readonly note: string;
}

export type Role = 'rater' | 'author';

export interface Sheet {
  readonly role: Role;
  /** Display path (repo-relative, or `<outside repo>/<basename>`). */
  readonly path: string;
  readonly sha256: string;
  readonly rows: ReadonlyMap<string, AnswerRow>;
  readonly simulated: boolean;
  readonly warnings: readonly string[];
}

export interface AnalysisConfig {
  /** L4, from --primary (required, no default). */
  readonly primary: Field;
  readonly seed: number;
  readonly resamples: number;
  readonly frameN: number;
  readonly minN: number;
  readonly gate: number;
}

export const answerOf = (row: AnswerRow | undefined, field: Field): Answer | null =>
  row === undefined ? null : field === 'A_practitioner' ? row.A : row.B;

/** A bootstrap percentile interval; `low`/`high` are `null` when no resample was defined (BR-42). */
export interface BootInterval {
  readonly method: 'item' | 'stratified-cluster';
  readonly seed: number;
  readonly resamples: number;
  readonly low: number | null;
  readonly high: number | null;
  readonly definedResamples: number;
  readonly undefinedResamples: number;
  readonly resamplesWithEmptyStratum: number;
}

export interface SimpleInterval {
  readonly low: number;
  readonly high: number;
}

export type GateResult = 'PASS' | 'FAIL' | 'INCOMPLETE';

export interface UnsureRate {
  readonly unsure: number;
  readonly answered: number;
  readonly rate: number | null;
  /** rate > 0.15 (§4.4): "codebook problem"; never changes the gate. */
  readonly flagged: boolean;
}

export interface StyleCounts2x2 {
  readonly style: string;
  readonly n: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** Agreement on one field (BR-10 to BR-19). Table cells: a both yes, b rater yes / author not, c rater not / author yes, d both not. */
export interface AgreementBlock {
  readonly field: Field;
  readonly gated: boolean;
  readonly n: number;
  readonly dropped: readonly string[];
  readonly incomplete: boolean;
  readonly result: GateResult;
  readonly table: { readonly a: number; readonly b: number; readonly c: number; readonly d: number };
  readonly kappa: number | null;
  readonly kappaItemInterval: BootInterval | null;
  readonly kappaClusterInterval: BootInterval | null;
  readonly observed: number | null;
  readonly observedInterval: SimpleInterval | null;
  readonly ac1: number | null;
  readonly prevalenceIndex: number | null;
  readonly biasIndex: number | null;
  readonly pabak: number | null;
  /** Rows rater, columns author, categories yes / no / unsure. */
  readonly table3: readonly (readonly number[])[];
  readonly kappa3: number | null;
  readonly prevalenceNote: boolean;
  readonly unsure: { readonly rater: UnsureRate; readonly author: UnsureRate };
  readonly noUnsure: { readonly n: number; readonly kappa: number | null };
  readonly byStyle: readonly StyleCounts2x2[];
}

export interface PrecisionRow {
  readonly label: string;
  readonly n: number;
  readonly yes: number;
  readonly estimate: number | null;
  readonly frameUsed: number;
  readonly emptyStrata: readonly string[];
  readonly interval: BootInterval;
}

export interface Counts4 {
  readonly yes: number;
  readonly no: number;
  readonly unsure: number;
  readonly blank: number;
}

export interface RuleRow extends Counts4 {
  readonly ruleId: string;
  readonly n: number;
  /** Unweighted yes share and Wilson 95 %, only when n >= MIN_INTERVAL_N (BR-26). */
  readonly share: number | null;
  readonly wilson: SimpleInterval | null;
}

export type ReadingKey = 'meaningful' | 'rival' | 'mixed' | 'not-applicable';

export interface PrecisionBlock {
  readonly field: Field;
  readonly reference: Role;
  /** Items blank in the reference sheet on this field, dropped from the headline (BR-21). */
  readonly blank: readonly string[];
  readonly headline: PrecisionRow;
  readonly unweighted: { readonly share: number | null; readonly wilson: SimpleInterval | null };
  readonly kishN: number | null;
  readonly singleClusterStrata: readonly string[];
  readonly sensitivities: readonly PrecisionRow[];
  readonly notApplicable: readonly string[];
  readonly perRule: readonly RuleRow[];
  readonly perStyle: readonly (Counts4 & { readonly style: string })[];
  readonly reading: ReadingKey;
  readonly readingText: string;
}

export interface CrossTab {
  readonly role: Role;
  /** Rows A, columns B, both in order yes / no / unsure / blank. */
  readonly table: readonly (readonly number[])[];
  readonly bYesANo: number;
  readonly aYesBNo: number;
}

export interface ReasonCounts {
  readonly role: Role;
  readonly items: number;
  readonly pooled: Readonly<Record<ReasonCode | 'blank', number>>;
  readonly perRule: readonly ({ readonly ruleId: string; readonly items: number } & Readonly<Record<ReasonCode | 'blank', number>>)[];
}

export interface FileHash {
  readonly path: string;
  readonly sha256: string;
}

export type RunMode = 'two-rater' | 'single-rater-author' | 'single-rater-rater';

export interface MeaningAnalysis {
  readonly synthetic: boolean;
  readonly protocol: boolean;
  readonly mode: RunMode;
  readonly status: GateResult | 'single-rater';
  readonly config: AnalysisConfig & { readonly secondary: Field };
  readonly inputs: {
    readonly sample: { readonly path: string; readonly sha256: string; readonly items: number; readonly strata: number; readonly frameN: number };
    readonly rater: { readonly path: string; readonly sha256: string } | null;
    readonly author: { readonly path: string; readonly sha256: string } | null;
  };
  readonly scriptHashes: readonly FileHash[];
  readonly agreement: { readonly primary: AgreementBlock; readonly secondary: AgreementBlock } | null;
  readonly precision: { readonly primary: PrecisionBlock; readonly secondary: PrecisionBlock };
  readonly crosstab: readonly CrossTab[];
  readonly reasonCodes: ReasonCounts;
  readonly notes: { readonly rater: number; readonly author: number };
  readonly warnings: readonly string[];
}
