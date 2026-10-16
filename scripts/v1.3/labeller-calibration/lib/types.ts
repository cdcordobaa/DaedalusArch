/**
 * v1.3 labeller calibration (Docs/v1.3/labeller-calibration-plan.md): shared types.
 *
 * An item is one human-labelled unit of code from a published dataset (a class or a method), with every human rating
 * the dataset gives for it, already mapped to our binary scale (`fail` = the code shows the problem, `pass` = it does
 * not). The original rating is kept next to the mapped one so the mapping can be audited.
 */

export type DatasetId = 'mlcq' | 'dacos';
export const DATASET_IDS: readonly DatasetId[] = ['mlcq', 'dacos'];

/** Our binary label: the judge's `pass` flag inverted to "the problem is present". */
export type Binary = 'fail' | 'pass';

export interface HumanRating {
  /** Rater id as published (anonymised in the dataset); `consensus` when the dataset gives only an aggregate. */
  readonly rater: string;
  /** The dataset's own value, verbatim. */
  readonly original: string;
  /** Mapped to our scale; null when the original value has no mapping (excluded from scoring, counted). */
  readonly binary: Binary | null;
  /** Ordinal position on the dataset's scale (0 = none), when the scale is ordinal. */
  readonly ordinal?: number;
}

export interface CodeLocation {
  /** `https://github.com/<owner>/<repo>` (no `.git`). */
  readonly repository: string;
  readonly commit: string;
  /** Repository-relative path. */
  readonly path: string;
  /** 1-based, inclusive; absent when the unit is the whole file. */
  readonly startLine?: number;
  readonly endLine?: number;
}

export interface CalibrationItem {
  /** `<dataset>:<dataset's own sample id>`. */
  readonly id: string;
  readonly dataset: DatasetId;
  /** Task key into `TASKS` (one per smell). */
  readonly task: string;
  readonly unitKind: 'class' | 'method';
  /** Class or method name as published. */
  readonly unitName: string;
  readonly language: 'java' | 'javascript';
  readonly location?: CodeLocation;
  /** Entry of the dataset's code archive holding the unit (DACOS `files.zip`). */
  readonly archiveEntry?: string;
  readonly ratings: readonly HumanRating[];
}

/** One item with its code resolved: what the prompt is built from. */
export interface ResolvedItem extends CalibrationItem {
  readonly code: string;
  readonly codeSha256: string;
  /** Path shown to the rater (repository-relative or the dataset's file name). */
  readonly displayPath: string;
}

export type Arm = 'judge' | 'labeller';
export const ARMS: readonly Arm[] = ['judge', 'labeller'];

export type RaterId = 'claude' | 'gemini' | 'fake-claude' | 'fake-gemini';

export interface RaterLabel {
  readonly itemId: string;
  readonly rater: RaterId;
  readonly model: string;
  readonly arm: Arm;
  /** Mapped to our binary scale; null = invalid or (labeller) `uncertain`. */
  readonly binary: Binary | null;
  /** The arm's own label: judge `fail`/`pass`/`invalid`; labeller `yes`/`no`/`uncertain`. */
  readonly raw: string;
  /**
   * The procedure failed rather than answered: judge `invalid` (fewer than 2 valid runs, or the one Gemini run
   * invalid); labeller `invalid-run`. A judge 1-1 split (`warning`) and a labeller `uncertain` from two disagreeing
   * runs are answers without a binary label (abstentions), not failures.
   */
  readonly procedureFailure: boolean;
  /** Judge confidence of the majority verdict, when given. */
  readonly confidence?: number;
  readonly runs: readonly { readonly runIndex: number; readonly raw: string; readonly cassetteKey: string; readonly reasked: boolean }[];
}
