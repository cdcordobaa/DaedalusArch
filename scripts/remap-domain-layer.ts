/**
 * Scripted domain-layer remap of the corpus specs (ADR-017 item 4; BR-U5b-77, chain commit 4 of 4).
 *
 * One uniform rule for every corpus spec: the domain layer (`kind: domain`, or `name: domain`) gains the directory
 * glob `**\/domain/**` and the file pattern `**\/*.entity.ts`. Existing entries are kept (the rule is added, so a
 * project whose domain files come from other directories keeps them). A spec without a domain layer gains one as
 * the first (innermost) layer with these two globs and the role `entity`. A spec without an `architecture.layers`
 * list is left untouched and reported.
 *
 * Nodes are located with the `yaml` Document API and text is inserted by source range, so every other byte
 * (comments, key order, quoting, layout) is kept. Idempotent: a rerun on the output edits nothing.
 * Pure module (D-U1-15); the CLI entry is `scripts/remap-domain-layer-cli.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Pair, YAMLMap, YAMLSeq } from 'yaml';

export const DOMAIN_DIRECTORY = '**/domain/**';
export const DOMAIN_FILE_PATTERN = '**/*.entity.ts';

export interface RemapResult {
  readonly text: string;
  /** Edited key paths in document order (for `Docs/corpus.md`). */
  readonly editedPaths: string[];
  readonly untouched: string[];
}

interface Insert { readonly at: number; readonly text: string; readonly path: string }

const lineStart = (t: string, pos: number): number => t.lastIndexOf('\n', pos - 1) + 1;
const lineEnd = (t: string, pos: number): number => {
  const i = t.indexOf('\n', pos);
  return i < 0 ? t.length : i;
};
const q = (v: string): string => JSON.stringify(v);

function stringsOf(node: unknown): string[] {
  return isSeq(node) ? node.items.flatMap((i) => (isScalar(i) && typeof i.value === 'string' ? [i.value] : [])) : [];
}

/** Insert `value` as the last item of an existing sequence, in that sequence's style. */
function appendToSeq(text: string, seq: YAMLSeq, value: string, path: string): Insert | undefined {
  const range = seq.range;
  if (range == null) return undefined;
  if (seq.flow === true) {
    const close = text.lastIndexOf(']', range[1]);
    if (close < range[0]) return undefined;
    return { at: close, text: seq.items.length > 0 ? `, ${q(value)}` : q(value), path };
  }
  const last = seq.items.at(-1);
  if (!isScalar(last) || last.range == null) return undefined;
  const ls = lineStart(text, last.range[0]);
  const dash = text.slice(ls, last.range[0]).lastIndexOf('-');
  if (dash < 0) return undefined;
  return { at: lineEnd(text, last.range[1]), text: `\n${' '.repeat(dash)}- ${q(value)}`, path };
}

function keyColumn(text: string, pair: Pair): number | undefined {
  const k = pair.key;
  if (!isScalar(k) || k.range == null) return undefined;
  return k.range[0] - lineStart(text, k.range[0]);
}

/** End of the last line of a pair's value (or key, for an empty value). */
function pairEnd(text: string, pair: Pair): number {
  const v = pair.value as { range?: [number, number, number] | null } | null;
  const k = pair.key as { range?: [number, number, number] | null };
  const end = v?.range?.[1] ?? k.range?.[1] ?? 0;
  // a block value's range ends at the start of the next line; step back onto the value's last line
  const back = end > 0 && text[end - 1] === '\n' ? end - 1 : end;
  return lineEnd(text, Math.max(back - 1, 0));
}

function remapLayer(text: string, layer: YAMLMap, i: number, inserts: Insert[]): void {
  const base = `architecture.layers[${String(i)}]`;
  const dirsPair = layer.items.find((p) => isScalar(p.key) && p.key.value === 'directories');
  const patsPair = layer.items.find((p) => isScalar(p.key) && p.key.value === 'file_patterns');
  const namePair = layer.items.find((p) => isScalar(p.key) && p.key.value === 'name') ?? layer.items[0];
  if (namePair === undefined) return;
  const col = keyColumn(text, namePair);
  if (col === undefined) return;
  const ind = ' '.repeat(col);
  const add = (pair: Pair | undefined, key: string, value: string, after: Pair): void => {
    if (pair !== undefined && isSeq(pair.value)) {
      if (stringsOf(pair.value).includes(value)) return;
      const ins = appendToSeq(text, pair.value, value, `${base}.${key}`);
      if (ins !== undefined) inserts.push(ins);
      return;
    }
    if (pair !== undefined) return; // present but not a list: left as is (schema violation, not ours to fix)
    inserts.push({ at: pairEnd(text, after), text: `\n${ind}${key}:\n${ind}  - ${q(value)}`, path: `${base}.${key}` });
  };
  add(dirsPair, 'directories', DOMAIN_DIRECTORY, namePair);
  add(patsPair, 'file_patterns', DOMAIN_FILE_PATTERN, dirsPair ?? namePair);
}

/** Apply the remap to a spec's YAML text. Pure. */
export function remap(text: string): RemapResult {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error(`YAML parse error: ${doc.errors.map((e) => e.message).join('; ')}`);
  const layers = doc.getIn(['architecture', 'layers'], true);
  if (!isSeq(layers) || layers.items.length === 0) {
    return { text, editedPaths: [], untouched: ['architecture.layers: not declared as a non-empty list'] };
  }
  const inserts: Insert[] = [];
  const idx = layers.items.findIndex((l) => isMap(l) && (l.get('kind') === 'domain' || l.get('name') === 'domain'));
  if (idx >= 0) {
    remapLayer(text, layers.items[idx] as YAMLMap, idx, inserts);
  } else {
    const first = layers.items[0] as { range?: [number, number, number] | null };
    const start = first.range?.[0];
    if (start == null) return { text, editedPaths: [], untouched: ['architecture.layers[0]: no source range'] };
    const ls = lineStart(text, start);
    const dash = text.slice(ls, start).lastIndexOf('-');
    if (dash < 0 || layers.flow === true) return { text, editedPaths: [], untouched: ['architecture.layers: not a block list'] };
    const d = ' '.repeat(dash);
    inserts.push({
      at: ls,
      text: `${d}- name: domain\n${d}  directories:\n${d}    - ${q(DOMAIN_DIRECTORY)}\n${d}  file_patterns:\n${d}    - ${q(DOMAIN_FILE_PATTERN)}\n${d}  roles:\n${d}    - entity\n\n`,
      path: 'architecture.layers[+domain]',
    });
  }
  let out = text;
  // descending position; at equal positions the later insert is applied first, so the earlier one ends up before it
  const order = inserts.map((e, n) => ({ e, n })).sort((x, y) => y.e.at - x.e.at || y.n - x.n);
  for (const { e } of order) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return { text: out, editedPaths: [...inserts].sort((a, b) => a.at - b.at).map((e) => e.path), untouched: [] };
}

const SELF_TEST_SPEC = `spec_version: "1.0.0"
architecture:
  style: nestjs
`;

const USAGE = 'usage: npx tsx scripts/remap-domain-layer-cli.ts <spec.yaml>... | --self-test\n';

export interface RemapIo { readonly out: (t: string) => void; readonly err: (t: string) => void }

/**
 * Exit codes: 0 = done (edits written or nothing to do); 2 = a spec was reported untouched; 1 = usage or I/O error.
 * `--self-test` runs the remap on a built-in spec without `architecture.layers` and returns 1 when (and only when)
 * it is reported untouched.
 */
export function main(argv: readonly string[], io: RemapIo): Promise<number> {
  if (argv.includes('--self-test')) {
    const r = remap(SELF_TEST_SPEC);
    const reported = r.untouched.length > 0 && r.text === SELF_TEST_SPEC;
    io.out(reported ? `self-test: reported untouched: ${r.untouched.join('; ')}\n` : 'self-test: NOT reported\n');
    return Promise.resolve(reported ? 1 : 0);
  }
  const files = argv.filter((a) => !a.startsWith('--'));
  if (files.length === 0) {
    io.err(USAGE);
    return Promise.resolve(1);
  }
  let code = 0;
  for (const file of files) {
    try {
      const before = readFileSync(file, 'utf8');
      const r = remap(before);
      if (r.text !== before) writeFileSync(file, r.text);
      for (const p of r.editedPaths) io.out(`edited ${file}: ${p}\n`);
      for (const u of r.untouched) io.out(`untouched ${file}: ${u}\n`);
      if (r.editedPaths.length === 0 && r.untouched.length === 0) io.out(`no change ${file}\n`);
      if (r.untouched.length > 0) code = Math.max(code, 2);
    } catch (e) {
      io.err(`${file}: ${e instanceof Error ? e.message : String(e)}\n`);
      return Promise.resolve(1);
    }
  }
  return Promise.resolve(code);
}
