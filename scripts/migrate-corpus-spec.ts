/**
 * Scripted corpus-spec migration (BR-U1-25; FR-22, ADR-015 items 3, 4, 10). Pure module (D-U1-15):
 * no direct-run guard; the CLI entry is `scripts/migrate-corpus-spec-cli.ts`.
 *
 * Steps (each its own corpus commit, run by Build and Test corpus preparation):
 * - `fr22`: FF-N01 `dimension: integrity`, `route: neuronal`; FF-N02 `dimension: semantic`;
 *   `scoring.full_mode_weights.intent` key renamed to `integrity` (value kept).
 * - `cv02`: FF-CV02 `pattern: "*Service"` -> `"*Service|*UseCase"`, only when the value is exactly `*Service`;
 *   any other value leaves the file untouched and is reported.
 *
 * Nodes are located with the `yaml` Document API and edited in place by source range, so every byte outside
 * the edited scalars (comments, key order, quoting, layout) is kept. Idempotent: a rerun on the output edits nothing.
 */
import * as fs from 'node:fs';
import { parseDocument, isMap, isSeq, isScalar } from 'yaml';
import type { Document, Scalar, YAMLMap } from 'yaml';

export type MigrationStep = 'fr22' | 'cv02';

export interface MigrationResult {
  readonly text: string;
  /** Key paths edited, in document order (for `Docs/corpus.md`). */
  readonly editedPaths: string[];
  /** Expected targets left untouched, with the reason. */
  readonly untouched: string[];
}

export const CV02_FROM = '*Service';
export const CV02_TO = '*Service|*UseCase';

interface Edit { readonly start: number; readonly end: number; readonly replacement: string; readonly path: string }

function renderScalar(node: Scalar, value: string): string {
  if (node.type === 'QUOTE_SINGLE') return `'${value.replace(/'/g, "''")}'`;
  if (node.type === 'PLAIN' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return value;
  return JSON.stringify(value);
}

function findFunction(doc: Document, id: string): YAMLMap | undefined {
  const seq = doc.get('fitness_functions', true);
  if (!isSeq(seq)) return undefined;
  for (const item of seq.items) {
    if (isMap(item) && item.get('id') === id) return item;
  }
  return undefined;
}

function valueEdit(fn: YAMLMap, key: string, value: string, path: string): Edit | 'same' | 'missing' {
  const node = fn.get(key, true);
  if (!isScalar(node) || node.range == null) return 'missing';
  if (node.value === value) return 'same';
  return { start: node.range[0], end: node.range[1], replacement: renderScalar(node, value), path };
}

function collectFr22(doc: Document, edits: Edit[], untouched: string[]): void {
  const targets: [string, string, string][] = [
    ['FF-N01', 'dimension', 'integrity'],
    ['FF-N01', 'route', 'neuronal'],
    ['FF-N02', 'dimension', 'semantic'],
  ];
  for (const [id, key, value] of targets) {
    const path = `fitness_functions[${id}].${key}`;
    const fn = findFunction(doc, id);
    if (!fn) { untouched.push(`${path}: ${id} not declared`); continue; }
    const e = valueEdit(fn, key, value, path);
    if (e === 'missing') untouched.push(`${path}: key not declared`);
    else if (e !== 'same') edits.push(e);
  }

  const path = 'scoring.full_mode_weights.intent';
  const fmw = doc.getIn(['scoring', 'full_mode_weights'], true);
  if (!isMap(fmw)) { untouched.push(`${path}: scoring.full_mode_weights not declared`); return; }
  const pairs = fmw.items;
  const intent = pairs.find((p) => isScalar(p.key) && p.key.value === 'intent');
  const hasIntegrity = pairs.some((p) => isScalar(p.key) && p.key.value === 'integrity');
  if (!intent) return; // already migrated (or never declared): nothing to do
  if (hasIntegrity) { untouched.push(`${path}: both intent and integrity declared`); return; }
  const key = intent.key as Scalar;
  if (key.range == null) { untouched.push(`${path}: key has no source range`); return; }
  edits.push({ start: key.range[0], end: key.range[1], replacement: renderScalar(key, 'integrity'), path });
}

function collectCv02(doc: Document, edits: Edit[], untouched: string[]): void {
  const path = 'fitness_functions[FF-CV02].pattern';
  const fn = findFunction(doc, 'FF-CV02');
  if (!fn) { untouched.push(`${path}: FF-CV02 not declared`); return; }
  const node = fn.get('pattern', true);
  if (!isScalar(node) || node.range == null) { untouched.push(`${path}: key not declared`); return; }
  if (node.value === CV02_TO) return; // already migrated
  if (node.value !== CV02_FROM) {
    untouched.push(`${path}: value ${JSON.stringify(node.value)} is not exactly ${JSON.stringify(CV02_FROM)}`);
    return;
  }
  edits.push({ start: node.range[0], end: node.range[1], replacement: renderScalar(node, CV02_TO), path });
}

/** Apply one migration step to a spec's YAML text. Pure. */
export function migrate(text: string, step: MigrationStep): MigrationResult {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    throw new Error(`YAML parse error: ${doc.errors.map((e) => e.message).join('; ')}`);
  }
  const edits: Edit[] = [];
  const untouched: string[] = [];
  if (step === 'fr22') collectFr22(doc, edits, untouched);
  else collectCv02(doc, edits, untouched);

  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }
  return { text: out, editedPaths: [...edits].sort((a, b) => a.start - b.start).map((e) => e.path), untouched };
}

const SELF_TEST_SPEC = `spec_version: "1.0.0"
fitness_functions:
  - id: FF-CV02
    name: naming-services
    pattern: "*Foo"
`;

const USAGE = 'usage: npx tsx scripts/migrate-corpus-spec-cli.ts --step fr22|cv02 <file> | --self-test\n';

/**
 * CLI behaviour. Exit codes: 0 = done (edits written or nothing to do); 2 = a target was reported untouched
 * (other edits, if any, are written); 1 = usage or I/O error. `--self-test` runs `cv02` on a built-in spec whose
 * FF-CV02 pattern is `*Foo` and returns 1 when (and only when) it is reported untouched.
 */
export function main(argv: readonly string[]): Promise<number> {
  const out = (s: string): void => { process.stdout.write(s); };
  const err = (s: string): void => { process.stderr.write(s); };

  if (argv.includes('--self-test')) {
    const r = migrate(SELF_TEST_SPEC, 'cv02');
    const reported = r.untouched.length > 0 && r.text === SELF_TEST_SPEC;
    out(reported ? `self-test: reported untouched: ${r.untouched.join('; ')}\n` : 'self-test: NOT reported\n');
    return Promise.resolve(reported ? 1 : 0);
  }

  const stepIdx = argv.indexOf('--step');
  const step = stepIdx >= 0 ? argv[stepIdx + 1] : undefined;
  const file = argv.find((a, i) => !a.startsWith('--') && i !== stepIdx + 1);
  if ((step !== 'fr22' && step !== 'cv02') || file === undefined) {
    err(USAGE);
    return Promise.resolve(1);
  }

  try {
    const before = fs.readFileSync(file, 'utf-8');
    const r = migrate(before, step);
    if (r.text !== before) fs.writeFileSync(file, r.text);
    for (const p of r.editedPaths) out(`edited ${file}: ${p}\n`);
    for (const u of r.untouched) out(`untouched ${file}: ${u}\n`);
    if (r.editedPaths.length === 0 && r.untouched.length === 0) out(`no change ${file} (step ${step})\n`);
    return Promise.resolve(r.untouched.length > 0 ? 2 : 0);
  } catch (e) {
    err(`${e instanceof Error ? e.message : String(e)}\n`);
    return Promise.resolve(1);
  }
}
