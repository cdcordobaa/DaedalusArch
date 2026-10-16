/**
 * Mutation analysis of the fitness functions (v1.3 validity of the validation set). Entry file: no exports.
 *
 * Question: if a rule's Cypher were subtly wrong, would the 71-case reference set (author key and blind key), the
 * second development set (devset-b, PR #137) and the unit tests notice?
 *
 * Mutants are NEVER written to the repository. A mutant is the effective Cypher text of one catalogue entry with one
 * small edit. It is applied in memory only, inside a child process (the catalogue Map entry is replaced after import),
 * and for the unit tests through a jest setup file generated in the work directory that does the same in the test's
 * module registry. `src/fitness-compiler/*-templates.ts` and the tiers are never edited.
 *
 * Operators (one mutant per site): flip-comparison, drop-conjunct, label-rel (widen or narrow a label or relationship
 * type), var-length (change a variable-length bound), remove-not, swap-layer-param, remove-distinct, order-by.
 * Controls per entry (not scored): `canary` (the text is replaced by a query that returns no row; checks that the entry
 * is the one the v1.3 compile reads) and `whitespace` (a trailing newline; a unit test that fails on it pins the text,
 * not the behaviour).
 *
 * Engine: `cypher-interp` (in process, no Neo4j), the pipeline the CLI's `evaluate --symbolic-only --engine
 * cypher-interp` runs, with the v1.3 defaults (scoring v1.3, instrument v2, V13_COMPILE_OPTIONS).
 *
 * Keys: author = every variant's expected-findings.json (reference set and devset-b). Blind = the blind-expanded key
 * of the reference set, rebuilt from the committed adjudication sheet (results/v1.3-reference/baseline-pre-barrel):
 * the tool's in-scope rows of that run, minus the rows the blind labeller did not report, plus the blind-only rows.
 * The blind manifests themselves are sealed outside the repository; the rebuild is checked against the committed
 * blind-expanded counts (scores.json) and the check is part of the results.
 *
 * KILLED (headline, "expected-violation result"): some expected finding of some key changes status (matched <-> missed)
 * on some variant. Broader reading also reported: any in-scope (scored) row changes, which adds false positives on
 * clean and near-miss variants.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/rule-mutation.ts --work <dir> --devset <dir-with-tests/fixtures/v1.3-devset-b> [--jobs 2]
 *       [--only plan|baseline|mutants|jest|score] [--out results/v1.3-rule-mutation/rule-mutation-2026-10-16.json]
 *   After the first run, the semantic suite (tests/unit/semantic-rules) under every mutant, and the before/after score:
 *   npx tsx scripts/v1.3/rule-mutation.ts --work <dir> --only semantic [--jobs 2]
 *   npx tsx scripts/v1.3/rule-mutation.ts --work <dir> --only score-semantic [--before <first-run JSON>] [--out <JSON>]
 *   (internal) --child <mutants.json> <id> <work>
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { CYPHER_TEMPLATES } from '../../src/fitness-compiler/cypher-templates.js';
import { HEXAGONAL_TEMPLATES } from '../../src/fitness-compiler/hexagonal-templates.js';
import { DDD_LITERAL_VIEW_TEMPLATES, DDD_MEMBER_FACT_TEMPLATES, DDD_TEMPLATES } from '../../src/fitness-compiler/ddd-templates.js';
import { V13_CYPHER_TEMPLATES } from '../../src/fitness-compiler/v13-templates.js';
import { APG2_TEMPLATES } from '../../src/fitness-compiler/apg2-templates.js';
import { CHEAP2_TEMPLATES } from '../../src/fitness-compiler/cheap2-templates.js';
import type { CypherTemplate } from '../../src/fitness-compiler/types.js';
import { parseCypher } from '../../src/cypher-interp/parse.js';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { ExtractCommand } from '../../src/pipeline/commands/extract-command.js';
import type { FirewallContext } from '../../src/shared/context/firewall-context.js';
import { parseInstrumentVersion } from '../../src/fitness-compiler/role-exemptions.js';
import { parseNeuralAggregation } from '../../src/scoring-engine/neural-aggregation.js';
import { parseScoringMode } from '../../src/scoring-engine/tiered-scoring.js';
import { compareVariant, cycleFileSet, CYCLE_RULE_IDS, normaliseFindingPath } from './lib/compare.js';
import type { ActualFinding } from './lib/compare.js';
import { materialiseVariant } from './lib/materialise.js';
import { loadAllReferences, REFERENCE_ROOT, REFERENCE_STYLES } from './lib/reference-model.js';
import type { ExpectedFinding, LoadedReference } from './lib/reference-model.js';

// ── Catalogue entries ─────────────────────────────────────────────────────────

type MapKind = 'template' | 'text';
interface Entry {
  /** Catalogue id: the source file stem plus the map. */
  readonly catalogue: string;
  readonly file: string;
  readonly name: string;
  readonly kind: MapKind;
  readonly map: Map<string, CypherTemplate | string>;
  /** The jest suites that import the file (targeted run). */
  readonly suiteKey: string;
}

const ALL_MAPS: readonly { catalogue: string; file: string; map: ReadonlyMap<string, CypherTemplate | string>; kind: MapKind; suiteKey: string }[] = [
  { catalogue: 'cypher', file: 'cypher-templates.ts', map: CYPHER_TEMPLATES, kind: 'template', suiteKey: 'cypher-templates' },
  { catalogue: 'hexagonal', file: 'hexagonal-templates.ts', map: HEXAGONAL_TEMPLATES, kind: 'template', suiteKey: 'hexagonal-templates' },
  { catalogue: 'ddd', file: 'ddd-templates.ts', map: DDD_TEMPLATES, kind: 'template', suiteKey: 'ddd-templates' },
  { catalogue: 'ddd-literal-view', file: 'ddd-templates.ts', map: DDD_LITERAL_VIEW_TEMPLATES, kind: 'text', suiteKey: 'ddd-templates' },
  { catalogue: 'ddd-member-fact', file: 'ddd-templates.ts', map: DDD_MEMBER_FACT_TEMPLATES, kind: 'template', suiteKey: 'ddd-templates' },
  { catalogue: 'v13', file: 'v13-templates.ts', map: V13_CYPHER_TEMPLATES, kind: 'template', suiteKey: 'v13-templates' },
  { catalogue: 'apg2', file: 'apg2-templates.ts', map: APG2_TEMPLATES, kind: 'template', suiteKey: 'apg2-templates' },
  { catalogue: 'cheap2', file: 'cheap2-templates.ts', map: CHEAP2_TEMPLATES, kind: 'template', suiteKey: 'cheap2-templates' },
];

function entries(): Entry[] {
  const out: Entry[] = [];
  for (const m of ALL_MAPS) {
    for (const name of m.map.keys()) {
      out.push({ catalogue: m.catalogue, file: m.file, name, kind: m.kind, map: m.map as Map<string, CypherTemplate | string>, suiteKey: m.suiteKey });
    }
  }
  return out;
}

function textOf(e: Entry): string {
  const v = e.map.get(e.name);
  if (v === undefined) throw new Error(`no entry ${e.catalogue}/${e.name}`);
  return typeof v === 'string' ? v : v.template;
}

/** Replaces the entry's text in memory (this process only). */
function applyText(e: Entry, text: string): void {
  const v = e.map.get(e.name);
  if (v === undefined) throw new Error(`no entry ${e.catalogue}/${e.name}`);
  e.map.set(e.name, typeof v === 'string' ? text : { ...v, template: text });
}

/** DDD entries whose text the v1.3 compile does not read (edge views pick the literal-view text; member facts the member-fact text). */
function shadowedUnderV13(e: Entry): boolean {
  return e.catalogue === 'ddd' && (DDD_LITERAL_VIEW_TEMPLATES.has(e.name) || DDD_MEMBER_FACT_TEMPLATES.has(e.name));
}

// ── Mutation operators ────────────────────────────────────────────────────────

const OPERATORS = ['flip-comparison', 'drop-conjunct', 'label-rel', 'var-length', 'remove-not', 'swap-layer-param', 'remove-distinct', 'order-by'] as const;
type Operator = (typeof OPERATORS)[number] | 'canary' | 'whitespace';

interface Mutant {
  readonly id: string;
  readonly catalogue: string;
  readonly file: string;
  readonly name: string;
  readonly operator: Operator;
  readonly site: number;
  readonly description: string;
  readonly text: string;
  /** Parse status of the mutated text under the interpreter's parser (a mutant Neo4j would reject is stillborn). */
  valid?: boolean;
  invalidReason?: string;
}

interface Edit { readonly start: number; readonly end: number; readonly replacement: string; readonly description: string }

const apply = (text: string, e: Edit): string => text.slice(0, e.start) + e.replacement + text.slice(e.end);

/** Masks string literals and comments with spaces (same length), so the scanners see only Cypher syntax. */
function mask(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? '';
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      out += c + ' '.repeat(Math.max(0, Math.min(j, text.length) - i - 1)) + (j < text.length ? c : '');
      i = j + 1;
    } else if (text.startsWith('/*', i)) {
      const j = text.indexOf('*/', i + 2);
      const end = j < 0 ? text.length : j + 2;
      out += ' '.repeat(end - i);
      i = end;
    } else if (text.startsWith('//', i)) {
      const j = text.indexOf('\n', i);
      const end = j < 0 ? text.length : j;
      out += ' '.repeat(end - i);
      i = end;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const lineOf = (text: string, at: number): string => {
  const s = text.lastIndexOf('\n', at - 1) + 1;
  const e = text.indexOf('\n', at);
  return text.slice(s, e < 0 ? text.length : e).trim();
};

function flipComparison(text: string, m: string): Edit[] {
  const out: Edit[] = [];
  const FLIP: Record<string, string> = { '<>': '=', '=': '<>', '<=': '>', '>=': '<', '<': '>=', '>': '<=' };
  // An operator between spaces: not an arrow (`->`, `<-`), not a map `:` or a `=~` regex.
  const re = /(?<=\s)(<>|<=|>=|=|<|>)(?=\s)/g;
  for (const x of m.matchAll(re)) {
    const op = x[1] ?? '';
    const before = m.slice(Math.max(0, x.index - 40), x.index);
    // `MATCH p = (...)` and `WITH ... AS`, `SET x = ...`: a path or property assignment, not a comparison.
    if (op === '=' && /(?:MATCH|OPTIONAL MATCH|,)\s+[A-Za-z_]\w*\s*$/.test(before)) continue;
    if (op === '=' && /\bSET\s+[^\n]*$/.test(before)) continue;
    const to = FLIP[op] ?? op;
    out.push({ start: x.index, end: x.index + op.length, replacement: to, description: `${op} -> ${to} in \`${lineOf(text, x.index)}\`` });
  }
  return out;
}

const CLAUSE_END = /\b(?:WITH|RETURN|MATCH|OPTIONAL|UNWIND|ORDER|CALL|UNION|SET|CREATE|MERGE|DELETE|DETACH|LIMIT|SKIP|FOREACH)\b/y;

/** Every WHERE clause: [start of the predicate, end of the predicate]. Stops at a top-level clause keyword or an unmatched bracket. */
function whereClauses(m: string): { kw: number; start: number; end: number }[] {
  const out: { kw: number; start: number; end: number }[] = [];
  for (const w of m.matchAll(/\bWHERE\b/g)) {
    const start = w.index + 5;
    let depth = 0;
    let i = start;
    for (; i < m.length; i += 1) {
      const c = m[i] ?? '';
      if (c === '(' || c === '[' || c === '{') depth += 1;
      else if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && /[A-Z]/.test(c) && (i === 0 || /\W/.test(m[i - 1] ?? ''))) {
        CLAUSE_END.lastIndex = i;
        if (CLAUSE_END.test(m)) break;
      }
    }
    out.push({ kw: w.index, start, end: i });
  }
  return out;
}

/** Top-level ` AND ` split of a predicate: [start, end) of each conjunct. */
function conjuncts(m: string, start: number, end: number): { start: number; end: number }[] {
  const parts: { start: number; end: number }[] = [];
  let depth = 0;
  let from = start;
  for (let i = start; i < end; i += 1) {
    const c = m[i] ?? '';
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (depth === 0 && /\sAND\s/y.test(m.slice(i - 1, i + 4)) && m.slice(i, i + 3) === 'AND' && /\s/.test(m[i - 1] ?? '') && /\s/.test(m[i + 3] ?? '')) {
      parts.push({ start: from, end: i });
      from = i + 3;
    }
  }
  parts.push({ start: from, end });
  return parts;
}

function dropConjunct(text: string, m: string): Edit[] {
  const out: Edit[] = [];
  for (const w of whereClauses(m)) {
    const parts = conjuncts(m, w.start, w.end);
    if (parts.length === 1) {
      // The only predicate: drop the WHERE (pattern-inline and list-comprehension WHEREs included).
      const p = parts[0];
      if (p === undefined || text.slice(p.start, p.end).trim() === '') continue;
      out.push({ start: w.kw, end: w.end, replacement: ' ', description: `drop the only WHERE predicate \`${text.slice(p.start, p.end).trim().replace(/\s+/g, ' ').slice(0, 120)}\`` });
      continue;
    }
    parts.forEach((p, k) => {
      const body = text.slice(p.start, p.end).trim().replace(/\s+/g, ' ');
      if (body === '') return;
      // Remove the conjunct and one adjacent AND.
      const start = k === 0 ? p.start : (parts[k - 1]?.end ?? p.start);
      const end = k === 0 ? (parts[1]?.start ?? p.end) : p.end;
      out.push({ start, end, replacement: k === 0 ? ' ' : '', description: `drop conjunct \`${body.slice(0, 120)}\`` });
    });
  }
  return out;
}

function labelRel(text: string, m: string): Edit[] {
  const out: Edit[] = [];
  // Node labels in a pattern: `(x:Label)` or `(x:A:B)` or `(:Label {...})` -> widen by removing one label.
  for (const x of m.matchAll(/\(\s*([A-Za-z_]\w*)?((?::[A-Z]\w*)+)/g)) {
    const labels = (x[2] ?? '').split(':').filter((s) => s !== '');
    let at = x.index + x[0].length - (x[2] ?? '').length;
    for (const l of labels) {
      out.push({ start: at, end: at + 1 + l.length, replacement: '', description: `widen: drop label :${l} in \`${lineOf(text, x.index)}\`` });
      at += 1 + l.length;
    }
  }
  // Relationship types `[r:A|B*..]`: narrow (drop one alternative) or widen (drop the type).
  for (const x of m.matchAll(/\[\s*([A-Za-z_]\w*)?\s*:\s*([A-Z_]+(?:\s*\|\s*:?[A-Z_]+)*)/g)) {
    const typesText = x[2] ?? '';
    const typesStart = x.index + x[0].length - typesText.length;
    const types = typesText.split('|').map((t) => t.trim().replace(/^:/, ''));
    const colon = m.lastIndexOf(':', typesStart);
    out.push({ start: colon, end: typesStart + typesText.length, replacement: '', description: `widen: drop relationship type :${types.join('|')} in \`${lineOf(text, x.index)}\`` });
    if (types.length > 1) {
      types.forEach((t, k) => {
        const rest = types.filter((_, j) => j !== k).join('|');
        out.push({ start: typesStart, end: typesStart + typesText.length, replacement: rest, description: `narrow: drop |${t} from :${types.join('|')} in \`${lineOf(text, x.index)}\`` });
      });
    }
  }
  // Label predicates in WHERE (`x:Interface`, `NOT t:Test`): drop one label from a label test is not a widening of a
  // pattern; the label tests are left to flip-comparison / remove-not.
  return out;
}

function varLength(text: string, m: string): Edit[] {
  const out: Edit[] = [];
  for (const x of m.matchAll(/\*\s*(\d+)?\s*(\.\.)?\s*(\d+)?(?=\s*[\]{])/g)) {
    const lo = x[1];
    const dots = x[2];
    const hi = x[3];
    const at = x.index;
    const end = at + x[0].length;
    const line = lineOf(text, at);
    const alt = (s: string, d: string): void => {
      if (s !== x[0]) out.push({ start: at, end, replacement: s, description: `${x[0].trim()} -> ${s} (${d}) in \`${line}\`` });
    };
    if (dots === undefined) {
      if (lo === undefined) {
        alt('*1..2', 'unbounded -> 1..2');
        alt('*2..', 'min 1 -> 2');
      } else {
        const n = Number(lo);
        alt(`*${String(n + 1)}`, 'exact +1');
        if (n > 1) alt(`*${String(n - 1)}`, 'exact -1');
      }
      continue;
    }
    const l = lo === undefined ? 1 : Number(lo);
    if (hi !== undefined) {
      const h = Number(hi);
      alt(`*${lo ?? ''}..${String(h + 1)}`, 'max +1');
      if (h - 1 >= l) alt(`*${lo ?? ''}..${String(h - 1)}`, 'max -1');
    } else {
      alt(`*${lo ?? ''}..${String(l + 1)}`, 'unbounded max -> min+1');
    }
    if (l + 1 <= (hi === undefined ? Infinity : Number(hi))) alt(`*${String(l + 1)}..${hi ?? ''}`, 'min +1');
    if (l > 1) alt(`*${String(l - 1)}..${hi ?? ''}`, 'min -1');
  }
  // Bounds passed as a literal elsewhere (e.g. a `size(...) <= N` cap) are covered by flip-comparison.
  return out;
}

function removeNot(text: string, m: string): Edit[] {
  const out: Edit[] = [];
  for (const x of m.matchAll(/\bNOT\s+/g)) {
    const before = m.slice(Math.max(0, x.index - 3), x.index);
    if (/IS\s$/.test(before)) {
      out.push({ start: x.index, end: x.index + x[0].length, replacement: '', description: `IS NOT NULL -> IS NULL in \`${lineOf(text, x.index)}\`` });
    } else {
      out.push({ start: x.index, end: x.index + x[0].length, replacement: '', description: `remove NOT in \`${lineOf(text, x.index)}\`` });
    }
  }
  return out;
}

function swapLayerParam(text: string, m: string): { text: string; description: string }[] {
  const params = [...new Set([...m.matchAll(/\$([A-Za-z_]\w*)/g)].map((x) => x[1] ?? ''))].filter((p) => /layer|Layer|kind|Kind|order|Order|core|Core|port|Port|adapter|Adapter|domain|Domain|infra|Infra|application|Application|presentation|Presentation/.test(p));
  const out: { text: string; description: string }[] = [];
  for (let i = 0; i < params.length; i += 1) {
    for (let j = i + 1; j < params.length; j += 1) {
      const a = params[i] ?? '';
      const b = params[j] ?? '';
      const re = new RegExp(`\\$(${a}|${b})\\b`, 'g');
      const swapped = text.replace(re, (_s, p: string) => (p === a ? `$${b}` : `$${a}`));
      if (swapped !== text) out.push({ text: swapped, description: `swap $${a} <-> $${b}` });
      // One occurrence of a replaced by b (and b by a): a single wrong parameter.
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const occ = [...text.matchAll(new RegExp(`\\$${from}\\b`, 'g'))];
        if (occ.length > 1) {
          occ.forEach((o, k) => {
            out.push({ text: text.slice(0, o.index) + `$${to}` + text.slice(o.index + from.length + 1), description: `occurrence ${String(k + 1)} of $${from} -> $${to} in \`${lineOf(text, o.index)}\`` });
          });
        }
      }
    }
  }
  return out;
}

function removeDistinct(text: string, m: string): Edit[] {
  return [...m.matchAll(/\bDISTINCT\s+/g)].map((x) => ({ start: x.index, end: x.index + x[0].length, replacement: '', description: `remove DISTINCT in \`${lineOf(text, x.index)}\`` }));
}

function orderBy(text: string, m: string): Edit[] {
  const out: Edit[] = [];
  for (const x of m.matchAll(/\bORDER\s+BY\s+/g)) {
    const start = x.index + x[0].length;
    const rest = m.slice(start);
    const stop = /\n\s*(?:LIMIT|SKIP|RETURN|WITH|MATCH|UNION|$)|\bLIMIT\b|\bSKIP\b|\bRETURN\b|\bWITH\b|\bUNION\b|\)|$/.exec(rest);
    const end = start + (stop?.index ?? rest.length);
    const keysText = text.slice(start, end).replace(/\s+$/, '');
    const keys = keysText.split(',').map((k) => k.trim()).filter((k) => k !== '');
    const realEnd = start + keysText.length;
    if (keys.length > 1) {
      out.push({ start, end: realEnd, replacement: [...keys].reverse().join(', '), description: `ORDER BY ${keys.join(', ')} -> reversed key order` });
      out.push({ start, end: realEnd, replacement: keys.slice(1).join(', '), description: `ORDER BY: drop the first key ${keys[0] ?? ''}` });
    }
    const first = keys[0] ?? '';
    const desc = /\bDESC$/i.test(first) ? first.replace(/\s+DESC$/i, '') : `${first} DESC`;
    out.push({ start, end: realEnd, replacement: [desc, ...keys.slice(1)].join(', '), description: `ORDER BY: first key ${first} -> ${desc}` });
  }
  return out;
}

function generate(e: Entry): Mutant[] {
  const text = textOf(e);
  const m = mask(text);
  const out: Mutant[] = [];
  const push = (operator: Operator, site: number, description: string, mutated: string): void => {
    if (mutated === text) return;
    if (out.some((o) => o.text === mutated)) return; // duplicate text: keep the first operator's
    out.push({ id: `${e.catalogue}/${e.name}/${operator}/${String(site)}`, catalogue: e.catalogue, file: e.file, name: e.name, operator, site, description, text: mutated });
  };
  const fromEdits = (op: Operator, edits: Edit[]): void => {
    edits.forEach((ed, k) => {
      push(op, k + 1, ed.description, apply(text, ed));
    });
  };
  fromEdits('flip-comparison', flipComparison(text, m));
  fromEdits('drop-conjunct', dropConjunct(text, m));
  fromEdits('label-rel', labelRel(text, m));
  fromEdits('var-length', varLength(text, m));
  fromEdits('remove-not', removeNot(text, m));
  swapLayerParam(text, m).forEach((s, k) => {
    push('swap-layer-param', k + 1, s.description, s.text);
  });
  fromEdits('remove-distinct', removeDistinct(text, m));
  fromEdits('order-by', orderBy(text, m));
  // Controls.
  const firstReturn = /\bRETURN\b/.exec(m);
  const canary = `MATCH (mutationCanary:MutationCanaryNoSuchLabel) ${firstReturn === null ? 'RETURN mutationCanary.filePath AS filePath' : text.slice(firstReturn.index)}`;
  out.push({ id: `${e.catalogue}/${e.name}/canary/0`, catalogue: e.catalogue, file: e.file, name: e.name, operator: 'canary', site: 0, description: 'control: the first MATCH..RETURN prefix replaced by a pattern that matches nothing', text: canary });
  out.push({ id: `${e.catalogue}/${e.name}/whitespace/0`, catalogue: e.catalogue, file: e.file, name: e.name, operator: 'whitespace', site: 0, description: 'control: a trailing newline (behaviour-neutral)', text: `${text}\n` });
  return out;
}

/** Parses the text as the compiler would emit it: exclude markers are comments and stay; parameters stay. */
function parseStatus(text: string): { valid: boolean; reason?: string } {
  try {
    parseCypher(text);
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: (err instanceof Error ? err.message : String(err)).split('\n')[0]?.slice(0, 200) ?? '' };
  }
}

// ── Reference runs ───────────────────────────────────────────────────────────

interface Case {
  readonly set: 'reference' | 'devset-b' | 'probe';
  readonly style: string;
  readonly variant: string;
  readonly projectDir: string;
  readonly specPath: string;
}

type Findings = Record<string, readonly ActualFinding[]>; // case key -> rows
type Errors = Record<string, string>;

const caseKey = (c: { set: string; style: string; variant: string }): string => `${c.set}:${c.style}/${c.variant}`;

function loadSets(repoRoot: string, devsetDir: string | undefined): { set: Case['set']; refs: LoadedReference[] }[] {
  const sets: { set: Case['set']; refs: LoadedReference[] }[] = [{ set: 'reference', refs: loadAllReferences(repoRoot, REFERENCE_STYLES, REFERENCE_ROOT) }];
  if (devsetDir !== undefined) sets.push({ set: 'devset-b', refs: loadAllReferences(repoRoot, REFERENCE_STYLES, path.resolve(devsetDir, 'tests/fixtures/v1.3-devset-b')) });
  return sets;
}

const PROBE_FIXTURES = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'] as const;

function materialiseAll(repoRoot: string, devsetDir: string | undefined, work: string): Case[] {
  const cases: Case[] = [];
  for (const { set, refs } of loadSets(repoRoot, devsetDir)) {
    for (const ref of refs) {
      for (const v of ref.variants) {
        const m = materialiseVariant(ref, v, path.join(work, 'projects', set));
        cases.push({ set, style: ref.style, variant: v.manifest.variant, projectDir: m.projectDir, specPath: ref.specPath });
      }
    }
  }
  // Equivalence probe (not a key): the five golden fixtures under specs/clean-arch.yaml. A surviving mutant that changes
  // their rows is not equivalent: the behaviour differs on real code and the validation set does not notice.
  for (const f of PROBE_FIXTURES) {
    cases.push({ set: 'probe', style: 'golden', variant: f, projectDir: path.join(repoRoot, 'fixtures', f), specPath: path.join(repoRoot, 'specs/clean-arch.yaml') });
  }
  return cases;
}

/**
 * Memoises the APG extraction per project directory in this process (the extraction is template-independent; the
 * mutants change only the compiled Cypher). The cached result and its warnings are replayed into the context; a fresh
 * structured clone is handed out each time. `--verify-cache` checks that a cached run equals an uncached one.
 */
function enableExtractCache(): void {
  type Exec = (this: ExtractCommand, ctx: FirewallContext) => ReturnType<ExtractCommand['execute']>;
  const proto = ExtractCommand.prototype as unknown as { execute: Exec; __cached?: boolean };
  if (proto.__cached === true) return;
  const original = proto.execute;
  const cache = new Map<string, { apg: unknown; warnings: unknown[]; audit: unknown[] }>();
  proto.execute = async function (this: ExtractCommand, ctx: FirewallContext) {
    const key = (this as unknown as { projectPath: string }).projectPath;
    const hit = cache.get(key);
    const c = ctx as unknown as { setApgResult(a: unknown): void; addWarning(w: unknown): void; addAuditEntry(e: unknown): void; getApgResult(): unknown; snapshot?: unknown };
    if (hit !== undefined) {
      c.setApgResult(structuredClone(hit.apg));
      for (const w of hit.warnings) c.addWarning(structuredClone(w));
      for (const e of hit.audit) c.addAuditEntry(structuredClone(e));
      const { DomainResult } = await import('../../src/shared/errors/domain-result.js');
      return DomainResult.ok(undefined);
    }
    const warnings: unknown[] = [];
    const audit: unknown[] = [];
    const spy = new Proxy(ctx, {
      get(target, prop, recv) {
        if (prop === 'addWarning') return (w: unknown) => { warnings.push(structuredClone(w)); c.addWarning(w); };
        if (prop === 'addAuditEntry') return (e: unknown) => { audit.push(structuredClone(e)); c.addAuditEntry(e); };
        const v = Reflect.get(target, prop, recv) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
    const r = await original.call(this, spy);
    if (r.success) cache.set(key, { apg: structuredClone(c.getApgResult()), warnings, audit });
    return r;
  };
  proto.__cached = true;
}

async function evaluateCase(c: Case, apgStore: string): Promise<{ rows: readonly ActualFinding[]; failures: string[] }> {
  const { executor, cleanup } = createPipeline({
    projectPath: c.projectDir, specFilePath: c.specPath, neo4jUri: '', neo4jUser: 'neo4j', neo4jPassword: '',
    evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
    apgStorePath: apgStore, instrumentVersion: parseInstrumentVersion('v2'), neuralAggregation: parseNeuralAggregation('registered'),
    scoringMode: parseScoringMode('v1.3'), graphEngine: 'cypher-interp',
  });
  try {
    const result = await executor.execute();
    if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
    const report = result.data;
    // A query that fails is reported as a warning and its function yields no row (as in the CLI); recorded per case.
    const failed = report.warnings.filter((w) => w.code === 'EVAL_001' || (/fail/i.test(w.message) && /query/i.test(w.message)));
    const rows = report.violations
      .filter((v) => typeof v.functionId === 'string' && typeof v.filePath === 'string')
      .map((v) => {
        const target = normaliseFindingPath(typeof v.target === 'string' ? v.target : '', c.projectDir);
        return { ruleId: v.functionId, file: normaliseFindingPath(v.filePath, c.projectDir), ...(target !== '' ? { target } : {}) };
      });
    return { rows, failures: failed.map((w) => `${w.code}: ${w.message}`.slice(0, 300)) };
  } finally {
    await cleanup();
  }
}

/** Runs `cases`; records which catalogue entries each style's compile reads (the `.get` / `.has` of every map). */
async function runCases(cases: readonly Case[], apgStore: string, record?: Map<string, Set<string>>): Promise<{ findings: Findings; errors: Errors }> {
  const findings: Record<string, readonly ActualFinding[]> = {};
  const errors: Errors = {};
  const restore: (() => void)[] = [];
  let current = '';
  if (record !== undefined) {
    for (const m of ALL_MAPS) {
      const map = m.map as Map<string, unknown>;
      const get = map.get.bind(map);
      const note = (k: string): void => {
        const s = record.get(current) ?? new Set<string>();
        s.add(`${m.catalogue}/${k}`);
        record.set(current, s);
      };
      // Only a lookup that returns the entry counts (the compile's own read); `.has` probes of every map do not.
      map.get = (k: string) => { const v = get(k); if (v !== undefined) note(k); return v; };
      restore.push(() => { map.get = get; });
    }
  }
  try {
    for (const c of cases) {
      current = `${c.set}:${c.style}`;
      try {
        const r = await evaluateCase(c, apgStore);
        findings[caseKey(c)] = r.rows;
        if (r.failures.length > 0) errors[caseKey(c)] = r.failures.sort().join(' | ');
      } catch (err) {
        errors[caseKey(c)] = (err instanceof Error ? err.message : String(err)).slice(0, 400);
        findings[caseKey(c)] = [];
      }
    }
  } finally {
    for (const r of restore) r();
  }
  return { findings, errors };
}

// ── Keys and kill scoring ─────────────────────────────────────────────────────

interface KeyCase { readonly expected: readonly ExpectedFinding[]; readonly kind: 'clean' | 'violation' | 'near-miss'; readonly plants: string | null; readonly scope: ReadonlySet<string> }
type Key = Record<string, KeyCase>; // case key -> expected findings

function authorKeys(repoRoot: string, devsetDir: string | undefined): Record<'reference-author' | 'devset-b-author', Key> {
  const out: Record<string, Key> = { 'reference-author': {}, 'devset-b-author': {} };
  for (const { set, refs } of loadSets(repoRoot, devsetDir)) {
    const k = out[`${set}-author`] ?? {};
    for (const ref of refs) {
      const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
      for (const v of ref.variants) {
        k[caseKey({ set, style: ref.style, variant: v.manifest.variant })] = { expected: v.manifest.expectedFindings, kind: v.manifest.kind, plants: v.manifest.plants, scope };
      }
    }
  }
  return out as Record<'reference-author' | 'devset-b-author', Key>;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? '';
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries((head ?? []).map((h, i) => [h, r[i] ?? ''])));
}

const fKey = (f: { ruleId: string; file: string; target?: string | undefined }): string =>
  CYCLE_RULE_IDS.has(f.ruleId) ? `${f.ruleId}|{${cycleFileSet(f)}}` : `${f.ruleId}|${f.file}|${f.target ?? ''}`;

/**
 * The blind-expanded key, rebuilt from the committed U-E adjudication sheet: the pre-barrel tool rows in scope, minus
 * the rows marked blind=none, plus the scored rows marked blind=finding where the tool was silent.
 */
function blindKey(repoRoot: string, author: Key): { key: Key; check: Record<string, unknown> } {
  const base = path.join(repoRoot, 'results/v1.3-reference/baseline-pre-barrel');
  const rows = parseCsv(fs.readFileSync(path.join(base, 'adjudication.csv'), 'utf8'));
  const key: Key = {};
  const check: Record<string, { tp: number; fn: number; fp: number; expected: { tp: number; fn: number; fp: number } | null }> = {};
  const scores = JSON.parse(fs.readFileSync(path.join(base, 'scores.json'), 'utf8')) as { views: { style: string; view: string; all: { tp: number; fn: number; fp: number } }[] };
  for (const [ck, a] of Object.entries(author)) {
    if (!ck.startsWith('reference:')) continue;
    const [style = '', variant = ''] = ck.slice('reference:'.length).split('/');
    const raw = (JSON.parse(fs.readFileSync(path.join(base, 'raw', style, `${variant}.json`), 'utf8')) as { findings: ActualFinding[] }).findings;
    const mine = rows.filter((r) => r.style === style && r.variant === variant && r.scope === 'scored');
    const notBlind = new Set(mine.filter((r) => r.tool === 'finding' && r.blind === 'none').map((r) => fKey({ ruleId: r.rule ?? '', file: r.file ?? '', target: r.target === '' ? undefined : r.target })));
    const expected: ExpectedFinding[] = [];
    for (const f of raw.filter((x) => a.scope.has(x.ruleId))) {
      const k = fKey(f);
      if (notBlind.has(k)) { notBlind.delete(k); continue; } // one row per adjudication line
      expected.push({ ruleId: f.ruleId, ruleName: f.ruleId, file: f.file, ...(f.target !== undefined ? { target: f.target } : {}), reason: 'blind-expanded (agreed tool row)' } as unknown as ExpectedFinding);
    }
    for (const r of mine.filter((x) => x.blind === 'finding' && x.tool !== 'finding')) {
      expected.push({ ruleId: r.rule ?? '', ruleName: r.rule ?? '', file: r.file ?? '', ...(r.target !== undefined && r.target !== '' ? { target: r.target } : {}), reason: `blind only: ${(r.blind_reason ?? '').slice(0, 80)}` } as unknown as ExpectedFinding);
    }
    key[ck] = { ...a, expected };
    const cmp = compareVariant(style, { variant, kind: a.kind, plants: a.plants, expectedFindings: expected }, raw, a.scope);
    const c = check[style] ?? { tp: 0, fn: 0, fp: 0, expected: null };
    c.tp += cmp.matched.length;
    c.fn += cmp.mismatches.filter((x) => x.kind === 'missed').length;
    c.fp += cmp.mismatches.filter((x) => x.kind === 'unexpected').length;
    const view = scores.views.find((v) => v.style === style && v.view === 'blind-expanded');
    c.expected = view === undefined ? null : { tp: view.all.tp, fn: view.all.fn, fp: view.all.fp };
    check[style] = c;
  }
  return { key, check };
}

interface CaseOutcome { readonly matched: readonly string[]; readonly unexpected: readonly string[] }

function outcome(k: KeyCase, ck: string, actual: readonly ActualFinding[]): CaseOutcome {
  const [style = '', variant = ''] = ck.split(':')[1]?.split('/') ?? [];
  const cmp = compareVariant(style, { variant, kind: k.kind, plants: k.plants, expectedFindings: k.expected }, actual, k.scope);
  return {
    matched: cmp.matched.map(fKey).sort(),
    unexpected: cmp.mismatches.filter((x) => x.kind === 'unexpected').map(fKey).sort(),
  };
}

interface KillDetail { readonly key: string; readonly case: string; readonly change: string }

function killsBy(keyName: string, key: Key, base: Findings, mut: Findings): { strict: KillDetail[]; broad: KillDetail[] } {
  const strict: KillDetail[] = [];
  const broad: KillDetail[] = [];
  for (const [ck, k] of Object.entries(key)) {
    const b = base[ck];
    const m = mut[ck];
    if (b === undefined || m === undefined) continue;
    const ob = outcome(k, ck, b);
    const om = outcome(k, ck, m);
    const lost = ob.matched.filter((x) => !om.matched.includes(x));
    const gained = om.matched.filter((x) => !ob.matched.includes(x));
    if (lost.length + gained.length > 0) strict.push({ key: keyName, case: ck, change: [...lost.map((x) => `missed ${x}`), ...gained.map((x) => `now matched ${x}`)].join('; ') });
    const ub = ob.unexpected.join('\n');
    const um = om.unexpected.join('\n');
    if (lost.length + gained.length > 0 || ub !== um) {
      const added = om.unexpected.filter((x) => !ob.unexpected.includes(x));
      const removed = ob.unexpected.filter((x) => !om.unexpected.includes(x));
      broad.push({ key: keyName, case: ck, change: [...lost.map((x) => `missed ${x}`), ...gained.map((x) => `now matched ${x}`), ...added.slice(0, 3).map((x) => `new FP ${x}`), ...removed.slice(0, 3).map((x) => `FP gone ${x}`), ...(added.length > 3 ? [`+${String(added.length - 3)} more new FP`] : []), ...(removed.length > 3 ? [`+${String(removed.length - 3)} more FP gone`] : [])].join('; ') });
    }
  }
  return { strict, broad };
}

// ── Orchestration ─────────────────────────────────────────────────────────────

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
const writeJson = (f: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
};

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function sh(cmd: string, args: readonly string[], opts: { cwd: string; timeoutMs: number; env?: NodeJS.ProcessEnv; log?: string }): Promise<{ code: number | null; timedOut: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, opts.timeoutMs);
    child.on('close', (code) => {
      clearTimeout(t);
      if (opts.log !== undefined) fs.writeFileSync(opts.log, `${stdout}\n----- stderr -----\n${stderr}`);
      resolve({ code, timedOut, stdout, stderr });
    });
  });
}

async function pool<T>(items: readonly T[], jobs: number, fn: (t: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await fn(items[i] as T, i);
    }
  }));
}

/**
 * Worker: for each mutant id in the list, apply it in memory, run the cases of the styles whose compile reads the
 * entry, write the rows, restore the entry. Writes `<work>/workers/<n>.current` before each mutant (the parent's
 * watchdog). The APG extraction is cached across mutants.
 */
async function worker(mutantsFile: string, listFile: string, work: string, n: string): Promise<void> {
  const mutants = new Map(readJson<Mutant[]>(mutantsFile).map((m) => [m.id, m]));
  const ids = readJson<string[]>(listFile);
  const plan = readJson<{ cases: Case[]; exercised: Record<string, string[]> }>(path.join(work, 'baseline.json'));
  const all = entries();
  enableExtractCache();
  const apg = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-apg-'));
  const current = path.join(work, 'workers', `${n}.current`);
  try {
    for (const id of ids) {
      const out = path.join(work, 'mutants', `${id.replace(/\//g, '__')}.json`);
      if (fs.existsSync(out)) continue;
      fs.writeFileSync(current, id);
      const mutant = mutants.get(id);
      if (mutant === undefined) throw new Error(`no mutant ${id}`);
      const entry = all.find((e) => e.catalogue === mutant.catalogue && e.name === mutant.name);
      if (entry === undefined) throw new Error(`no entry for ${id}`);
      const original = entry.map.get(entry.name);
      if (original === undefined) throw new Error(`no entry text for ${id}`);
      applyText(entry, mutant.text);
      try {
        const styles = Object.entries(plan.exercised).filter(([, names]) => names.includes(`${mutant.catalogue}/${mutant.name}`)).map(([s]) => s);
        const cases = plan.cases.filter((c) => styles.includes(`${c.set}:${c.style}`));
        const t0 = Date.now();
        const { findings, errors } = await runCases(cases, apg);
        writeJson(out, { id, styles, findings, errors, ms: Date.now() - t0 });
      } finally {
        entry.map.set(entry.name, original);
      }
    }
  } finally {
    fs.rmSync(apg, { recursive: true, force: true });
    fs.rmSync(current, { force: true });
  }
}

/** The jest setup file that applies a mutant in the test's module registry (CommonJS under ts-jest). */
function jestSetupSource(repoRoot: string): string {
  const fc = (f: string): string => JSON.stringify(path.join(repoRoot, 'src/fitness-compiler', f));
  return `// Generated by scripts/v1.3/rule-mutation.ts: applies one mutant in memory; never written into the repository.
const fs = require('fs');
const file = process.env.RULE_MUTANT_FILE;
if (file) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const maps = {
    cypher: () => require(${fc('cypher-templates')}).CYPHER_TEMPLATES,
    hexagonal: () => require(${fc('hexagonal-templates')}).HEXAGONAL_TEMPLATES,
    ddd: () => require(${fc('ddd-templates')}).DDD_TEMPLATES,
    'ddd-literal-view': () => require(${fc('ddd-templates')}).DDD_LITERAL_VIEW_TEMPLATES,
    'ddd-member-fact': () => require(${fc('ddd-templates')}).DDD_MEMBER_FACT_TEMPLATES,
    v13: () => require(${fc('v13-templates')}).V13_CYPHER_TEMPLATES,
    apg2: () => require(${fc('apg2-templates')}).APG2_TEMPLATES,
    cheap2: () => require(${fc('cheap2-templates')}).CHEAP2_TEMPLATES,
  };
  const map = maps[m.catalogue]();
  const v = map.get(m.name);
  if (v === undefined) throw new Error('rule-mutation: no entry ' + m.catalogue + '/' + m.name);
  map.set(m.name, typeof v === 'string' ? m.text : Object.assign({}, v, { template: m.text }));
}
`;
}

/** Unit-test files per suite key: the tests under tests/unit that import the catalogue file. */
function suiteFiles(repoRoot: string, suiteKey: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) walk(p);
      else if (n.name.endsWith('.test.ts') && new RegExp(`${suiteKey.replace(/[-]/g, '\\-')}(?:\\.js)?['"]`).test(fs.readFileSync(p, 'utf8'))) out.push(path.relative(repoRoot, p));
    }
  };
  walk(path.join(repoRoot, 'tests/unit'));
  return out.sort();
}

interface JestOutcome { readonly passed: number; readonly failed: number; readonly skipped: number; readonly failing: readonly string[]; readonly error?: string;
  /** First line of each failing test's message (semantic step only: tells a wrong answer from a compile or query failure). */
  readonly messages?: Readonly<Record<string, string>> }

async function runJest(repoRoot: string, work: string, files: readonly string[], mutantFile: string | undefined, log: string, withMessages = false): Promise<JestOutcome> {
  const cfg = path.join(work, 'jest.mutation.config.cjs');
  if (!fs.existsSync(cfg)) {
    fs.writeFileSync(path.join(work, 'jest.mutation.setup.cjs'), jestSetupSource(repoRoot));
    fs.writeFileSync(cfg, `const base = require(${JSON.stringify(path.join(repoRoot, 'jest.config.cjs'))});
module.exports = { ...base, rootDir: ${JSON.stringify(repoRoot)}, verbose: false, cacheDirectory: ${JSON.stringify(path.join(work, 'jest-cache'))},
  setupFilesAfterEnv: [...(base.setupFilesAfterEnv || []), ${JSON.stringify(path.join(work, 'jest.mutation.setup.cjs'))}] };
`);
  }
  const json = path.join(work, 'jest-out', `${path.basename(log, '.log')}.json`);
  fs.mkdirSync(path.dirname(json), { recursive: true });
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...(mutantFile !== undefined ? { RULE_MUTANT_FILE: mutantFile } : {}) };
  const jest = path.join(repoRoot, 'node_modules/.bin/jest');
  // Exact paths (not regexes): --runTestsByPath.
  const r = await sh(jest, ['--config', cfg, '--maxWorkers=2', '--forceExit', '--silent', '--json', '--outputFile', json, '--runTestsByPath', ...files], { cwd: repoRoot, timeoutMs: 900_000, env, log });
  if (!fs.existsSync(json)) return { passed: 0, failed: 0, skipped: 0, failing: [], error: r.timedOut ? 'timeout' : `no jest JSON (exit ${String(r.code)})` };
  const j = readJson<{ numPassedTests: number; numFailedTests: number; numPendingTests: number; testResults: { name: string; message: string; assertionResults: { fullName: string; status: string; failureMessages?: string[] }[] }[] }>(json);
  const failing: string[] = [];
  const messages: Record<string, string> = {};
  for (const t of j.testResults) {
    const rel = path.relative(repoRoot, t.name);
    const f = t.assertionResults.filter((a) => a.status === 'failed');
    for (const a of f) {
      failing.push(`${rel} > ${a.fullName}`);
      if (withMessages) messages[`${rel} > ${a.fullName}`] = (a.failureMessages ?? []).join(' ').replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim() !== '')?.trim().slice(0, 240) ?? '';
    }
    if (f.length === 0 && t.message !== '' && t.assertionResults.length === 0) failing.push(`${rel} > (suite failed to run)`);
  }
  return { passed: j.numPassedTests, failed: j.numFailedTests, skipped: j.numPendingTests, failing, ...(withMessages ? { messages } : {}) };
}

// ── Semantic suite (after the first run) ──────────────────────────────────────
//
// `tests/unit/semantic-rules/` runs each scored rule's real compiled query through cypher-interp on hand-built graphs.
// Step `semantic` runs that suite alone under every valid mutant and control (jest --maxWorkers=2, the same in-memory
// mutant setup file as step `jest`). Step `score-semantic` merges it with the first run's results (`--before`, the
// committed JSON: reference/devset outcome and the earlier unit suites per mutant, which this step does not re-run:
// both are deterministic and nothing they read changed) and writes the before/after tallies.

const SEMANTIC_SUITE = ['tests/unit/semantic-rules/semantic-rules.test.ts'];

/** A failing semantic test whose message shows the compile or the query failing, not a wrong set of findings. */
const LOUD_FAILURE = /COMPILE_FAILED|QUERY_FAILED|role names|ingest (nodes|edges)/;

/**
 * Survivors classified by reading the template (they survive the sets, the earlier unit suites and the semantic suite).
 * Group C: logically equivalent (a redundant guard, an implied conjunct, a duplicate row removed downstream).
 * Group B: equivalent on the extractor's graph schema or on every preset's configuration (no project can tell the
 * difference today; a later extractor edge or preset could). Checked against the measured survivors in
 * `score-semantic`: a mutant listed here that some suite kills, or a survivor not listed, fails the step.
 */
const NULL_GUARD = 'C: null guard made redundant by a later conjunct (a null layer fails it too)';
const FILE_ONLY = 'B: only File nodes carry IMPORTS / RE_EXPORTS edges, and they end on File or Package nodes';
const EQUIVALENT: ReadonlyArray<readonly [RegExp, string]> = [
  [/^order-by$/, 'C: row order; findings are compared as a set and the only LIMIT (the cycle cap) is pinned separately'],
  [/^(cypher\/(dependency-direction|no-layer-skip)|hexagonal\/(dependency-direction-graph|layer-skip-graph))\/drop-conjunct\/[12]$/, NULL_GUARD],
  [/^hexagonal\/core-isolation\/drop-conjunct\/2$/, NULL_GUARD],
  [/^cypher\/use-case-isolation\/drop-conjunct\/4$/, NULL_GUARD],
  [/^cypher\/dependency-direction\/drop-conjunct\/3$/, 'C: implied by srcIdx < tgtIdx'],
  [/^cypher\/dependency-direction\/drop-conjunct\/[45]$/, 'B (config): $layerOrder is the spec\'s whole layer list, so every non-null layer has an index >= 0'],
  [/^hexagonal\/dependency-direction-graph\/drop-conjunct\/3$/, 'B (config): with src.layer = tgt.layer the next conjunct needs "x>x" in $allowedDependencies; no preset allows a layer to itself'],
  [/^hexagonal\/dependency-direction-graph\/drop-conjunct\/4$/, 'B (config): differs only when both a>b and b>a are allowed; no preset allows a symmetric pair'],
  [/^(cypher\/dependency-inversion|hexagonal\/port-dependency-inversion)\/drop-conjunct\/2$/, 'C: the MATCH guarantees at least one dependency'],
  [/^ddd-literal-view\/context-isolation\/drop-conjunct\/[34]$/, 'C: srcCtx[0] <> tgtCtx[0] is null on an empty list'],
  [/^cypher\/no-cyclic-deps\/remove-distinct\/1$/, 'C: the next WITH groups by cycle, so duplicate paths collapse anyway (blind spot A11)'],
  [/^ddd\/domain-event-placement\/remove-distinct\/1$/, 'C: duplicate rows carry the same violation id and are merged by mergeById (blind spot A10, DISTINCT part)'],
  [/^ddd\/bounded-context-modules\/label-rel\/1$/, 'C: a Class or Method row has its File\'s filePath, so it merges into the File\'s violation (same id)'],
  [/^(cypher\/(dependency-direction|no-layer-skip|no-domain-outward-dep)|hexagonal\/(dependency-direction-graph|layer-skip-graph|core-isolation)|ddd\/(aggregate-boundary|repository-aggregate-root)|ddd-literal-view\/context-isolation)\/label-rel\/[12]$/, FILE_ONLY],
  [/^cypher\/no-cyclic-deps\/label-rel\/1$/, FILE_ONLY],
  [/^cypher\/domain-purity\/label-rel\/1$/, FILE_ONLY],
  [/^cypher\/domain-purity\/label-rel\/2$/, 'B: a File reached by IMPORTS has a file name (with extension, no slash), never a package specifier from the list'],
  [/^cypher\/domain-state-purity\/(label-rel\/1|drop-conjunct\/3)$/, 'B: FLOWS_TO and CONSTRUCTOR_INJECTS start at classes and end at classes or interfaces'],
  [/^(cypher\/(dependency-inversion|use-case-isolation)|hexagonal\/port-dependency-inversion)\/label-rel\/1$/, 'B: only classes carry CONSTRUCTOR_INJECTS'],
  [/^cypher\/controller-no-entity\/label-rel\/1$/, 'B: only classes carry CONSTRUCTOR_INJECTS, and IMPORTS from a File never reaches a Class'],
  [/^cypher\/controller-no-entity\/label-rel\/4$/, 'B: IMPORTS never connects two classes, so the IMPORTS alternative of the frozen FF-P05 branch is dead on the APG schema'],
  [/^ddd\/application-service-thin\/label-rel\/[23]$/, 'B: a class reaches Method nodes only through CONTAINS, and CONTAINS ends only on Method nodes'],
  [/^ddd-member-fact\/value-object-immutability\/label-rel\/1$/, 'B: only classes carry member facts (publicFields, setAccessors, mutatorMethods)'],
];

function equivalenceOf(id: string, operator: string): string | undefined {
  const key = operator === 'order-by' && id !== 'cypher/no-cyclic-deps/order-by/1' ? 'order-by' : id;
  return EQUIVALENT.find(([re]) => re.test(key))?.[1];
}

async function semanticStep(repoRoot: string, work: string, mutants: readonly Mutant[], jobs: number, log: (s: string) => void): Promise<void> {
  const dir = path.join(work, 'semantic');
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, '__baseline__.json');
  if (!fs.existsSync(base)) writeJson(base, await runJest(repoRoot, work, SEMANTIC_SUITE, undefined, path.join(dir, '__baseline__.log'), true));
  const b = readJson<JestOutcome>(base);
  log(`semantic baseline: ${String(b.passed)} pass, ${String(b.failed)} fail`);
  if (b.failed > 0 || b.passed === 0) throw new Error(`semantic suite does not pass unmutated: ${b.failing.join('; ')}`);
  const todo = mutants.filter((m) => m.valid === true && !fs.existsSync(path.join(dir, `${m.id.replace(/\//g, '__')}.json`)));
  log(`semantic: ${String(todo.length)} mutants and controls`);
  let done = 0;
  await pool(todo, jobs, async (m) => {
    const stem = m.id.replace(/\//g, '__');
    const mf = path.join(dir, `${stem}.mutant.json`);
    writeJson(mf, { catalogue: m.catalogue, name: m.name, text: m.text });
    writeJson(path.join(dir, `${stem}.json`), await runJest(repoRoot, work, SEMANTIC_SUITE, mf, path.join(dir, `${stem}.log`), true));
    fs.rmSync(mf, { force: true });
    done += 1;
    if (done % 25 === 0) log(`semantic: ${String(done)}/${String(todo.length)}`);
  });
}

type Row = Record<string, unknown> & { id: string; operator: string; inScope: string[]; catalogue: string; rule: string; status?: string; reference?: { status: string }; unit?: { status: string } };

function scoreSemantic(repoRoot: string, work: string, beforeFile: string, outFile: string, log: (s: string) => void): void {
  const before = readJson<{ mutants: Row[]; controls: Row[] }>(beforeFile);
  const dir = path.join(work, 'semantic');
  const base = readJson<JestOutcome>(path.join(dir, '__baseline__.json'));
  const outcome = (id: string): JestOutcome | undefined => {
    const f = path.join(dir, `${id.replace(/\//g, '__')}.json`);
    return fs.existsSync(f) ? readJson<JestOutcome>(f) : undefined;
  };
  // Text pins: semantic tests failing under the behaviour-neutral whitespace control (expected: none).
  const textPins = new Set<string>();
  for (const c of before.controls.filter((x) => x.operator === 'whitespace')) for (const t of outcome(c.id)?.failing ?? []) textPins.add(t);
  const semanticOf = (id: string): Record<string, unknown> => {
    const j = outcome(id);
    if (j === undefined) return { status: 'not-run' };
    if (j.error !== undefined) return { status: `error: ${j.error}` };
    const fails = j.failing.filter((t) => !base.failing.includes(t) && !textPins.has(t));
    const caseOf = (t: string): string => t.replace(/^.*> /, '');
    const loud = fails.filter((t) => LOUD_FAILURE.test(j.messages?.[t] ?? ''));
    return {
      status: fails.length === 0 ? 'survived' : loud.length === fails.length ? 'killed-loud' : 'killed',
      failingCases: fails.map(caseOf).slice(0, 8),
      failingCount: fails.length,
      ...(loud.length > 0 ? { loudFailures: loud.slice(0, 3).map((t) => `${caseOf(t)}: ${j.messages?.[t] ?? ''}`) } : {}),
    };
  };
  const controls = before.controls.map((c) => ({ id: c.id, operator: c.operator, inScope: c.inScope.length > 0, semantic: semanticOf(c.id) }));
  const rows = before.mutants.map((m) => {
    if (m.status === 'stillborn') return { ...m };
    const semantic = semanticOf(m.id);
    const sets = m.reference?.status === 'killed';
    const unit = m.unit?.status === 'killed';
    const sem = semantic.status === 'killed' || semantic.status === 'killed-loud';
    const anyAfter = sets || unit || sem;
    // Equivalence is about behaviour: a listed mutant may still fail a text-asserting unit test.
    const equivalent = sets || sem ? undefined : equivalenceOf(m.id, m.operator);
    return { ...m, semantic, after: { setsStrict: sets, oldUnit: unit, semantic: sem, setsOrSemantic: sets || sem, any: anyAfter, ...(equivalent !== undefined ? { equivalent } : {}) } };
  });
  // The equivalence table must match the measurement: no listed mutant killed behaviourally (by a set or a semantic
  // test), no in-scope behavioural survivor unlisted.
  const contradictions = rows.filter((r) => (r as { after?: { setsOrSemantic: boolean } }).after?.setsOrSemantic === true && r.inScope.length > 0 && equivalenceOf(r.id, r.operator) !== undefined).map((r) => r.id);
  const unlisted = rows.filter((r) => r.inScope.length > 0 && (r as { after?: { any: boolean; equivalent?: string } }).after !== undefined
    && (r as { after: { setsOrSemantic: boolean } }).after.setsOrSemantic === false && (r as { after: { equivalent?: string } }).after.equivalent === undefined).map((r) => r.id);
  if (contradictions.length > 0) throw new Error(`equivalence table lists killed mutants: ${contradictions.join(', ')}`);

  interface T { mutants: number; stillborn: number; notExercised: number; unmeasurable: number; equivalent: number; setsStrict: number; oldUnit: number; beforeAny: number;
    semantic: number; semanticLoud: number; setsOrSemantic: number; afterAny: number; survivedAll: number; survivedNonEquivalent: number; behaviouralSurvivorsNonEquivalent: number }
  const tally = (pick: (r: Row) => boolean, group: (r: Row) => string): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const r of rows as Row[]) {
      if (!pick(r) || r.status === 'stillborn') continue;
      const g = group(r);
      const t = out[g] ?? { mutants: 0, stillborn: 0, notExercised: 0, unmeasurable: 0, equivalent: 0, setsStrict: 0, oldUnit: 0, beforeAny: 0, semantic: 0, semanticLoud: 0, setsOrSemantic: 0, afterAny: 0, survivedAll: 0, survivedNonEquivalent: 0, behaviouralSurvivorsNonEquivalent: 0 };
      const a = (r as unknown as { after: { setsStrict: boolean; oldUnit: boolean; semantic: boolean; setsOrSemantic: boolean; any: boolean; equivalent?: string } }).after;
      const sem = (r as unknown as { semantic: { status: string } }).semantic;
      t.mutants += 1;
      if (r.reference?.status === 'not-exercised') t.notExercised += 1;
      if (r.reference?.status === 'unmeasurable-on-interp') t.unmeasurable += 1;
      if (a.setsStrict) t.setsStrict += 1;
      if (a.oldUnit) t.oldUnit += 1;
      if (a.setsStrict || a.oldUnit) t.beforeAny += 1;
      if (a.semantic) t.semantic += 1;
      if (sem.status === 'killed-loud') t.semanticLoud += 1;
      if (a.setsOrSemantic) t.setsOrSemantic += 1;
      if (a.equivalent !== undefined) t.equivalent += 1;
      if (a.any) t.afterAny += 1;
      else {
        t.survivedAll += 1;
        if (a.equivalent === undefined) t.survivedNonEquivalent += 1;
      }
      if (!a.setsOrSemantic && a.equivalent === undefined) t.behaviouralSurvivorsNonEquivalent += 1;
      out[g] = t;
    }
    return out;
  };
  const inScope = (r: Row): boolean => r.inScope.length > 0;
  writeJson(outFile, {
    schema: 'v1.3-rule-mutation-semantic/1',
    generated: new Date().toISOString(),
    before: path.relative(repoRoot, beforeFile),
    suite: SEMANTIC_SUITE,
    engine: 'cypher-interp (in process) through jest --maxWorkers=2; each case compiles its style\'s reference spec with V13_COMPILE_OPTIONS (instrument v2) and runs the rule\'s compiled query via evaluateSymbolic',
    definitions: {
      setsStrict: 'first run: some expected finding of the reference set (author or blind key) or devset-b changes status',
      oldUnit: 'first run: a test of the earlier unit suites fails (text pins excluded); these tests assert on the template text',
      semantic: 'a semantic-rules test that passes unmutated fails under the mutant (tests failing under the whitespace control excluded: none do)',
      semanticLoud: 'semantic kill where every failing test shows the compile or the query failing (role-name guard, type error), not a wrong finding set',
      setsOrSemantic: 'behavioural kill: setsStrict or semantic (excludes the text-asserting unit tests)',
      afterAny: 'setsStrict or oldUnit or semantic',
      equivalent: 'killed neither by a set nor by a semantic test, and classified equivalent by reading the template (EQUIVALENT in scripts/v1.3/rule-mutation.ts); a text-asserting unit test may still fail on it',
      behaviouralSurvivorsNonEquivalent: 'neither setsStrict nor semantic, and not classified equivalent',
    },
    semanticBaseline: base,
    semanticTextPins: [...textPins].sort(),
    unclassifiedSurvivors: unlisted,
    totals: tally(() => true, () => 'all'),
    totalsInScope: tally(() => true, (r) => (inScope(r) ? 'in-scope' : 'out-of-scope')),
    byOperatorInScope: tally(inScope, (r) => r.operator),
    byOperator: tally(() => true, (r) => r.operator),
    byRule: tally(() => true, (r) => `${r.catalogue}/${r.rule}`),
    controls,
    mutants: rows,
  });
  log(`score-semantic: wrote ${outFile}; ${String(unlisted.length)} in-scope survivors not classified`);
}

async function main(argv: readonly string[]): Promise<number> {
  const repoRoot = process.cwd();
  if (argv[0] === '--worker') {
    await worker(argv[1] ?? '', argv[2] ?? '', argv[3] ?? '', argv[4] ?? '0');
    return 0;
  }
  const work = path.resolve(arg(argv, '--work') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rule-mutation-')));
  const devset = arg(argv, '--devset');
  const jobs = Number(arg(argv, '--jobs') ?? '2');
  const only = arg(argv, '--only');
  const outFile = path.resolve(repoRoot, arg(argv, '--out') ?? 'results/v1.3-rule-mutation/rule-mutation-2026-10-16.json');
  const filter = arg(argv, '--filter');
  fs.mkdirSync(work, { recursive: true });
  const log = (s: string): void => { process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${s}\n`); };
  const step = (s: string): boolean => only === undefined || only === s;

  // 1. Plan: every mutant of every catalogue entry, with its parse status.
  const mutantsFile = path.join(work, 'mutants.json');
  if (step('plan') || !fs.existsSync(mutantsFile)) {
    const all: Mutant[] = [];
    const shadowed: string[] = [];
    for (const e of entries()) {
      if (shadowedUnderV13(e)) { shadowed.push(`${e.catalogue}/${e.name}`); continue; }
      for (const m of generate(e)) {
        const p = parseStatus(m.text);
        m.valid = p.valid;
        if (p.reason !== undefined) m.invalidReason = p.reason;
        all.push(m);
      }
    }
    writeJson(mutantsFile, all);
    writeJson(path.join(work, 'shadowed.json'), shadowed);
    log(`plan: ${String(all.length)} mutants (${String(all.filter((m) => m.valid !== true).length)} do not parse), ${String(shadowed.length)} shadowed DDD entries`);
  }
  const mutants = readJson<Mutant[]>(mutantsFile).filter((m) => filter === undefined || m.id.includes(filter));

  // Semantic suite (separate steps after the first run; they need only the plan).
  if (only === 'semantic') {
    await semanticStep(repoRoot, work, mutants, jobs, log);
    return 0;
  }
  if (only === 'score-semantic') {
    scoreSemantic(repoRoot, work, path.resolve(repoRoot, arg(argv, '--before') ?? 'results/v1.3-rule-mutation/rule-mutation-2026-10-16.json'),
      path.resolve(repoRoot, arg(argv, '--out') ?? 'results/v1.3-rule-mutation/after-semantic-tests/rule-mutation-semantic-2026-10-16.json'), log);
    return 0;
  }

  // 2. Baseline: materialise every case once, run unmutated, record which entries each style's compile reads.
  const baselineFile = path.join(work, 'baseline.json');
  if (step('baseline') || !fs.existsSync(baselineFile)) {
    const cases = materialiseAll(repoRoot, devset, work);
    const record = new Map<string, Set<string>>();
    const apg = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-apg-'));
    const t0 = Date.now();
    const { findings, errors } = await runCases(cases, apg, record);
    // The worker caches the extraction: a second, cached pass must give the same rows and failures.
    enableExtractCache();
    await runCases(cases, apg);
    const cached = await runCases(cases, apg);
    const cacheMismatch = cases.filter((c) => JSON.stringify(cached.findings[caseKey(c)]) !== JSON.stringify(findings[caseKey(c)]) || cached.errors[caseKey(c)] !== errors[caseKey(c)]).map(caseKey);
    if (cacheMismatch.length > 0) throw new Error(`extraction cache changes the rows of ${cacheMismatch.join(', ')}`);
    fs.rmSync(apg, { recursive: true, force: true });
    const exercised = Object.fromEntries([...record].map(([k, v]) => [k, [...v].sort()]));
    // Agreement with the committed live reference outputs (Neo4j), per case.
    const committed: Record<string, string> = {};
    for (const dir of ['after-member-facts', 'after-fixes', 'baseline-pre-barrel']) {
      let same = 0;
      let n = 0;
      for (const c of cases.filter((x) => x.set === 'reference')) {
        const f = path.join(repoRoot, 'results/v1.3-reference', dir, 'raw', c.style, `${c.variant}.json`);
        if (!fs.existsSync(f)) continue;
        n += 1;
        const want = readJson<{ findings: ActualFinding[] }>(f).findings.map(fKey).sort().join('\n');
        const got = (findings[caseKey(c)] ?? []).map(fKey).sort().join('\n');
        if (want === got) same += 1;
      }
      committed[dir] = `${String(same)}/${String(n)} cases with the same row multiset`;
    }
    writeJson(baselineFile, { cases, findings, errors, exercised, ms: Date.now() - t0, committed });
    log(`baseline: ${String(cases.length)} cases in ${String(Date.now() - t0)} ms, ${String(Object.keys(errors).length)} errors; committed agreement ${JSON.stringify(committed)}`);
  }
  const baseline = readJson<{ cases: Case[]; findings: Findings; errors: Errors; exercised: Record<string, string[]>; committed: Record<string, string> }>(baselineFile);

  // 3. Mutants: `jobs` long-lived workers; a mutant with no progress for 300 s is recorded as a timeout and its worker
  //    restarted on the rest of its list.
  const exercisedAny = new Set(Object.values(baseline.exercised).flat());
  if (step('mutants')) {
    const outOf = (id: string): string => path.join(work, 'mutants', `${id.replace(/\//g, '__')}.json`);
    const todo = mutants.filter((m) => m.valid === true && exercisedAny.has(`${m.catalogue}/${m.name}`) && m.operator !== 'whitespace' && !fs.existsSync(outOf(m.id)));
    log(`mutants: ${String(todo.length)} to run with ${String(jobs)} workers`);
    fs.mkdirSync(path.join(work, 'workers'), { recursive: true });
    fs.mkdirSync(path.join(work, 'mutants'), { recursive: true });
    const tsx = path.join(repoRoot, 'node_modules/.bin/tsx');
    const shares = Array.from({ length: jobs }, (_, n) => todo.filter((_m, i) => i % jobs === n).map((m) => m.id));
    await Promise.all(shares.map(async (ids, n) => {
      for (let attempt = 0; ; attempt += 1) {
        const rest = ids.filter((id) => !fs.existsSync(outOf(id)));
        if (rest.length === 0) return;
        const list = path.join(work, 'workers', `${String(n)}.list.json`);
        writeJson(list, rest);
        const current = path.join(work, 'workers', `${String(n)}.current`);
        const r = await new Promise<{ code: number | null; stderr: string; stalled: string | undefined }>((resolve) => {
          const c = spawn(tsx, [path.join(repoRoot, 'scripts/v1.3/rule-mutation.ts'), '--worker', mutantsFile, list, work, String(n)], { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
          let stderr = '';
          c.stderr.on('data', (d: Buffer) => { stderr = (stderr + d.toString()).slice(-4000); });
          let stalled: string | undefined;
          const timer = setInterval(() => {
            try {
              const st = fs.statSync(current);
              if (Date.now() - st.mtimeMs > 300_000) { stalled = fs.readFileSync(current, 'utf8'); c.kill('SIGKILL'); }
            } catch { /* no current file yet */ }
          }, 5000);
          c.on('close', (code) => { clearInterval(timer); resolve({ code, stderr, stalled }); });
        });
        const cur = r.stalled ?? (fs.existsSync(current) ? fs.readFileSync(current, 'utf8') : undefined);
        if (cur !== undefined && cur !== '' && !fs.existsSync(outOf(cur))) {
          writeJson(outOf(cur), { id: cur, crashed: r.stalled !== undefined ? 'timeout (no progress for 300 s)' : `worker exit ${String(r.code)}: ${r.stderr.slice(-300)}` });
        }
        fs.rmSync(current, { force: true });
        if (r.code !== 0 && r.stalled === undefined && cur === undefined) throw new Error(`worker ${String(n)} failed: ${r.stderr.slice(-500)}`);
        log(`worker ${String(n)}: ${String(ids.filter((id) => fs.existsSync(outOf(id))).length)}/${String(ids.length)} (attempt ${String(attempt + 1)})`);
      }
    }));
  }

  // 4. Unit tests: the catalogue's suite under each valid mutant (and the controls), jest --maxWorkers=2.
  if (step('jest')) {
    const suites = new Map<string, string[]>();
    for (const m of ALL_MAPS) if (!suites.has(m.suiteKey)) suites.set(m.suiteKey, suiteFiles(repoRoot, m.suiteKey));
    writeJson(path.join(work, 'suites.json'), Object.fromEntries(suites));
    fs.mkdirSync(path.join(work, 'jest'), { recursive: true });
    for (const [key, files] of suites) {
      const f = path.join(work, 'jest', `__baseline__${key}.json`);
      if (fs.existsSync(f)) continue;
      writeJson(f, await runJest(repoRoot, work, files, undefined, path.join(work, 'jest', `__baseline__${key}.log`)));
      log(`jest baseline ${key}: ${JSON.stringify(readJson<JestOutcome>(f)).slice(0, 200)}`);
    }
    const todo = mutants.filter((m) => m.valid === true && !fs.existsSync(path.join(work, 'jest', `${m.id.replace(/\//g, '__')}.json`)));
    log(`jest: ${String(todo.length)} mutants`);
    let done = 0;
    await pool(todo, jobs, async (m) => {
      const suiteKey = ALL_MAPS.find((x) => x.catalogue === m.catalogue)?.suiteKey ?? '';
      const mf = path.join(work, 'jest', `${m.id.replace(/\//g, '__')}.mutant.json`);
      writeJson(mf, { catalogue: m.catalogue, name: m.name, text: m.text });
      const r = await runJest(repoRoot, work, suites.get(suiteKey) ?? [], mf, path.join(work, 'jest', `${m.id.replace(/\//g, '__')}.log`));
      writeJson(path.join(work, 'jest', `${m.id.replace(/\//g, '__')}.json`), r);
      fs.rmSync(mf, { force: true });
      done += 1;
      if (done % 10 === 0) log(`jest: ${String(done)}/${String(todo.length)}`);
    });
  }

  // 5. Score.
  if (step('score')) {
    const authors = authorKeys(repoRoot, devset);
    const blind = blindKey(repoRoot, authors['reference-author']);
    const keys: Record<string, Key> = { 'reference-author': authors['reference-author'], 'reference-blind': blind.key, 'devset-b-author': authors['devset-b-author'] };
    const suites = fs.existsSync(path.join(work, 'suites.json')) ? readJson<Record<string, string[]>>(path.join(work, 'suites.json')) : {};
    const jestBase: Record<string, JestOutcome> = {};
    for (const k of Object.keys(suites)) {
      const f = path.join(work, 'jest', `__baseline__${k}.json`);
      if (fs.existsSync(f)) jestBase[k] = readJson<JestOutcome>(f);
    }
    // Text-pinning tests: tests that fail under the behaviour-neutral whitespace control.
    const textPins = new Set<string>();
    for (const m of mutants.filter((x) => x.operator === 'whitespace')) {
      const f = path.join(work, 'jest', `${m.id.replace(/\//g, '__')}.json`);
      if (!fs.existsSync(f)) continue;
      const suiteKey = ALL_MAPS.find((x) => x.catalogue === m.catalogue)?.suiteKey ?? '';
      const baseFail = new Set(jestBase[suiteKey]?.failing ?? []);
      for (const t of readJson<JestOutcome>(f).failing) if (!baseFail.has(t)) textPins.add(t);
    }

    // Rules the keys score: the template names of every style's scopeRules (reference and devset-b).
    const scopeOf = new Map<string, string[]>();
    for (const { set, refs } of loadSets(repoRoot, devset)) {
      for (const ref of refs) for (const r of ref.descriptor.scopeRules) scopeOf.set(r.ruleName, [...(scopeOf.get(r.ruleName) ?? []), `${set}:${ref.style}:${r.ruleId}${r.blockingCandidate ? ' (blocking)' : ''}`]);
    }
    const rows = mutants.map((m): Record<string, unknown> => {
      const exercisedIn = Object.entries(baseline.exercised).filter(([, v]) => v.includes(`${m.catalogue}/${m.name}`)).map(([k]) => k);
      const row: Record<string, unknown> = { id: m.id, catalogue: m.catalogue, file: m.file, rule: m.name, inScope: scopeOf.get(m.name) ?? [], operator: m.operator, site: m.site, description: m.description, valid: m.valid, ...(m.invalidReason !== undefined ? { invalidReason: m.invalidReason } : {}), exercisedIn };
      if (m.valid !== true) return { ...row, status: 'stillborn' };
      // Reference / devset outcome.
      let ref: Record<string, unknown> = { status: exercisedIn.length === 0 ? 'not-exercised' : 'not-run' };
      // An entry whose query already fails on the interpreter in the baseline cannot be measured there.
      const failsAtBaseline = Object.values(baseline.errors).some((e) => e.includes(`(${m.name})`));
      if (failsAtBaseline && exercisedIn.length > 0) ref = { status: 'unmeasurable-on-interp', reason: Object.values(baseline.errors).find((e) => e.includes(`(${m.name})`)) };
      const f = path.join(work, 'mutants', `${m.id.replace(/\//g, '__')}.json`);
      if (!failsAtBaseline && exercisedIn.length > 0 && fs.existsSync(f)) {
        const r = readJson<{ findings?: Findings; errors?: Errors; crashed?: string; ms?: number }>(f);
        if (r.crashed !== undefined) ref = { status: 'crashed', crashed: r.crashed };
        else {
          const mut: Findings = { ...baseline.findings, ...(r.findings ?? {}) };
          const errs = Object.keys(r.errors ?? {}).filter((k) => (r.errors ?? {})[k] !== baseline.errors[k]);
          const perKey: Record<string, { strict: number; broad: number; examples: KillDetail[] }> = {};
          for (const [kn, key] of Object.entries(keys)) {
            const k = killsBy(kn, key, baseline.findings, mut);
            perKey[kn] = { strict: k.strict.length, broad: k.broad.length, examples: [...k.strict, ...k.broad.filter((b) => !k.strict.some((s) => s.case === b.case))].slice(0, 4) };
          }
          const anyStrict = Object.values(perKey).some((p) => p.strict > 0);
          const anyBroad = Object.values(perKey).some((p) => p.broad > 0);
          const probeCases = Object.keys(r.findings ?? {}).filter((k) => k.startsWith('probe:'));
          const probeDiff = probeCases.filter((k) => (r.findings?.[k] ?? []).map(fKey).sort().join('\n') !== (baseline.findings[k] ?? []).map(fKey).sort().join('\n')
            || (r.errors ?? {})[k] !== baseline.errors[k]);
          ref = { status: anyStrict ? 'killed' : anyBroad ? 'killed-fp-only' : errs.filter((k) => !k.startsWith('probe:')).length > 0 ? 'errored' : 'survived', perKey,
            probe: probeCases.length === 0 ? 'not-applicable' : probeDiff.length > 0 ? `differs on ${probeDiff.map((k) => k.slice('probe:golden/'.length)).join(', ')}` : 'no difference', ...(errs.length > 0 ? { errors: errs.slice(0, 3).map((k) => `${k}: ${(r.errors ?? {})[k] ?? ''}`) } : {}), ms: r.ms };
        }
      }
      // Unit tests.
      let unit: Record<string, unknown> = { status: 'not-run' };
      const jf = path.join(work, 'jest', `${m.id.replace(/\//g, '__')}.json`);
      if (fs.existsSync(jf)) {
        const j = readJson<JestOutcome>(jf);
        const suiteKey = ALL_MAPS.find((x) => x.catalogue === m.catalogue)?.suiteKey ?? '';
        const baseFail = new Set(jestBase[suiteKey]?.failing ?? []);
        const newFail = j.failing.filter((t) => !baseFail.has(t));
        const behavioural = newFail.filter((t) => !textPins.has(t));
        unit = { status: j.error !== undefined ? `error: ${j.error}` : behavioural.length > 0 ? 'killed' : newFail.length > 0 ? 'killed-by-text-pin-only' : 'survived', newFailures: newFail.length, behaviouralFailures: behavioural.slice(0, 5), textPinFailures: newFail.filter((t) => textPins.has(t)).length };
      }
      return { ...row, reference: ref, unit };
    });

    const scored = rows.filter((r) => r.status !== 'stillborn' && OPERATORS.includes(r.operator as (typeof OPERATORS)[number]));
    const tally = (group: (r: (typeof rows)[number]) => string): Record<string, Record<string, number>> => {
      const out: Record<string, Record<string, number>> = {};
      for (const r of scored) {
        const g = group(r);
        const ref = (r as { reference?: { status: string; perKey?: Record<string, { strict: number; broad: number }> } }).reference;
        const unit = (r as { unit?: { status: string } }).unit;
        const t = out[g] ?? { mutants: 0, notExercised: 0, refKilled: 0, refKilledFpOnly: 0, refErrored: 0, refSurvived: 0, refAuthor: 0, refBlind: 0, devsetB: 0, unitKilled: 0, unitTextPinOnly: 0, anyKilled: 0, survivedAll: 0, survivedProbeDiffers: 0, unmeasurable: 0 };
        t.mutants = (t.mutants ?? 0) + 1;
        const s = ref?.status ?? '';
        if (s === 'not-exercised') t.notExercised = (t.notExercised ?? 0) + 1;
        if (s === 'killed') t.refKilled = (t.refKilled ?? 0) + 1;
        if (s === 'killed-fp-only') t.refKilledFpOnly = (t.refKilledFpOnly ?? 0) + 1;
        if (s === 'errored' || s === 'crashed') t.refErrored = (t.refErrored ?? 0) + 1;
        if (s === 'survived' || s === 'not-exercised') t.refSurvived = (t.refSurvived ?? 0) + 1;
        if ((ref?.perKey?.['reference-author']?.strict ?? 0) > 0) t.refAuthor = (t.refAuthor ?? 0) + 1;
        if ((ref?.perKey?.['reference-blind']?.strict ?? 0) > 0) t.refBlind = (t.refBlind ?? 0) + 1;
        if ((ref?.perKey?.['devset-b-author']?.strict ?? 0) > 0) t.devsetB = (t.devsetB ?? 0) + 1;
        if (unit?.status === 'killed') t.unitKilled = (t.unitKilled ?? 0) + 1;
        if (unit?.status === 'killed-by-text-pin-only') t.unitTextPinOnly = (t.unitTextPinOnly ?? 0) + 1;
        const any = s === 'killed' || unit?.status === 'killed';
        if (s === 'unmeasurable-on-interp') t.unmeasurable = (t.unmeasurable ?? 0) + 1;
        if (any) t.anyKilled = (t.anyKilled ?? 0) + 1;
        else {
          t.survivedAll = (t.survivedAll ?? 0) + 1;
          if (((ref as { probe?: string } | undefined)?.probe ?? '').startsWith('differs')) t.survivedProbeDiffers = (t.survivedProbeDiffers ?? 0) + 1;
        }
        out[g] = t;
      }
      return out;
    };
    const controls = rows.filter((r) => r.operator === 'canary' || r.operator === 'whitespace');
    writeJson(outFile, {
      schema: 'v1.3-rule-mutation/1',
      generated: new Date().toISOString(),
      engine: 'cypher-interp (in process), v1.3 defaults: scoring v1.3, instrument v2, V13_COMPILE_OPTIONS',
      definitions: {
        killedStrict: 'some expected finding of some key changes status (matched <-> missed) on some case',
        killedFpOnly: 'only the in-scope unexpected rows change (false positives appear or disappear); no expected finding changes',
        errored: 'the mutated query fails at run time on some case (the pipeline reports a query failure)',
        notExercised: 'no reference or devset-b style compiles the entry, so no case can see the mutant',
        unitKilled: 'a unit test of the catalogue suite that passes unmutated fails, excluding text-pinning tests (those failing under the whitespace control)',
        blindKey: 'blind-expanded key rebuilt from results/v1.3-reference/baseline-pre-barrel/adjudication.csv (see blindKeyCheck)',
      },
      blindKeyCheck: blind.check,
      baseline: { cases: baseline.cases.length, errors: baseline.errors, committedAgreement: baseline.committed, exercised: baseline.exercised },
      suites,
      jestBaseline: jestBase,
      textPinningTests: [...textPins].sort(),
      shadowed: fs.existsSync(path.join(work, 'shadowed.json')) ? readJson<string[]>(path.join(work, 'shadowed.json')) : [],
      totals: tally(() => 'all').all,
      totalsInScope: tally((r) => ((r.inScope as string[]).length > 0 ? 'in-scope' : 'out-of-scope')),
      byOperatorInScope: Object.fromEntries(Object.entries(tally((r) => `${(r.inScope as string[]).length > 0 ? 'in' : 'out'}|${String(r.operator)}`)).filter(([k]) => k.startsWith('in|')).map(([k, v]) => [k.slice(3), v])),
      scopeOf: Object.fromEntries(scopeOf),
      byOperator: tally((r) => String(r.operator)),
      byRule: tally((r) => `${String(r.catalogue)}/${String(r.rule)}`),
      controls,
      mutants: rows.filter((r) => r.operator !== 'canary' && r.operator !== 'whitespace'),
    });
    log(`score: wrote ${outFile}`);
  }
  return 0;
}

void main(process.argv.slice(2)).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
