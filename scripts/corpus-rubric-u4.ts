/**
 * Corpus rubric step (BR-U4-RUB-03; FR-22, U4 Q13 A). Pure module (D-U4-10): no direct-run guard; the CLI
 * entry is `scripts/corpus-rubric-u4-cli.ts`. Run by Build and Test corpus preparation as the fourth corpus
 * commit `FR-22 (U4 rubric)`, after U1's three (copy, FR-22, CV02) and before the first corpus run.
 *
 * `applyRubric` sets FF-N01/FF-N02 `name`, `semantic_criteria.rule` and `semantic_criteria.rubric.{pass, fail,
 * evidence_required}` to the single source `src/llm-critic/rubric.ts` (the text U4-K6 wrote into the presets).
 * Scalars are located with the `yaml` Document API and replaced by source range, so every byte outside the
 * edited scalars (comments, key order, quoting of other keys, layout) is kept. A declared function missing one
 * of those keys is left as it is and reported in `untouched`. Idempotent: a rerun on the output edits nothing.
 * `assertNoOldRubric` throws when any function still carries a retired name or SRP rubric text.
 */
import { parseDocument, isMap, isSeq, isScalar } from 'yaml';
import type { Document, Scalar, YAMLMap } from 'yaml';
import {
  FF_N01_ID, FF_N01_NAME, FF_N01_RUBRIC, FF_N02_ID, FF_N02_NAME, FF_N02_RUBRIC, RETIRED_RUBRIC_NAMES,
} from '../src/llm-critic/rubric.js';
import type { RubricText } from '../src/llm-critic/rubric.js';

export interface RubricStepResult {
  readonly text: string;
  /** True when `text` differs from the input. */
  readonly edited: boolean;
  /** Key paths edited, in document order (for `Docs/corpus.md`). */
  readonly editedPaths: readonly string[];
  /** Expected targets left untouched, with the reason. */
  readonly untouched: readonly string[];
}

interface Edit { readonly start: number; readonly end: number; readonly replacement: string; readonly path: string }

const TARGETS: readonly (readonly [string, string, RubricText])[] = [
  [FF_N01_ID, FF_N01_NAME, FF_N01_RUBRIC],
  [FF_N02_ID, FF_N02_NAME, FF_N02_RUBRIC],
];

/** SRP rubric text retired with `srp-semantic` (BR-U4-RUB-01 grep). */
const SRP_TEXT = /reason to change/i;

function parse(text: string): Document {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error(`YAML parse error: ${doc.errors.map((e) => e.message).join('; ')}`);
  return doc;
}

function functions(doc: Document): YAMLMap[] {
  const seq = doc.get('fitness_functions', true);
  return isSeq(seq) ? seq.items.filter(isMap) : [];
}

function render(node: Scalar, value: string, original: string): string {
  if (node.type === 'QUOTE_SINGLE') return `'${value.replace(/'/g, "''")}'`;
  if (node.type === 'PLAIN' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return value;
  // Double-quoted for everything else; a block scalar's range ends after its line break, which is kept.
  const tail = (node.type === 'BLOCK_LITERAL' || node.type === 'BLOCK_FOLDED') && original.endsWith('\n') ? '\n' : '';
  return JSON.stringify(value) + tail;
}

function scalarEdit(text: string, map: YAMLMap, key: string, value: string, path: string, edits: Edit[], untouched: string[]): void {
  const node = map.get(key, true);
  if (!isScalar(node) || node.range == null) { untouched.push(`${path}: key not declared`); return; }
  if (node.value === value) return;
  const [start, end] = node.range;
  edits.push({ start, end, replacement: render(node, value, text.slice(start, end)), path });
}

/** Apply the U4 rubric (names and semantic criteria of FF-N01/FF-N02) to a spec's YAML text. Pure. */
export function applyRubric(text: string): RubricStepResult {
  const doc = parse(text);
  const fns = functions(doc);
  const edits: Edit[] = [];
  const untouched: string[] = [];
  for (const [id, name, rubric] of TARGETS) {
    const base = `fitness_functions[${id}]`;
    const fn = fns.find((f) => f.get('id') === id);
    if (!fn) { untouched.push(`${base}: ${id} not declared`); continue; }
    scalarEdit(text, fn, 'name', name, `${base}.name`, edits, untouched);
    const sc = fn.get('semantic_criteria', true);
    if (!isMap(sc)) { untouched.push(`${base}.semantic_criteria: key not declared`); continue; }
    scalarEdit(text, sc, 'rule', rubric.rule, `${base}.semantic_criteria.rule`, edits, untouched);
    const rb = sc.get('rubric', true);
    if (!isMap(rb)) { untouched.push(`${base}.semantic_criteria.rubric: key not declared`); continue; }
    const p = `${base}.semantic_criteria.rubric`;
    scalarEdit(text, rb, 'pass', rubric.pass, `${p}.pass`, edits, untouched);
    scalarEdit(text, rb, 'fail', rubric.fail, `${p}.fail`, edits, untouched);
    scalarEdit(text, rb, 'evidence_required', rubric.evidenceRequired, `${p}.evidence_required`, edits, untouched);
  }
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return {
    text: out,
    edited: out !== text,
    editedPaths: [...edits].sort((a, b) => a.start - b.start).map((e) => e.path),
    untouched,
  };
}

/** Throws when any declared function carries a retired rubric name or SRP rubric text (BR-U4-RUB-03). */
export function assertNoOldRubric(text: string): void {
  const problems: string[] = [];
  for (const fn of functions(parse(text))) {
    const id = String(fn.get('id'));
    const name = fn.get('name');
    if (typeof name === 'string' && (RETIRED_RUBRIC_NAMES as readonly string[]).includes(name)) {
      problems.push(`${id}: retired name ${name}`);
    }
    const sc = fn.get('semantic_criteria', true);
    if (isMap(sc) && SRP_TEXT.test(JSON.stringify(sc.toJSON()))) problems.push(`${id}: SRP rubric text`);
  }
  if (problems.length > 0) throw new Error(`old rubric present: ${problems.join('; ')}`);
}

/** Built-in spec for `--self-test`: FF-N01 still carries the old name, so `assertNoOldRubric` must fail. */
export const SELF_TEST_SPEC = `spec_version: "1.0.0"
fitness_functions:
  - id: FF-N01
    name: srp-semantic
    dimension: integrity
`;
