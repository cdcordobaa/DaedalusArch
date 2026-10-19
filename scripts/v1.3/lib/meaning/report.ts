/**
 * MEAN-01 meaning analysis: Markdown and JSON rendering (design BR-43, BR-50 to BR-54).
 *
 * Markdown rounds to 3 decimals and prints an undefined figure as the word `undefined`; JSON keeps full precision,
 * with `null` for undefined and keys sorted. Neither output carries a time, a host name, an absolute path or a note.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CODE_COLUMNS, CROSS_CATEGORIES } from './crosstab.js';
import type { AgreementBlock, BootInterval, MeaningAnalysis, PrecisionBlock, PrecisionRow, SimpleInterval } from './types.js';

export const SYNTHETIC_BANNER = 'SYNTHETIC: simulated answer sheets, not labels';
export const NON_PROTOCOL = 'NON-PROTOCOL: seed or resamples differ from codebook §4.7';
export const PREVALENCE_NOTE = 'κ fails while AC1 passes under extreme prevalence (§4.8); the gate stays failed';
export const SINGLE_RATER_AUTHOR = 'single-rater, descriptive, not validated';
export const SINGLE_RATER_RATER = 'single-rater: agreement not computed';

/** BR-53: a repo-relative path, or `<outside repo>/<basename>` for a file outside the repo. */
/**
 * The physical path: the deepest existing ancestor is resolved with realpath (so a symlinked route into the repo
 * and the physical path agree), and the not-yet-existing tail is appended unchanged.
 */
export function physicalPath(p: string): string {
  let head = path.resolve(p);
  const tail: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(head), ...tail);
    } catch {
      const parent = path.dirname(head);
      if (parent === head) return path.join(head, ...tail);
      tail.unshift(path.basename(head));
      head = parent;
    }
  }
}

export function displayPath(absPath: string, repoRoot: string): string {
  const rel = path.relative(physicalPath(repoRoot), physicalPath(absPath));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return `<outside repo>/${path.basename(absPath)}`;
  return rel.split(path.sep).join('/');
}

/** BR-51: 3 decimals, `undefined` as a word, no `-0.000`. */
export function fmt(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'undefined';
  const s = x.toFixed(3);
  return s === '-0.000' ? '0.000' : s;
}
const iv = (i: SimpleInterval | null | undefined): string => (i === null || i === undefined ? 'undefined' : `[${fmt(i.low)}, ${fmt(i.high)}]`);
const biv = (b: BootInterval | null): string => (b === null || b.low === null || b.high === null ? 'undefined' : `[${fmt(b.low)}, ${fmt(b.high)}]`);
const bootNote = (b: BootInterval | null): string =>
  b === null ? 'not computed (n = 0)' : `${b.method}, seed ${b.seed}, ${b.resamples} resamples, ${b.undefinedResamples} undefined, ${b.resamplesWithEmptyStratum} with an empty stratum`;
const list = (xs: readonly string[]): string => (xs.length === 0 ? 'none' : xs.join(', '));

export function statusLine(a: MeaningAnalysis): string {
  let s: string;
  if (a.agreement === null) s = a.mode === 'single-rater-author' ? SINGLE_RATER_AUTHOR : SINGLE_RATER_RATER;
  else {
    const p = a.agreement.primary;
    s = p.result === 'INCOMPLETE'
      ? `INCOMPLETE (below protocol): n = ${p.n} < ${a.config.minN}; κ = ${fmt(p.kappa)} on ${p.field}`
      : `gate ${p.result}: κ = ${fmt(p.kappa)} on ${p.field} (gate κ ≥ ${a.config.gate.toFixed(2)})`;
  }
  return `**Status:** ${s}${a.protocol ? '' : `. ${NON_PROTOCOL}`}`;
}

function agreementSection(title: string, b: AgreementBlock, minN: number): string[] {
  const t = b.table;
  const out = [
    `## ${title}`, '',
    `Field \`${b.field}\`, ${b.gated ? 'gated (primary)' : 'not gated (secondary)'}. Units: ${b.n} items both raters answered; dropped ${b.dropped.length} (${list(b.dropped)}).${b.incomplete ? ` INCOMPLETE (below protocol): n < ${minN}.` : ''}`, '',
    `Result: ${b.result}${b.gated ? '' : ' (not gated)'}.`, '',
    '| rater \\ author | yes | not yes |', '|---|---:|---:|',
    `| yes | ${t.a} | ${t.b} |`, `| not yes | ${t.c} | ${t.d} |`, '',
    '| statistic | value |', '|---|---|',
    `| Cohen's κ (binary) | ${fmt(b.kappa)} |`,
    `| κ 95 % item bootstrap (reported, not gated) | ${biv(b.kappaItemInterval)} |`,
    `| κ 95 % stratified project-cluster bootstrap (sensitivity) | ${biv(b.kappaClusterInterval)} |`,
    `| observed agreement p_o | ${fmt(b.observed)} |`,
    `| p_o Wilson 95 % | ${iv(b.observedInterval)} |`,
    `| Gwet's AC1 (binary) | ${fmt(b.ac1)} |`,
    `| prevalence index abs(a − d) / n | ${fmt(b.prevalenceIndex)} |`,
    `| bias index abs(b − c) / n | ${fmt(b.biasIndex)} |`,
    `| PABAK (descriptive) | ${fmt(b.pabak)} |`,
    `| three-way κ (descriptive) | ${fmt(b.kappa3)} |`,
    `| κ without unsure items (descriptive) | ${fmt(b.noUnsure.kappa)} (n = ${b.noUnsure.n}) |`,
    '',
    `Bootstrap: item (${bootNote(b.kappaItemInterval)}); cluster (${bootNote(b.kappaClusterInterval)}).`, '',
  ];
  if (b.prevalenceNote) out.push(PREVALENCE_NOTE, '');
  out.push('Three-way table (rows rater, columns author):', '', '| rater \\ author | yes | no | unsure |', '|---|---:|---:|---:|',
    ...['yes', 'no', 'unsure'].map((c, i) => `| ${c} | ${(b.table3[i] ?? []).join(' | ')} |`), '');
  out.push('| unsure rate | unsure / answered | rate | flag |', '|---|---:|---:|---|',
    ...(['rater', 'author'] as const).map((r) => {
      const u = b.unsure[r];
      return `| ${r} | ${u.unsure} / ${u.answered} | ${fmt(u.rate)} | ${u.flagged ? 'codebook problem (> 0.15)' : '-'} |`;
    }), '');
  out.push('Binary counts by style:', '', '| style | n | a both yes | b rater yes | c author yes | d both not |', '|---|---:|---:|---:|---:|---:|',
    ...b.byStyle.map((s) => `| ${s.style} | ${s.n} | ${s.a} | ${s.b} | ${s.c} | ${s.d} |`), '');
  return out;
}

const precRow = (r: PrecisionRow): string =>
  `| ${r.label} | ${r.n} | ${r.yes} | ${fmt(r.estimate)} | ${biv(r.interval)} | ${r.frameUsed} | ${list(r.emptyStrata)} |`;

function precisionSection(title: string, p: PrecisionBlock): string[] {
  const h = p.headline;
  return [
    `## ${title}`, '',
    `Field \`${p.field}\`; reference: the ${p.reference}'s labels. Blank items dropped: ${p.blank.length} (${list(p.blank)}).`, '',
    '| row | n answered | yes | p̂ stratified | 95 % stratified cluster bootstrap | N\' | strata left out |', '|---|---:|---:|---:|---|---:|---|',
    precRow(h), ...p.sensitivities.map(precRow), '',
    p.notApplicable.length > 0 ? `Not applicable with one sheet: ${p.notApplicable.join('; ')}.\n` : '',
    `Unweighted share (descriptive): ${fmt(p.unweighted.share)}, Wilson 95 % ${iv(p.unweighted.wilson)}. Kish effective n: ${fmt(p.kishN)}.`, '',
    `Strata with a single project cluster (no bootstrap variance, so the interval is narrower than the design's true uncertainty there): ${p.singleClusterStrata.length} (${list(p.singleClusterStrata)}).`, '',
    `Headline bootstrap: ${bootNote(h.interval)}.`, '',
    'Per rule (unweighted share; Wilson 95 % only for n ≥ 10, counts only otherwise):', '',
    '| rule | yes | no | unsure | blank | n | unweighted share | Wilson 95 % |', '|---|---:|---:|---:|---:|---:|---:|---|',
    ...p.perRule.map((r) => `| ${r.ruleId} | ${r.yes} | ${r.no} | ${r.unsure} | ${r.blank} | ${r.n} | ${r.share === null ? 'counts only' : fmt(r.share)} | ${r.wilson === null ? 'counts only' : iv(r.wilson)} |`), '',
    'Per style (counts only):', '', '| style | yes | no | unsure | blank |', '|---|---:|---:|---:|---:|',
    ...p.perStyle.map((s) => `| ${s.style} | ${s.yes} | ${s.no} | ${s.unsure} | ${s.blank} |`), '',
    `Reading guide (§9.5, p̂ = ${fmt(h.estimate)}, lower bound ${fmt(h.interval.low)}): ${p.readingText}.`, '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));
}

/** BR-50: the Markdown report, in the fixed section order. */
export function renderMarkdown(a: MeaningAnalysis): string {
  const md: string[] = [];
  if (a.synthetic) md.push(SYNTHETIC_BANNER, '');
  md.push('# MEAN-01 meaning analysis (C3m)', '',
    '| input | path | sha256 |', '|---|---|---|',
    `| sample | ${a.inputs.sample.path} | ${a.inputs.sample.sha256} |`,
    `| rater sheet | ${a.inputs.rater?.path ?? 'not given'} | ${a.inputs.rater?.sha256 ?? '-'} |`,
    `| author sheet | ${a.inputs.author?.path ?? 'not given'} | ${a.inputs.author?.sha256 ?? '-'} |`,
    ...a.scriptHashes.map((h) => `| script | ${h.path} | ${h.sha256} |`), '',
    `Sample: ${a.inputs.sample.items} items, ${a.inputs.sample.strata} strata, frame N = ${a.inputs.sample.frameN}. Seed ${a.config.seed}, ${a.config.resamples} resamples.`, '',
    `L4 primary field (from --primary): \`${a.config.primary}\`; secondary: \`${a.config.secondary}\`.`, '',
    statusLine(a), '');
  if (a.agreement === null) {
    md.push('## 1. Agreement, primary field', '', `Agreement not computed: ${a.mode === 'single-rater-author' ? SINGLE_RATER_AUTHOR : SINGLE_RATER_RATER}.`, '',
      '## 2. Agreement, secondary field', '', 'Agreement not computed.', '');
  } else {
    md.push(...agreementSection('1. Agreement, primary field', a.agreement.primary, a.config.minN));
    md.push(...agreementSection('2. Agreement, secondary field (not gated)', a.agreement.secondary, a.config.minN));
  }
  md.push(...precisionSection('3. Meaningful precision, primary field', a.precision.primary));
  md.push(...precisionSection('4. Secondary field (not the headline)', a.precision.secondary));
  md.push('## 5. A × B table', '');
  for (const c of a.crosstab) {
    md.push(`${c.role === 'rater' ? "Rater's" : "Author's"} A (rows) by B (columns)${c.role === 'author' ? ', descriptive' : ''}:`, '',
      `| A \\ B | ${CROSS_CATEGORIES.join(' | ')} |`, `|---|${CROSS_CATEGORIES.map(() => '---:').join('|')}|`,
      ...CROSS_CATEGORIES.map((r, i) => `| ${r} | ${(c.table[i] ?? []).join(' | ')} |`), '',
      `B = yes, A = no: ${c.bYesANo} items (rules encode the literature, not practice).`, '',
      `A = yes, B = no: ${c.aYesBNo} items (practitioners object to more than the literature states).`, '');
  }
  const rc = a.reasonCodes;
  md.push('## 6. Reason codes', '', `Among the ${rc.role}'s ${rc.items} items where A or B is no:`, '',
    `| rule | items | ${CODE_COLUMNS.join(' | ')} |`, `|---|---:|${CODE_COLUMNS.map(() => '---:').join('|')}|`,
    `| pooled | ${rc.items} | ${CODE_COLUMNS.map((k) => rc.pooled[k]).join(' | ')} |`,
    ...rc.perRule.map((r) => `| ${r.ruleId} | ${r.items} | ${CODE_COLUMNS.map((k) => r[k]).join(' | ')} |`), '');
  md.push('## 7. Dropped items and warnings', '');
  if (a.agreement !== null) {
    md.push(`- Agreement, ${a.agreement.primary.field}: dropped ${list(a.agreement.primary.dropped)}.`,
      `- Agreement, ${a.agreement.secondary.field}: dropped ${list(a.agreement.secondary.dropped)}.`);
  }
  md.push(`- Precision, ${a.precision.primary.field}: blank ${list(a.precision.primary.blank)}.`,
    `- Precision, ${a.precision.secondary.field}: blank ${list(a.precision.secondary.blank)}.`,
    `- Notes in the sheets (counted, never copied, BR-53): rater ${a.notes.rater}, author ${a.notes.author}.`,
    ...a.warnings.map((w) => `- Warning: ${w}`), '');
  return md.join('\n');
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortDeep(o[k])]));
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}

/** BR-43: full precision, keys sorted, `null` for undefined. */
export function renderJson(a: MeaningAnalysis): string {
  return `${JSON.stringify(sortDeep(a), null, 1)}\n`;
}
