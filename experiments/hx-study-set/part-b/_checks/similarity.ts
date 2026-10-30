/**
 * HX study set part B: structural similarity check (zero calls). The trap-families study set records its check as
 * "8-gram Jaccard on normalised clean src; every kept pair < 0.6" (experiments/trap-families/study-set.json), but no
 * script for it is committed, so this file implements that description.
 *
 * Each task's clean reference (`solutions/clean/src/**\/*.ts`, without the vendor typings under src/types) is read
 * with the TypeScript scanner, comments and whitespace dropped, files in path order. Two normalisations are scored:
 *   - structural: every identifier becomes I, every string or template literal S, every number N (renaming the
 *     domain does not lower it; the stricter reading);
 *   - lexical: identifiers kept (lower-cased), literals as above.
 * The score of a pair is the Jaccard index of their sets of token 8-grams. Each part-B task is compared with the
 * other part-B tasks, every part-A task present (experiments/hx-study-set/part-a), every trap-families task and every
 * TRAP-PILOT-v2 variant. Gate: both scores < 0.6 for every pair that involves a part-B task.
 *
 *   npx tsx experiments/hx-study-set/part-b/_checks/similarity.ts [--json out.json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const N = 8;
const GATE = 0.6;

function cleanTrees(): { id: string; group: string; dir: string }[] {
  const out: { id: string; group: string; dir: string }[] = [];
  const add = (group: string, root: string, depth: 1 | 2): void => {
    const abs = path.join(REPO, root);
    if (!fs.existsSync(abs)) return;
    for (const a of fs.readdirSync(abs, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const subs = depth === 1 ? [''] : fs.readdirSync(path.join(abs, a.name), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
      for (const s of subs) {
        const dir = path.join(abs, a.name, s, 'solutions', 'clean', 'src');
        if (fs.existsSync(dir)) out.push({ id: s === '' ? a.name : `${a.name}/${s}`, group, dir });
      }
    }
  };
  add('part-b', 'experiments/hx-study-set/part-b', 1);
  add('part-a', 'experiments/hx-study-set/part-a', 1);
  add('trap-families', 'experiments/trap-families', 1);
  add('trap-pilot-v2', 'experiments/trap-pilot-v2', 2);
  return out;
}

function tokens(dir: string, structural: boolean): string[] {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (path.relative(dir, p) !== 'types') walk(p); } else if (e.name.endsWith('.ts')) files.push(p);
    }
  };
  walk(dir);
  const out: string[] = [];
  for (const f of files) {
    const scanner = ts.createScanner(ts.ScriptTarget.ES2022, true, ts.LanguageVariant.Standard, fs.readFileSync(f, 'utf8'));
    for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
      if (k === ts.SyntaxKind.Identifier) out.push(structural ? 'I' : scanner.getTokenText().toLowerCase());
      else if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral || k === ts.SyntaxKind.TemplateHead || k === ts.SyntaxKind.TemplateMiddle || k === ts.SyntaxKind.TemplateTail) out.push('S');
      else if (k === ts.SyntaxKind.NumericLiteral) out.push('N');
      else out.push(scanner.getTokenText());
    }
  }
  return out;
}

const shingles = (t: string[]): Set<string> => { const s = new Set<string>(); for (let i = 0; i + N <= t.length; i++) s.add(t.slice(i, i + N).join(' ')); return s; };
const jaccard = (a: Set<string>, b: Set<string>): number => { let inter = 0; for (const x of a) if (b.has(x)) inter++; const union = a.size + b.size - inter; return union === 0 ? 0 : inter / union; };

// --pair <dirA> <dirB>: score two clean trees (repository-relative task dirs) and stop; used to calibrate against
// the pairs the trap-families set records (f7/f5 0.93, f8/f3 0.82, f6/f4 0.72, f3/f1 0.63).
const pi = process.argv.indexOf('--pair');
if (pi >= 0) {
  const [a, b] = [process.argv[pi + 1]!, process.argv[pi + 2]!].map((d) => path.join(REPO, d, 'solutions', 'clean', 'src'));
  process.stdout.write(`structural ${jaccard(shingles(tokens(a!, true)), shingles(tokens(b!, true))).toFixed(3)} lexical ${jaccard(shingles(tokens(a!, false)), shingles(tokens(b!, false))).toFixed(3)}\n`);
  process.exit(0);
}

const trees = cleanTrees();
const sets = new Map(trees.map((t) => [t.id, { s: shingles(tokens(t.dir, true)), l: shingles(tokens(t.dir, false)) }]));
const pairs: { a: string; b: string; groupB: string; structural: number; lexical: number }[] = [];
const partB = trees.filter((t) => t.group === 'part-b');
for (const [i, a] of partB.entries()) {
  for (const b of trees) {
    if (b.id === a.id || (b.group === 'part-b' && partB.findIndex((x) => x.id === b.id) < i)) continue;
    const x = sets.get(a.id)!; const y = sets.get(b.id)!;
    pairs.push({ a: a.id, b: b.id, groupB: b.group, structural: Number(jaccard(x.s, y.s).toFixed(3)), lexical: Number(jaccard(x.l, y.l).toFixed(3)) });
  }
}
const ok = pairs.every((p) => p.structural < GATE && p.lexical < GATE);
const r3 = (x: number): string => x.toFixed(3);
for (const a of partB) {
  const mine = pairs.filter((p) => p.a === a.id || p.b === a.id);
  const topS = mine.reduce((m, p) => (p.structural > m.structural ? p : m));
  const topL = mine.reduce((m, p) => (p.lexical > m.lexical ? p : m));
  const other = (p: { a: string; b: string }): string => (p.a === a.id ? p.b : p.a);
  process.stdout.write(`${a.id}: max structural ${r3(topS.structural)} (${other(topS)}), max lexical ${r3(topL.lexical)} (${other(topL)}), part-B pairs ${mine.filter((p) => p.groupB === 'part-b' || p.a !== a.id).map((p) => `${other(p)} ${r3(p.structural)}/${r3(p.lexical)}`).filter((s) => s.startsWith('hxpb')).join(', ')}\n`);
}
process.stdout.write(`${String(pairs.length)} pairs against ${String(trees.length - partB.length)} other clean trees (${[...new Set(trees.map((t) => t.group))].join(', ')}); gate < ${String(GATE)} on both: ${ok ? 'pass' : 'FAIL'}\n`);
const i = process.argv.indexOf('--json');
if (i >= 0) fs.writeFileSync(process.argv[i + 1]!, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), n: N, gate: GATE, groups: [...new Set(trees.map((t) => t.group))], ok, pairs: pairs.sort((x, y) => y.structural - x.structural) }, null, 1)}\n`);
process.exitCode = ok ? 0 : 1;
