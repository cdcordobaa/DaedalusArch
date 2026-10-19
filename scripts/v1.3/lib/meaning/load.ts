/**
 * MEAN-01 meaning analysis: load and validate the sample and the answer sheets (design BR-01 to BR-09).
 *
 * Pure: every function takes file text and returns typed records, or throws `MeaningInputError` listing every
 * problem found. The shape check (BR-09) runs first with a strict tokenizer that follows `parseCsv`'s quoting rules,
 * so `parseCsv` (which pads short rows and drops extra cells) only ever sees rows of the right width.
 */
import { createHash } from 'node:crypto';
import { parseCsv } from '../labelling/audit.js';
import type { Answer, AnswerRow, FileHash, ReasonCode, Role, Sample, SampleItem, Sheet } from './types.js';
import { ANSWERS, PROTOCOL, REASON_CODES } from './types.js';

export class MeaningInputError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`meaning input error:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'MeaningInputError';
    this.problems = problems;
  }
}

export const SAMPLE_HEADER = [
  'itemId', 'findingId', 'stratum', 'N_h', 'n_h', 'weight', 'wave', 'project', 'repo', 'sha', 'root', 'style', 'ruleId',
  'template', 'file', 'line', 'target', 'cycleViaBarrel', 'testOrMock', 'message', 'checkerReason',
] as const;
export const SHEET_HEADER = ['itemId', 'rater', 'A_practitioner', 'B_style_fidelity', 'why_not', 'note'] as const;

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** U+FEFF, the UTF-8 byte-order mark a spreadsheet export can put before the header. */
const BOM = String.fromCharCode(0xfeff);
const stripBom = (text: string): string => (text.startsWith(BOM) ? text.slice(1) : text);

interface CsvRow { readonly line: number; readonly cells: readonly string[] }

/**
 * Strict tokenizer (BR-09): the quoting rules of `parseCsv` (a `"` opens a quoted run, `""` inside it is a quote,
 * newlines inside quotes belong to the cell), but every row keeps its own cell count and its starting line number.
 * Rows whose cells are all blank are skipped, as `parseCsv` does.
 */
export function tokenizeCsv(text: string, label: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endRow = (): void => {
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push({ line: rowLine, cells: row });
    row = [];
    cell = '';
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false;
      else {
        if (ch === '\n') line += 1;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
      line += 1;
      rowLine = line;
    } else cell += ch;
  }
  if (quoted) throw new MeaningInputError([`${label}: line ${rowLine}: unterminated quoted cell`]);
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

/** BR-09: exact header and exact cell count per row. Returns the text without BOM, ready for `parseCsv`. */
function checkShape(text: string, header: readonly string[], label: string): { text: string; lines: Map<number, number> } {
  const clean = stripBom(text);
  const rows = tokenizeCsv(clean, label);
  const problems: string[] = [];
  const first = rows[0];
  if (first === undefined) throw new MeaningInputError([`${label}: empty file (no header)`]);
  const got = first.cells.map((c) => c.trim());
  if (got.length === 1 && header.length > 1) {
    const sep = (got[0] ?? '').includes(';') ? " (it contains ';': a ';'-separated export, e.g. from a Spanish-locale spreadsheet; save as comma-separated CSV)" : '';
    problems.push(`${label}: line ${first.line}: one-column header${sep}; expected ${header.join(',')}`);
  } else if (got.length !== header.length || got.some((h, i) => h !== header[i])) {
    problems.push(`${label}: line ${first.line}: header is "${got.join(',')}"; expected exactly "${header.join(',')}"`);
  }
  if (problems.length > 0) throw new MeaningInputError(problems);
  // Data row index (0-based, as parseCsv returns them) -> line number.
  const lines = new Map<number, number>();
  rows.slice(1).forEach((r, i) => {
    lines.set(i, r.line);
    if (r.cells.length !== header.length) {
      problems.push(`${label}: line ${r.line}: ${r.cells.length} cells, expected ${header.length} (an unquoted comma in a cell, or a missing column)`);
    }
  });
  if (problems.length > 0) throw new MeaningInputError(problems);
  return { text: clean, lines };
}

const isCalibrationId = (id: string): boolean => /^C\d+$/i.test(id);

function parseFlag(v: string, col: string, where: string, problems: string[]): boolean {
  if (v === 'True') return true;
  if (v === 'False') return false;
  problems.push(`${where}: ${col} is "${v}"; expected exactly True or False`);
  return false;
}

function parsePositiveInt(v: string, col: string, where: string, problems: string[]): number {
  if (!/^\d+$/.test(v) || Number(v) <= 0) {
    problems.push(`${where}: ${col} is "${v}"; expected a positive integer`);
    return 0;
  }
  return Number(v);
}

export interface SampleExpectations {
  /** Σ_h N_h (codebook §6: 784). */
  readonly frameN?: number;
  /** Item count (codebook §6: 60). */
  readonly items?: number;
  /** --expect-sample-sha256: full hex, or a prefix of at least 16 hex digits. */
  readonly expectSha256?: string;
}

/** BR-01: parse and check the sample (the key). Weights always come from the integer N_h and n_h columns. */
export function loadSample(text: string, label: string, expect: SampleExpectations = {}): Sample {
  const frameN = expect.frameN ?? PROTOCOL.frameN;
  const itemsExpected = expect.items ?? PROTOCOL.items;
  const hash = sha256(text);
  if (expect.expectSha256 !== undefined) {
    const want = expect.expectSha256.trim().toLowerCase();
    if (!/^[0-9a-f]{16,64}$/.test(want)) throw new MeaningInputError([`--expect-sample-sha256: "${expect.expectSha256}" is not 16 to 64 hex digits`]);
    if (!hash.startsWith(want)) throw new MeaningInputError([`${label}: sha256 ${hash} does not match the expected ${want}`]);
  }
  const { text: clean, lines } = checkShape(text, SAMPLE_HEADER, label);
  const records = parseCsv(clean);
  const problems: string[] = [];
  const items: SampleItem[] = [];
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const where = `${label}: line ${lines.get(i) ?? '?'}`;
    const itemId = r['itemId'] ?? '';
    if (itemId === '') problems.push(`${where}: empty itemId`);
    else if (seen.has(itemId)) problems.push(`${where}: duplicate itemId ${itemId}`);
    seen.add(itemId);
    const wave = parsePositiveInt(r['wave'] ?? '', 'wave', where, problems);
    const item: SampleItem = {
      itemId,
      findingId: r['findingId'] ?? '',
      stratum: r['stratum'] ?? '',
      Nh: parsePositiveInt(r['N_h'] ?? '', 'N_h', where, problems),
      nh: parsePositiveInt(r['n_h'] ?? '', 'n_h', where, problems),
      project: r['project'] ?? '',
      style: r['style'] ?? '',
      ruleId: r['ruleId'] ?? '',
      wave,
      testOrMock: parseFlag(r['testOrMock'] ?? '', 'testOrMock', where, problems),
      cycleViaBarrel: parseFlag(r['cycleViaBarrel'] ?? '', 'cycleViaBarrel', where, problems),
    };
    for (const col of ['stratum', 'project', 'style', 'ruleId'] as const) {
      if (item[col] === '') problems.push(`${where}: item ${itemId}: empty ${col}`);
    }
    items.push(item);
  });
  if (items.length !== itemsExpected) problems.push(`${label}: ${items.length} items; expected ${itemsExpected}`);
  const byStratum = new Map<string, SampleItem[]>();
  for (const it of items) byStratum.set(it.stratum, [...(byStratum.get(it.stratum) ?? []), it]);
  let sumN = 0;
  let sumn = 0;
  for (const [s, its] of [...byStratum.entries()].sort(([a], [b]) => cmp(a, b))) {
    const Ns = new Set(its.map((x) => x.Nh));
    const ns = new Set(its.map((x) => x.nh));
    if (Ns.size !== 1) problems.push(`${label}: stratum ${s}: N_h is not constant (${[...Ns].join(', ')})`);
    if (ns.size !== 1) problems.push(`${label}: stratum ${s}: n_h is not constant (${[...ns].join(', ')})`);
    const nh = its[0]?.nh ?? 0;
    const Nh = its[0]?.Nh ?? 0;
    if (its.length !== nh) problems.push(`${label}: stratum ${s}: ${its.length} rows but n_h = ${nh}`);
    if (Nh < nh) problems.push(`${label}: stratum ${s}: N_h = ${Nh} < n_h = ${nh}`);
    sumN += Nh;
    sumn += nh;
  }
  if (sumN !== frameN) problems.push(`${label}: Σ N_h = ${sumN}; expected ${frameN}`);
  if (sumn !== itemsExpected) problems.push(`${label}: Σ n_h = ${sumn}; expected ${itemsExpected}`);
  if (problems.length > 0) throw new MeaningInputError(problems);
  return {
    sha256: hash,
    items: [...items].sort((a, b) => cmp(a.itemId, b.itemId)),
    strata: [...byStratum.keys()].sort(cmp),
    frameN: sumN,
  };
}

/** Code-point string order, independent of locale (BR-43). */
export const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Strata whose sampled items all come from one project: they add no variance to the cluster bootstrap (BR-23). */
export function singleClusterStrata(items: readonly SampleItem[]): string[] {
  const projects = new Map<string, Set<string>>();
  for (const it of items) projects.set(it.stratum, (projects.get(it.stratum) ?? new Set()).add(it.project));
  return [...projects.entries()].filter(([, p]) => p.size === 1).map(([s]) => s).sort(cmp);
}

const answerValue = (raw: string): Answer | null | undefined => {
  const v = raw.trim().toLowerCase();
  if (v === '') return null;
  return (ANSWERS as readonly string[]).includes(v) ? (v as Answer) : undefined;
};

/** BR-02 to BR-05, BR-09: parse and check one answer sheet against the sample. */
export function loadSheet(text: string, role: Role, label: string, sample: Sample): Sheet {
  const { text: clean, lines } = checkShape(text, SHEET_HEADER, label);
  const records = parseCsv(clean);
  const ids = new Set(sample.items.map((x) => x.itemId));
  const problems: string[] = [];
  const warnings: string[] = [];
  const rows = new Map<string, AnswerRow>();
  const raters = new Set<string>();
  let simulated = false;
  records.forEach((r, i) => {
    const where = `${label}: line ${lines.get(i) ?? '?'}`;
    const itemId = r['itemId'] ?? '';
    if (isCalibrationId(itemId)) { problems.push(`${where}: item ${itemId} is a calibration item; calibration items never count (§4.3)`); return; }
    if (!ids.has(itemId)) { problems.push(`${where}: item ${itemId === '' ? '(empty id)' : itemId} is not in the sample`); return; }
    if (rows.has(itemId)) { problems.push(`${where}: item ${itemId} appears twice`); return; }
    const A = answerValue(r['A_practitioner'] ?? '');
    const B = answerValue(r['B_style_fidelity'] ?? '');
    if (A === undefined) problems.push(`${where}: item ${itemId}: A_practitioner is "${r['A_practitioner'] ?? ''}"; expected yes, no, unsure or blank`);
    if (B === undefined) problems.push(`${where}: item ${itemId}: B_style_fidelity is "${r['B_style_fidelity'] ?? ''}"; expected yes, no, unsure or blank`);
    const codeRaw = (r['why_not'] ?? '').trim().toUpperCase();
    let whyNot: ReasonCode | null = null;
    if (codeRaw !== '') {
      if ((REASON_CODES as readonly string[]).includes(codeRaw)) whyNot = codeRaw as ReasonCode;
      else problems.push(`${where}: item ${itemId}: why_not is "${r['why_not'] ?? ''}"; expected one of ${REASON_CODES.join(', ')} or blank`);
    }
    const rater = (r['rater'] ?? '').trim();
    if (rater.toLowerCase() === 'simulated') simulated = true;
    const row: AnswerRow = { itemId, rater, A: A ?? null, B: B ?? null, whyNot, note: r['note'] ?? '' };
    if (whyNot !== null && row.A !== 'no' && row.B !== 'no') {
      warnings.push(`${label}: item ${itemId}: reason code ${whyNot} given but neither field is no (kept, §9.6)`);
    }
    if (row.A !== null || row.B !== null || whyNot !== null) raters.add(rater);
    rows.set(itemId, row);
  });
  if (problems.length > 0) throw new MeaningInputError(problems);
  if (raters.size > 1) warnings.push(`${label}: the rater column is not the same on every answered row (${raters.size} values)`);
  return { role, path: label, sha256: sha256(text), rows, simulated, warnings };
}

/** BR-06: the same file passed twice stops the run. */
export function checkDistinct(rater: Sheet, author: Sheet): void {
  if (rater.sha256 === author.sha256) {
    throw new MeaningInputError([`${rater.path} and ${author.path} have the same sha256 (${rater.sha256}): the same file passed twice`]);
  }
}

/** The shared files the figures depend on besides the meaning files (BR-07). */
export const SHARED_HASHED_FILES = ['scripts/lib/stats.ts', 'scripts/v1.3/lib/labelling/audit.ts'] as const;
export const MEANING_LIB_DIR = 'scripts/v1.3/lib/meaning';
export const MEANING_CLI = 'scripts/v1.3/meaning-analysis.ts';

/** BR-07: repo-relative paths whose sha256 every output records, sorted. `libFiles` are the `.ts` names in MEANING_LIB_DIR. */
export function scriptHashPaths(libFiles: readonly string[]): string[] {
  return [
    ...libFiles.filter((f) => f.endsWith('.ts')).map((f) => `${MEANING_LIB_DIR}/${f}`),
    MEANING_CLI,
    ...SHARED_HASHED_FILES,
  ].sort(cmp);
}

/** BR-07: hash file contents (the caller reads them). */
export function hashFiles(files: readonly { readonly path: string; readonly content: string }[]): FileHash[] {
  return files.map((f) => ({ path: f.path, sha256: sha256(f.content) })).sort((a, b) => cmp(a.path, b.path));
}
