/**
 * Operator-catalogue parser (FR-v1.2E-24 amendment; BR-U5a-38, 39; `domain-entities.md` §4).
 *
 * Reads the two tables of a catalogue markdown (`Docs/operator-catalogue.md`):
 * - the **operator entry table**, recognised by its header row
 *   `| Id | Core | Dimension | Tags | Defect | Expected templates | Coverage | Site kinds | Preconditions |
 *   Operator collateral | Twin | Source |`;
 * - the **SP-* probe table**, recognised by its header row `| Id | Target function | Fixture | Edit | Pass criterion |`.
 * Cells: backticks are stripped; list cells are comma-separated (`—`, `-` or empty = empty list); `Core` is
 * `yes`/`core` or `no`/`extension`; a literal `|` inside a cell is written `\|`. Every value is validated against
 * the closed enums (dimension, coverage, site kind, precondition reason); any problem is a `CAT_PARSE` error with
 * its line number. `renderOperatorTable` / `renderProbeTable` write the same format (round trip).
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { DIMENSIONS } from '../../../src/shared/types/enums.js';
import { SITE_KINDS } from './types.js';
import type { Coverage, Dimension, PreconditionReason, SiteKind } from './types.js';

export interface OperatorCatalogueEntry {
  readonly id: string;
  readonly core: boolean;
  readonly dimension: Dimension;
  /** e.g. 'checks: data-flow (FR-21)', 'layered only'. */
  readonly tags: readonly string[];
  readonly defect: string;
  readonly expectedTemplates: readonly string[];
  readonly coverage: Coverage;
  readonly siteKinds: readonly SiteKind[];
  readonly preconditions: readonly PreconditionReason[];
  readonly operatorCollateral: readonly string[];
  /** Twin id. */
  readonly twin: string;
  readonly source: string;
}

export interface ProbeEntry {
  /** 'SP-<functionId>' or 'SP-DF01-ci'. */
  readonly id: string;
  readonly targetFunctionId: string;
  readonly fixture: string;
  readonly edit: string;
  readonly passCriterion: string;
}

export interface ParsedCatalogue {
  readonly entries: readonly OperatorCatalogueEntry[];
  readonly probes: readonly ProbeEntry[];
}

export const OPERATOR_TABLE_HEADER = [
  'Id',
  'Core',
  'Dimension',
  'Tags',
  'Defect',
  'Expected templates',
  'Coverage',
  'Site kinds',
  'Preconditions',
  'Operator collateral',
  'Twin',
  'Source',
] as const;

export const PROBE_TABLE_HEADER = ['Id', 'Target function', 'Fixture', 'Edit', 'Pass criterion'] as const;

export const PRECONDITION_REASONS: readonly PreconditionReason[] = [
  'style-disabled',
  'edge-exists',
  'metric-already-violating',
  'threshold-arithmetic',
  'controller-or-entity',
  'entity-import',
  'not-removable-guard',
  'implementer-over-threshold',
  'judge-unit-not-selected',
  'type-shape',
  'already-imported',
  'cycle-cap',
];

const EMPTY_MARKERS = new Set(['', '—', '-']);

/** Splits a markdown table row into trimmed cells (`\|` is a literal pipe), or null when not a row. */
function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|') || trimmed.length < 2) return null;
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner.charAt(i);
    if (ch === '\\' && inner[i + 1] === '|') {
      current += '|';
      i++;
    } else if (ch === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

const isSeparator = (cells: readonly string[]): boolean => cells.every((c) => /^:?-{3,}:?$/.test(c));
const unquote = (cell: string): string => cell.replace(/`/g, '').trim();

function listCell(cell: string): string[] {
  const value = unquote(cell);
  if (EMPTY_MARKERS.has(value)) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function sameHeader(cells: readonly string[], header: readonly string[]): boolean {
  return cells.length === header.length && cells.every((c, i) => unquote(c).toLowerCase() === header[i]?.toLowerCase());
}

interface TableRows {
  readonly rows: readonly { readonly line: number; readonly cells: readonly string[] }[];
  readonly found: boolean;
}

/** Body rows of every table whose header row equals `header` (1-based line numbers). */
function tableRows(lines: readonly string[], header: readonly string[]): TableRows {
  const rows: { line: number; cells: string[] }[] = [];
  let found = false;
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const cells = splitRow(lines[i] ?? '');
    if (cells === null) {
      inTable = false;
      continue;
    }
    if (!inTable) {
      if (sameHeader(cells, header)) {
        inTable = true;
        found = true;
      }
      continue;
    }
    if (isSeparator(cells)) continue;
    rows.push({ line: i + 1, cells });
  }
  return { rows, found };
}

function parseEntry(line: number, cells: readonly string[], errors: DomainError[]): OperatorCatalogueEntry | null {
  const at = (msg: string): void => {
    errors.push({ code: 'CAT_PARSE', message: `line ${String(line)}: ${msg}` });
  };
  if (cells.length !== OPERATOR_TABLE_HEADER.length) {
    at(`expected ${String(OPERATOR_TABLE_HEADER.length)} cells, found ${String(cells.length)}`);
    return null;
  }
  const [id, core, dimension, tags, defect, expected, coverage, siteKinds, preconditions, collateral, twin, source] =
    cells;
  const before = errors.length;
  const idValue = unquote(id ?? '');
  if (idValue.length === 0 || idValue.includes('|')) at(`invalid id ${JSON.stringify(idValue)}`);
  const coreValue = unquote(core ?? '').toLowerCase();
  if (!['yes', 'core', 'no', 'extension'].includes(coreValue)) at(`Core must be yes/core or no/extension, got ${JSON.stringify(coreValue)}`);
  const dimensionValue = unquote(dimension ?? '');
  if (!(DIMENSIONS as readonly string[]).includes(dimensionValue)) at(`unknown dimension ${JSON.stringify(dimensionValue)}`);
  const coverageValue = unquote(coverage ?? '');
  if (coverageValue !== 'in' && coverageValue !== 'outside') at(`coverage must be in or outside, got ${JSON.stringify(coverageValue)}`);
  const kinds = listCell(siteKinds ?? '');
  for (const k of kinds) if (!(SITE_KINDS as readonly string[]).includes(k)) at(`unknown site kind ${JSON.stringify(k)}`);
  const reasons = listCell(preconditions ?? '');
  for (const r of reasons) if (!(PRECONDITION_REASONS as readonly string[]).includes(r)) at(`unknown precondition ${JSON.stringify(r)}`);
  const twinValue = unquote(twin ?? '');
  if (twinValue.length === 0) at('twin is required');
  const sourceValue = unquote(source ?? '');
  if (sourceValue.length === 0) at('source is required');
  if (errors.length > before) return null;
  return {
    id: idValue,
    core: coreValue === 'yes' || coreValue === 'core',
    dimension: dimensionValue as Dimension,
    tags: listCell(tags ?? ''),
    defect: unquote(defect ?? ''),
    expectedTemplates: listCell(expected ?? ''),
    coverage: coverageValue as Coverage,
    siteKinds: kinds as SiteKind[],
    preconditions: reasons as PreconditionReason[],
    operatorCollateral: listCell(collateral ?? ''),
    twin: twinValue,
    source: sourceValue,
  };
}

function parseProbe(line: number, cells: readonly string[], errors: DomainError[]): ProbeEntry | null {
  if (cells.length !== PROBE_TABLE_HEADER.length) {
    errors.push({
      code: 'CAT_PARSE',
      message: `line ${String(line)}: expected ${String(PROBE_TABLE_HEADER.length)} cells, found ${String(cells.length)}`,
    });
    return null;
  }
  const [id, target, fixture, edit, pass] = cells.map(unquote);
  if (id === undefined || !id.startsWith('SP-') || id.includes('|')) {
    errors.push({ code: 'CAT_PARSE', message: `line ${String(line)}: probe id must start with SP-, got ${JSON.stringify(id)}` });
    return null;
  }
  return { id, targetFunctionId: target ?? '', fixture: fixture ?? '', edit: edit ?? '', passCriterion: pass ?? '' };
}

/** Parses the operator entry table (required) and the SP probe table (optional) of a catalogue markdown. */
export function parseCatalogue(markdown: string): DomainResult<ParsedCatalogue> {
  const lines = markdown.split(/\r?\n/);
  const errors: DomainError[] = [];
  const operatorTable = tableRows(lines, OPERATOR_TABLE_HEADER);
  if (!operatorTable.found) {
    return DomainResult.fail([{ code: 'CAT_PARSE', message: 'operator entry table not found (header row mismatch)' }]);
  }
  const entries: OperatorCatalogueEntry[] = [];
  const seen = new Set<string>();
  for (const { line, cells } of operatorTable.rows) {
    const entry = parseEntry(line, cells, errors);
    if (entry === null) continue;
    if (seen.has(entry.id)) {
      errors.push({ code: 'CAT_PARSE', message: `line ${String(line)}: duplicate id ${entry.id}` });
      continue;
    }
    seen.add(entry.id);
    entries.push(entry);
  }
  const probes: ProbeEntry[] = [];
  for (const { line, cells } of tableRows(lines, PROBE_TABLE_HEADER).rows) {
    const probe = parseProbe(line, cells, errors);
    if (probe === null) continue;
    if (seen.has(probe.id)) {
      errors.push({ code: 'CAT_PARSE', message: `line ${String(line)}: duplicate id ${probe.id}` });
      continue;
    }
    seen.add(probe.id);
    probes.push(probe);
  }
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok({ entries, probes });
}

const escapeCell = (value: string): string => value.replace(/\|/g, '\\|');
const listOut = (values: readonly string[]): string => (values.length === 0 ? '—' : values.map((v) => `\`${escapeCell(v)}\``).join(', '));

function row(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

/** Renders the operator entry table in the format `parseCatalogue` reads. */
export function renderOperatorTable(entries: readonly OperatorCatalogueEntry[]): string {
  const lines = [row(OPERATOR_TABLE_HEADER), row(OPERATOR_TABLE_HEADER.map(() => '---'))];
  for (const e of entries) {
    lines.push(
      row([
        escapeCell(e.id),
        e.core ? 'yes' : 'extension',
        e.dimension,
        e.tags.length === 0 ? '—' : e.tags.map(escapeCell).join(', '),
        e.defect.length === 0 ? '—' : escapeCell(e.defect),
        listOut(e.expectedTemplates),
        e.coverage,
        listOut(e.siteKinds),
        listOut(e.preconditions),
        listOut(e.operatorCollateral),
        escapeCell(e.twin),
        escapeCell(e.source),
      ]),
    );
  }
  return lines.join('\n') + '\n';
}

/** Renders the SP-* probe table in the format `parseCatalogue` reads. */
export function renderProbeTable(probes: readonly ProbeEntry[]): string {
  const lines = [row(PROBE_TABLE_HEADER), row(PROBE_TABLE_HEADER.map(() => '---'))];
  for (const p of probes) {
    lines.push(row([p.id, p.targetFunctionId, p.fixture, p.edit, p.passCriterion].map(escapeCell)));
  }
  return lines.join('\n') + '\n';
}
