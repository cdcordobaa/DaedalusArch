/**
 * V11 (threats register V13-TV-I4): census of answer-revealing comments in the development fixtures.
 * Pattern set and units are fixed in scripts/v1.3/lib/leakage-terms.ts and
 * Docs/DiagnosticRuns/v1.3-fixture-leakage-2026-10-16.md §1 (committed before this script ran). Read-only over the
 * repository; never reads ../daedalus-sealed/.
 *
 * Sets: the five reference styles (clean project + each variant's patch or overlay), the judge-catch fixture base
 * (fixtures/unit/antipattern-nest), and the judge-catch seed diffs of rounds 1, 2 and DUP v2, split TUNE / CHECK by
 * results/v1.3-judge-v2/split.json. In a seed diff only the added lines are scanned (as one fragment per file).
 *
 * Usage (repository root): npx tsx scripts/v1.3/fixture-leakage-census.ts [--out results/v1.3-fixture-leakage]
 * Writes <out>/census.json and <out>/census.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { commentLineTexts } from './lib/labelling/excerpt-scrub.js';
import { LEAKAGE_PATTERNS, leakageKinds } from './lib/leakage-terms.js';
import { isSourceFile } from './lib/fixture-scrub.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';

export interface Tally {
  files: number;
  filesWithComments: number;
  filesWithHits: number;
  commentLines: number;
  hitLines: number;
  byKind: Record<string, number>;
}

export function emptyTally(): Tally {
  return { files: 0, filesWithComments: 0, filesWithHits: 0, commentLines: 0, hitLines: 0, byKind: Object.fromEntries(LEAKAGE_PATTERNS.map((p) => [p.kind, 0])) };
}

/** Adds one file's comment lines (only those `keep` accepts) to `t`; returns the file's hit count. */
export function tallyFile(t: Tally, content: string, keep: (lineIdx: number) => boolean = () => true): number {
  const lines = [...commentLineTexts(content).entries()].filter(([i]) => keep(i));
  let hits = 0;
  for (const [, text] of lines) {
    const kinds = leakageKinds(text);
    if (kinds.length === 0) continue;
    hits += 1;
    for (const k of kinds) t.byKind[k] = (t.byKind[k] ?? 0) + 1;
  }
  t.files += 1;
  if (lines.length > 0) t.filesWithComments += 1;
  if (hits > 0) t.filesWithHits += 1;
  t.commentLines += lines.length;
  t.hitLines += hits;
  return hits;
}

function listSource(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(abs);
      } else if (isSourceFile(e.name)) out.push(abs);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

interface Row {
  set: string;
  style: string;
  part: string;
  units: number;
  unitsWithHits: number;
  tally: Tally;
  leakingUnits?: string[];
}

function main(): void {
  const repoRoot = process.cwd();
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const outDir = path.resolve(repoRoot, oi >= 0 ? argv[oi + 1] ?? '' : 'results/v1.3-fixture-leakage');
  const rows: Row[] = [];

  // Reference sets.
  const work = makeTempRoot('v13-leakage-');
  try {
    for (const ref of loadAllReferences(repoRoot)) {
      const clean = emptyTally();
      const files = listSource(ref.projectDir);
      for (const f of files) tallyFile(clean, fs.readFileSync(f, 'utf8'));
      rows.push({ set: 'reference', style: ref.style, part: 'clean project', units: files.length, unitsWithHits: clean.filesWithHits, tally: clean });
      const variants = emptyTally();
      const leaking: string[] = [];
      let n = 0;
      for (const v of ref.variants) {
        if (v.manifest.kind === 'clean') continue;
        n += 1;
        const m = materialiseVariant(ref, v, work);
        let hits = 0;
        for (const rel of m.touched) {
          if (!isSourceFile(rel)) continue;
          const abs = path.join(m.projectDir, rel);
          if (!fs.existsSync(abs)) continue;
          const orig = path.join(ref.projectDir, rel);
          const cleanLines = new Set(fs.existsSync(orig) ? fs.readFileSync(orig, 'utf8').replace(/\r\n/g, '\n').split('\n') : []);
          const content = fs.readFileSync(abs, 'utf8');
          const lines = content.replace(/\r\n/g, '\n').split('\n');
          hits += tallyFile(variants, content, (i) => !cleanLines.has(lines[i] ?? ''));
        }
        if (hits > 0) leaking.push(`${v.manifest.variant} (${v.manifest.kind})`);
      }
      rows.push({ set: 'reference', style: ref.style, part: 'variant-introduced', units: n, unitsWithHits: leaking.length, tally: variants, leakingUnits: leaking });
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }

  // Judge-catch fixture base.
  const base = emptyTally();
  const baseFiles = listSource(path.join(repoRoot, 'fixtures/unit/antipattern-nest'));
  for (const f of baseFiles) tallyFile(base, fs.readFileSync(f, 'utf8'));
  rows.push({ set: 'judge-catch base', style: 'antipattern-nest', part: 'clean base', units: baseFiles.length, unitsWithHits: base.filesWithHits, tally: base });

  // Judge-catch seed diffs, by split.
  const split = JSON.parse(fs.readFileSync(path.join(repoRoot, 'results/v1.3-judge-v2/split.json'), 'utf8')) as { items: { round: string; targetId: string; split: string }[] };
  const splitOf = new Map<string, Set<string>>();
  for (const it of split.items) {
    const k = `${it.round}|${it.targetId}`;
    const s = splitOf.get(k) ?? new Set<string>();
    s.add(it.split);
    splitOf.set(k, s);
  }
  const rounds: [string, string][] = [['r1', 'results/v1.3-judge-catch/diffs'], ['r2', 'results/v1.3-judge-catch/round2/diffs'], ['dv2', 'results/v1.3-judge-catch/duprule-v2/diffs']];
  const bySplit = new Map<string, { tally: Tally; units: number; leaking: string[] }>();
  for (const [round, dir] of rounds) {
    const abs = path.join(repoRoot, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.diff')).sort()) {
      const target = f.slice(0, -'.diff'.length);
      const s = [...(splitOf.get(`${round}|${target}`) ?? new Set(['not in split']))].sort().join('+');
      const g = bySplit.get(s) ?? { tally: emptyTally(), units: 0, leaking: [] };
      g.units += 1;
      // One fragment per file section: the added lines of that file.
      const text = fs.readFileSync(path.join(abs, f), 'utf8');
      let hits = 0;
      for (const section of text.split(/^diff /m).filter((x) => x.trim() !== '')) {
        const added = section.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
        if (added.length > 0) hits += tallyFile(g.tally, added.join('\n') + '\n');
      }
      if (hits > 0) g.leaking.push(`${round}/${target}`);
      bySplit.set(s, g);
    }
  }
  for (const [s, g] of [...bySplit.entries()].sort()) rows.push({ set: 'judge-catch seeds', style: s, part: 'added lines', units: g.units, unitsWithHits: g.leaking.length, tally: g.tally, leakingUnits: g.leaking });

  fs.mkdirSync(outDir, { recursive: true });
  const kinds = LEAKAGE_PATTERNS.map((p) => p.kind);
  fs.writeFileSync(path.join(outDir, 'census.json'), JSON.stringify({ patterns: LEAKAGE_PATTERNS.map((p) => ({ kind: p.kind, re: p.re.source, flags: p.re.flags })), rows }, null, 2) + '\n');
  const md: string[] = [
    '| Set | Style / split | Part | Units | Units with hits | Files with comments | Comment lines | Hit lines | ' + kinds.join(' | ') + ' |',
    '|' + '---|'.repeat(8 + kinds.length),
  ];
  for (const r of rows) {
    md.push(`| ${r.set} | ${r.style} | ${r.part} | ${String(r.units)} | ${String(r.unitsWithHits)} | ${String(r.tally.filesWithComments)} | ${String(r.tally.commentLines)} | ${String(r.tally.hitLines)} | ${kinds.map((k) => String(r.tally.byKind[k] ?? 0)).join(' | ')} |`);
  }
  md.push('', 'Units: files (clean project, base) or variants / seed diffs (variant-introduced, added lines).', '');
  for (const r of rows) if (r.leakingUnits !== undefined && r.leakingUnits.length > 0) md.push(`- ${r.set} ${r.style}: ${r.leakingUnits.join(', ')}`);
  fs.writeFileSync(path.join(outDir, 'census.md'), md.join('\n') + '\n');
  process.stdout.write(md.join('\n') + '\n');
}

main();
