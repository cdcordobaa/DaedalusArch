/**
 * Gate line V11 (no leakage) for Study 2b. Entry file: no exports. Helpers: `scripts/v1.4/lib/leakage-scan.ts`.
 * Zero model calls, no network. The sealed files are read only in-process, as hashed word 8-grams and whole-file
 * sha256s; no sealed text, file name or task id is printed or written.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/leakage-scan.ts --sealed-dir <sealed set dir> --expect-tasks-sha256 <hex>
 *     --baseline <public file or dir> [...] --scan <label>=<dir> [...] [--info <label>=<dir>] [...]
 *     [--skip-dir <name>] [...] [--index-only <sealed-relative file>] [...] --out <report.json>
 *
 * `--index-only` restricts the sealed index to the named files (for example `tasks.json`, the task text proper);
 * by default every file of the sealed set is indexed.
 *
 * An `--info` root is scanned and reported with counts only (no file names), but does not enter the verdict: it is
 * for places outside every agent cwd that only confinement (S4) keeps from the agent.
 *
 * The leak rule, fixed before the first spans were seen: a scanned file is a leak when it shares a verbatim run of at
 * least `--leak-span` words (default 20, about one long sentence) with the sealed set outside the public baseline, or
 * equals a non-empty sealed file. Shorter overlaps are phrase-level shared wording; they are counted and listed.
 * Exit 0 when no file is a leak (and the positive control holds); 1 otherwise; 2 on a usage or I/O error. The sealed directory itself is scanned last as the positive control: every sealed text
 * file must hit, which shows the scan can see the text it looks for.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { indexFiles, LEAK_SPAN, ngramHashes, NGRAM, fileText, scanRoot, walk } from './lib/leakage-scan.js';
import type { RootReport } from './lib/leakage-scan.js';

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1] !== undefined) out.push(process.argv[i + 1] as string);
  });
  return out;
}
function one(name: string): string {
  const v = args(name)[0];
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}

function main(): number {
  const sealedDir = path.resolve(one('sealed-dir'));
  const expect = one('expect-tasks-sha256');
  const tasks = path.join(sealedDir, 'tasks.json');
  const got = createHash('sha256').update(fs.readFileSync(tasks)).digest('hex');
  if (got !== expect) {
    process.stderr.write(`tasks.json sha256 mismatch: STOP\n`);
    return 2;
  }
  const skipDirs = ['.git', ...args('skip-dir')];
  const leakSpan = Number(args('leak-span')[0] ?? LEAK_SPAN);
  const only = args('index-only');
  const allSealed = walk(sealedDir, { skipDirs: [] });
  const sealedFiles = only.length === 0 ? allSealed : allSealed.filter((f) => only.includes(path.relative(sealedDir, f).split(path.sep).join('/')));
  if (only.length > 0 && sealedFiles.length !== only.length) throw new Error('--index-only names a file that is not in the sealed set');
  const sealed = indexFiles(sealedFiles);
  const baseline = new Set<string>();
  for (const b of args('baseline')) {
    const p = path.resolve(b);
    const files = fs.statSync(p).isDirectory() ? walk(p, { skipDirs }) : [p];
    for (const f of files) {
      const t = fileText(fs.readFileSync(f), f);
      if (t !== null) for (const g of ngramHashes(t)) baseline.add(g);
    }
  }
  const sealedInBaseline = [...sealed.ngrams].filter((g) => baseline.has(g)).length;
  process.stdout.write(`sealed set: tasks.json sha256 ok; ${String(sealed.files)} files; ${String(sealed.ngrams.size)} distinct ${String(NGRAM)}-grams; ${String(sealedInBaseline)} of them also in the public baseline\n`);
  const reports: RootReport[] = [];
  let bad = 0;
  const roots = [...args('scan').map((s) => ({ s, info: false })), ...args('info').map((s) => ({ s, info: true }))];
  for (const { s, info } of roots) {
    const i = s.indexOf('=');
    if (i <= 0) throw new Error(`--scan must be <label>=<dir>: ${s}`);
    const label = s.slice(0, i);
    const dir = path.resolve(s.slice(i + 1));
    const r = scanRoot(dir, label, sealed, baseline, { skipDirs });
    reports.push({ ...r, hits: info ? [] : r.hits, informational: info } as RootReport);
    const leaks = r.hits.filter((x) => x.longestSpan >= leakSpan || x.wholeFileMatch).length;
    if (!info) bad += leaks;
    process.stdout.write(`${info ? '(informational) ' : ''}${label}: ${String(r.files)} files (${String(r.textFiles)} text, ${String(r.skippedLarge)} over the size cap), ${(r.bytes / 1e6).toFixed(1)} MB; files with a sealed 8-gram ${String(r.filesWithHits)}; outside the baseline ${String(r.filesWithUnexplainedHits)} (${String(r.distinctUnexplained)} distinct 8-grams; longest shared run ${String(r.maxSpan)} words); whole-file matches ${String(r.wholeFileMatches)}\n`);
    process.stdout.write(`  files with a shared run >= ${String(leakSpan)} words or a whole-file match: ${String(leaks)}\n`);
    if (!info) for (const x of r.hits.filter((y) => y.unexplained > 0 || y.wholeFileMatch)) process.stdout.write(`  HIT ${label}/${x.file}: ${String(x.unexplained)} unexplained 8-gram(s), longest run ${String(x.longestSpan)} words${x.wholeFileMatch ? ', whole-file match' : ''}\n`);
  }
  // Positive control: the sealed directory against itself (counts only).
  const ctl = scanRoot(sealedDir, 'sealed-self', sealed, new Set(), { skipDirs: [] });
  const textSealed = sealedFiles.filter((f) => {
    const t = fileText(fs.readFileSync(f), f);
    return t !== null && ngramHashes(t).size > 0;
  }).length;
  const rel = new Set(sealedFiles.map((f) => path.relative(sealedDir, f).split(path.sep).join('/')));
  const own = ctl.hits.filter((x) => rel.has(x.file));
  const ctlHits = own.filter((x) => x.hits > 0).length;
  const ctlWhole = own.filter((x) => x.wholeFileMatch).length;
  const ctlSpan = own.reduce((a, x) => Math.max(a, x.longestSpan), 0);
  const nonEmpty = sealedFiles.filter((f) => fs.statSync(f).size > 0).length;
  const ctlOk = ctlHits === textSealed && ctlWhole === nonEmpty;
  process.stdout.write(`positive control (indexed sealed files against the index): ${String(ctlHits)} of ${String(textSealed)} text files hit, ${String(ctlWhole)} of ${String(nonEmpty)} non-empty files match whole, longest shared run ${String(ctlSpan)} words: ${ctlOk ? 'ok' : 'FAILED'}\n`);
  const outFile = path.resolve(one('out'));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const report = {
    schema: 'study2b-leakage-scan/v1', ngram: NGRAM, leakSpanWords: leakSpan,
    sealed: { tasksSha256: got, indexOnly: only, files: sealed.files, distinctNgrams: sealed.ngrams.size, ngramsInBaseline: sealedInBaseline },
    baselineNgrams: baseline.size,
    roots: reports,
    positiveControl: { textFiles: textSealed, filesWithHits: ctlHits, nonEmptyFiles: nonEmpty, wholeFileMatches: ctlWhole, longestRun: ctlSpan, ok: ctlOk },
    verdict: bad === 0 && ctlOk ? 'no-leakage-found' : bad > 0 ? 'hits-to-adjudicate' : 'control-failed',
  };
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 1).split(os.homedir()).join('<home>')}\n`);
  process.stdout.write(`verdict: ${report.verdict}\n`);
  return bad === 0 && ctlOk ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
