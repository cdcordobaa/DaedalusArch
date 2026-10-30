/**
 * HX study set part A: structural similarity of the clean solutions (zero calls). PR 398 states the study-set check as
 * "8-gram Jaccard on normalised clean src; every kept pair < 0.6" but committed no script, so this one implements it in
 * two readings and reports both:
 *   - words: comments dropped (TypeScript scanner), the code lower-cased and split into alphanumeric words (the
 *     `words` rule of scripts/v1.4/lib/leakage-scan.ts), word 8-grams;
 *   - shape: comments dropped, every identifier, string and number replaced by a placeholder, token 8-grams (a renamed
 *     copy scores near 1 here).
 * Each set is the union of the 8-grams of every .ts file under <task>/solutions/clean/src (vendor typings included).
 * Calibration on the pairs PR 398 excluded (study-set.json `excluded`): the shape reading gives f7/f5 0.94, f6/f4 0.79,
 * f3/f1 0.65, f8/f3 0.84 against the recorded 0.93, 0.72, 0.63, 0.82, while the words reading gives 0.04 to 0.09. So
 * the shape reading is the one PR 398 used (up to tokenisation details), and the gate takes both readings below 0.6.
 *
 *   npx tsx experiments/hx-study-set/part-a/similarity.ts [--json out.json]
 * Compares each part-A task with the other part-A tasks, the part-B tasks if present, the confirmatory trap-family
 * tasks of experiments/trap-families/study-set.json, and (for information) the two pilot templates.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const N = 8;

const tsFiles = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts')) out.push(p); } };
  if (fs.existsSync(dir)) walk(dir);
  return out;
};

function tokens(text: string): { text: string; kind: ts.SyntaxKind }[] {
  const s = ts.createScanner(ts.ScriptTarget.ES2022, true, ts.LanguageVariant.Standard, text);
  const out: { text: string; kind: ts.SyntaxKind }[] = [];
  for (let k = s.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = s.scan()) {
    if (k === ts.SyntaxKind.SlashToken || k === ts.SyntaxKind.SlashEqualsToken) {
      const prev = out[out.length - 1]?.kind;
      // A slash after an operator or an open bracket starts a regular expression.
      if (prev === undefined || [ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.CommaToken, ts.SyntaxKind.EqualsToken, ts.SyntaxKind.ExclamationToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.ReturnKeyword, ts.SyntaxKind.OpenBracketToken].includes(prev)) k = s.reScanSlashToken();
    }
    out.push({ text: s.getTokenText(), kind: k });
  }
  return out;
}

const grams = (seq: readonly string[]): Set<string> => {
  const g = new Set<string>();
  for (let i = 0; i + N <= seq.length; i++) g.add(seq.slice(i, i + N).join(' '));
  return g;
};

export interface Profile { readonly words: Set<string>; readonly shape: Set<string> }

export function profile(cleanSrc: string): Profile {
  const words = new Set<string>();
  const shape = new Set<string>();
  for (const f of tsFiles(cleanSrc)) {
    const t = tokens(fs.readFileSync(f, 'utf8'));
    const w = t.map((x) => x.text).join(' ').toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const g of grams(w)) words.add(g);
    const sh = t.map((x) => (x.kind === ts.SyntaxKind.Identifier ? 'ID' : x.kind === ts.SyntaxKind.StringLiteral || x.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral || x.kind === ts.SyntaxKind.RegularExpressionLiteral ? 'STR' : x.kind === ts.SyntaxKind.NumericLiteral ? 'NUM' : x.text));
    for (const g of grams(sh)) shape.add(g);
  }
  return { words, shape };
}

export const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

export interface Pair { readonly a: string; readonly b: string; readonly group: string; readonly words: number; readonly shape: number }

/** Every pair of a part-A task with every comparison task. */
export function similarity(partATasks: readonly string[]): { pairs: Pair[]; compared: Record<string, number> } {
  const others: { id: string; group: string; src: string }[] = [];
  const partB = path.join(HERE, '..', 'part-b');
  if (fs.existsSync(partB)) for (const e of fs.readdirSync(partB, { withFileTypes: true })) if (e.isDirectory() && fs.existsSync(path.join(partB, e.name, 'solutions/clean/src'))) others.push({ id: `part-b/${e.name}`, group: 'part-b', src: path.join(partB, e.name, 'solutions/clean/src') });
  const set = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/trap-families/study-set.json'), 'utf8')) as { confirmatory: Record<string, string[]> };
  for (const id of Object.values(set.confirmatory).flat()) others.push({ id, group: 'trap-families', src: path.join(REPO, 'experiments/trap-families', id, 'solutions/clean/src') });
  for (const v of ['p1-campsite-payments/L2', 'p4-dental-calendar/L2']) others.push({ id: `pilot ${v}`, group: 'pilot-template', src: path.join(REPO, 'experiments/trap-pilot-v2', v, 'solutions/clean/src') });
  const prof = new Map<string, Profile>();
  const get = (k: string, src: string): Profile => { let p = prof.get(k); if (p === undefined) { p = profile(src); prof.set(k, p); } return p; };
  const pairs: Pair[] = [];
  for (let i = 0; i < partATasks.length; i++) {
    const a = partATasks[i]!;
    const pa = get(a, path.join(HERE, a, 'solutions/clean/src'));
    for (let j = i + 1; j < partATasks.length; j++) {
      const b = partATasks[j]!;
      const pb = get(b, path.join(HERE, b, 'solutions/clean/src'));
      pairs.push({ a, b, group: 'part-a', words: jaccard(pa.words, pb.words), shape: jaccard(pa.shape, pb.shape) });
    }
    for (const o of others) {
      const po = get(o.id, o.src);
      pairs.push({ a, b: o.id, group: o.group, words: jaccard(pa.words, po.words), shape: jaccard(pa.shape, po.shape) });
    }
  }
  const compared: Record<string, number> = {};
  for (const o of others) compared[o.group] = (compared[o.group] ?? 0) + 1;
  return { pairs, compared };
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = fs.readdirSync(HERE, { withFileTypes: true }).filter((e) => e.isDirectory() && /^hx[ab]\d-/.test(e.name)).map((e) => e.name).sort();
  const r = similarity(ids);
  for (const id of ids) {
    const mine = r.pairs.filter((p) => p.a === id || p.b === id);
    const top = (k: 'words' | 'shape', group?: string): Pair => mine.filter((p) => group === undefined ? p.group !== 'pilot-template' : p.group === group).reduce((x, y) => (y[k] > x[k] ? y : x));
    const w = top('words'); const s = top('shape');
    process.stdout.write(`${id}: max words ${w.words.toFixed(3)} (${w.a === id ? w.b : w.a}), max shape ${s.shape.toFixed(3)} (${s.a === id ? s.b : s.a})\n`);
  }
  const i = process.argv.indexOf('--json');
  if (i > 0) fs.writeFileSync(process.argv[i + 1]!, `${JSON.stringify(r, null, 1)}\n`);
}
