/**
 * The option sets of the v1.3 options-effects run (Docs/DiagnosticRuns/v1.3-options-effects-2026-10-16.md).
 * Only the advisory post-filters of `src/advisory-filter` are options here: the blind-misses and default-view-coverage
 * units added no extractor option, and construct switches (src/construct-switches) are deliberately left out.
 */
import { ADVISORY_FILTER_OPTIONS } from '../../../src/advisory-filter/advisory-filter.js';

export interface OptionSet {
  /** Directory and table name. */
  readonly name: string;
  /** The `--advisory-filter` value. */
  readonly filter: string;
}

/** The advisory-noise report's "proposed" set (its §4): every option except cv05-no-branching and cv05-rollup. */
export const PROPOSED = ['cv05-no-logic', 'composition-roots', 'c03-core-only', 'c02-abstract-imports', 'c04-entry-points', 'so-framework-members'] as const;

export const OPTION_SETS: readonly OptionSet[] = [
  { name: 'none', filter: 'none' },
  ...ADVISORY_FILTER_OPTIONS.map((o) => ({ name: o, filter: o })),
  { name: 'all', filter: 'all' },
  { name: 'proposed', filter: PROPOSED.join(',') },
];
