/**
 * SO1 metrics (ADR-021 SO1-E, X-7; FR-20; proposal SO1-3, SO1-4). Pure functions over typed records; the IO
 * (git history, spec parsing and compilation) lives in `scripts/so1-metrics.ts`.
 *
 * Operational definitions (registered by ADR-021 item 2, SO1; P-U6 hashes this file's consumer and the specs):
 * - **Validator first-pass rate** (per spec group): the share of specs whose *first committed version* passes the
 *   `validate` check of today's instrument (parse, schema, business rules as `validate` reports them, template refs,
 *   and compilation without errors). A spec never committed counts by its working-tree text. Reported with the
 *   Wilson 95 % interval. The current pass rate is reported beside it.
 * - **Template coverage per library** (per built-in style template): declared functions, the functions with a
 *   template (a Cypher template for a symbolic or hybrid function, a rubric for a neuronal one), and their share.
 *   Beside it, per spec style, compiled ÷ declared as a ratio of sums over the group's specs.
 * - **Spec line counts** (X-7): per spec, total, blank, comment-only and content lines. Content lines are the
 *   non-blank lines that are not only a YAML comment; the descriptive table summarises them by group.
 */
import { wilson } from './stats.js';
import type { Interval } from './stats.js';

export type SpecGroup = 'corpus' | 'fixture' | 'preset';
export const SPEC_GROUPS: readonly SpecGroup[] = Object.freeze(['corpus', 'fixture', 'preset']);

// ---------------------------------------------------------------------------------------------
// Line counts (X-7)

export interface LineCounts {
  readonly total: number;
  readonly blank: number;
  readonly comment: number;
  readonly content: number;
}

/**
 * Line counts of a YAML text. A final line without `\n` counts; an empty text has 0 lines. A comment line is one
 * whose first non-blank character is `#`; a line with content and a trailing comment is a content line.
 */
export function countSpecLines(text: string): LineCounts {
  if (text === '') return { total: 0, blank: 0, comment: 0, content: 0 };
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  let blank = 0;
  let comment = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t === '') blank++;
    else if (t.startsWith('#')) comment++;
  }
  return { total: lines.length, blank, comment, content: lines.length - blank - comment };
}

export interface Summary {
  readonly n: number;
  readonly min: number;
  readonly median: number;
  readonly mean: number;
  readonly max: number;
}

/** Five-number summary (n, min, median, mean, max); `null` for no values. Median of an even n is the midpoint mean. */
export function summarise(values: readonly number[]): Summary | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
  return { n: s.length, min: s[0] ?? 0, median, mean: s.reduce((a, b) => a + b, 0) / s.length, max: s[s.length - 1] ?? 0 };
}

// ---------------------------------------------------------------------------------------------
// Validation records and first-pass rate (SO1-E)

/** Outcome of the `validate` check on one version of a spec. */
export interface ValidationOutcome {
  readonly pass: boolean;
  /** Error messages (code-prefixed) when `pass` is false; empty otherwise. */
  readonly errors: readonly string[];
  /** Lower-cased `architecture.style`, `null` when absent or the spec does not parse. */
  readonly style: string | null;
  /** Declared functions after template resolution; `null` when the spec does not parse. */
  readonly declared: number | null;
  /** Compiled functions; `null` when the spec does not compile. */
  readonly compiled: number | null;
  /** Disabled functions (spec-disabled and applicability-disabled); `null` when the spec does not compile. */
  readonly disabled: number | null;
}

export interface SpecRecord {
  readonly path: string;
  readonly group: SpecGroup;
  readonly sha256: string;
  /** Commit that first added the file, `null` when the file is not committed. */
  readonly firstCommit: string | null;
  /** Commits that touched the file (0 when not committed). */
  readonly revisions: number;
  readonly lines: LineCounts;
  readonly first: ValidationOutcome;
  readonly current: ValidationOutcome;
}

export interface PassRate {
  readonly n: number;
  readonly passed: number;
  /** `passed / n`; `null` when `n` is 0. */
  readonly rate: number | null;
  readonly wilson95: Interval | null;
}

export function passRate(outcomes: readonly boolean[]): PassRate {
  const n = outcomes.length;
  const passed = outcomes.filter((x) => x).length;
  if (n === 0) return { n, passed, rate: null, wilson95: null };
  return { n, passed, rate: passed / n, wilson95: wilson(passed, n) };
}

// ---------------------------------------------------------------------------------------------
// Template coverage (SO1-E)

/** The fields of a declared function the coverage rule reads. */
export interface DeclaredFunction {
  readonly id: string;
  readonly name: string;
  readonly route: 'symbolic' | 'neuronal' | 'hybrid';
  readonly hasRubric: boolean;
}

export interface LibraryCoverage {
  readonly style: string;
  readonly declared: number;
  readonly withTemplate: number;
  /** `withTemplate / declared`; `null` when nothing is declared. */
  readonly share: number | null;
  /** Ids of the declared functions without a template, sorted. */
  readonly withoutTemplate: readonly string[];
}

/**
 * A function has a template when its route needs one and the instrument has it: a Cypher template by name for a
 * symbolic function, a rubric for a neuronal one, both for a hybrid one.
 */
export function hasTemplate(fn: DeclaredFunction, hasCypher: (name: string) => boolean): boolean {
  if (fn.route === 'symbolic') return hasCypher(fn.name);
  if (fn.route === 'neuronal') return fn.hasRubric;
  return hasCypher(fn.name) && fn.hasRubric;
}

export function libraryCoverage(style: string, functions: readonly DeclaredFunction[], hasCypher: (name: string) => boolean): LibraryCoverage {
  const without = functions.filter((f) => !hasTemplate(f, hasCypher)).map((f) => f.id).sort();
  const declared = functions.length;
  const withTemplate = declared - without.length;
  return { style, declared, withTemplate, share: declared === 0 ? null : withTemplate / declared, withoutTemplate: without };
}

export interface CompiledShare {
  readonly group: SpecGroup;
  readonly style: string;
  readonly specs: number;
  readonly declared: number;
  readonly compiled: number;
  readonly disabled: number;
  /** Σ compiled ÷ Σ declared over the specs that compile; `null` when Σ declared is 0. */
  readonly compiledShare: number | null;
}

/**
 * Compiled ÷ declared per (group, spec style), as a ratio of sums over the current versions that compile. A spec
 * without `architecture.style` falls in style `none`; a spec that does not compile is left out (it shows in the
 * current pass rate).
 */
export function compiledShares(records: readonly SpecRecord[]): CompiledShare[] {
  const acc = new Map<string, { group: SpecGroup; style: string; specs: number; declared: number; compiled: number; disabled: number }>();
  for (const r of records) {
    const c = r.current;
    if (c.declared === null || c.compiled === null || c.disabled === null) continue;
    const style = c.style ?? 'none';
    const key = `${r.group}\u0000${style}`;
    const a = acc.get(key) ?? { group: r.group, style, specs: 0, declared: 0, compiled: 0, disabled: 0 };
    a.specs++;
    a.declared += c.declared;
    a.compiled += c.compiled;
    a.disabled += c.disabled;
    acc.set(key, a);
  }
  return [...acc.values()]
    .map((a) => ({ ...a, compiledShare: a.declared === 0 ? null : a.compiled / a.declared }))
    .sort((x, y) => SPEC_GROUPS.indexOf(x.group) - SPEC_GROUPS.indexOf(y.group) || (x.style < y.style ? -1 : x.style > y.style ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// The SO1 table

export interface GroupMetrics {
  readonly group: SpecGroup;
  readonly firstPass: PassRate;
  readonly currentPass: PassRate;
  readonly contentLines: Summary | null;
  readonly totalLines: Summary | null;
  /** Error codes of the failing first versions, each counted once per spec (so a cause is attributable). */
  readonly firstFailureCodes: Readonly<Record<string, number>>;
}

/** The `[CODE]` prefixes of an outcome's errors, deduplicated and sorted; `UNCODED` for an error without one. */
export function errorCodes(outcome: ValidationOutcome): string[] {
  return [...new Set(outcome.errors.map((e) => /^\[([A-Z0-9_]+)\]/.exec(e)?.[1] ?? 'UNCODED'))].sort();
}

export function failureCodeCounts(outcomes: readonly ValidationOutcome[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of outcomes) {
    if (o.pass) continue;
    for (const code of errorCodes(o)) counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}

export interface So1Metrics {
  readonly commit: string;
  readonly specs: readonly SpecRecord[];
  readonly groups: readonly GroupMetrics[];
  readonly libraries: readonly LibraryCoverage[];
  readonly compiledShares: readonly CompiledShare[];
}

export function groupMetrics(records: readonly SpecRecord[]): GroupMetrics[] {
  return SPEC_GROUPS.map((group) => {
    const rs = records.filter((r) => r.group === group);
    return {
      group,
      firstPass: passRate(rs.map((r) => r.first.pass)),
      currentPass: passRate(rs.map((r) => r.current.pass)),
      contentLines: summarise(rs.map((r) => r.lines.content)),
      totalLines: summarise(rs.map((r) => r.lines.total)),
      firstFailureCodes: failureCodeCounts(rs.map((r) => r.first)),
    };
  });
}

export function so1Metrics(commit: string, records: readonly SpecRecord[], libraries: readonly LibraryCoverage[]): So1Metrics {
  const specs = [...records].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    commit,
    specs,
    groups: groupMetrics(specs),
    libraries: [...libraries].sort((a, b) => (a.style < b.style ? -1 : a.style > b.style ? 1 : 0)),
    compiledShares: compiledShares(specs),
  };
}
