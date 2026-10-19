/**
 * L1 per-snapshot coverage check of generated code (TRUST-01 L1, V8 restated). Entry file: no exports.
 * Measures and bar: `scripts/v1.4/lib/snapshot-coverage.ts`; stores: `scripts/v1.4/lib/snapshot-store.ts`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/snapshot-coverage.ts --out <dir> <store>[=<generator label>] [<store>[=<label>] ...]
 *     [--spec <spec>]   (a plain store's spec)
 *
 * Every snapshot of every store is measured (not only the final step). Writes `<out>/coverage.json` (one row per
 * snapshot, plus the per generator × arm aggregates per store) and `<out>/summary.md`, and prints the summary.
 * Zero model calls, no Neo4j, no network; snapshots are materialised into a temporary directory, removed at the end.
 * Exit codes: 0 every snapshot measured, 1 some snapshot could not be measured (recorded in its row), 2 usage error.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { unmatchedShare } from '../lib/loop/pilot-metrics.js';
import { coverageVerdict, renderCoverage, treeCoverage, aggregateCoverage } from './lib/snapshot-coverage.js';
import type { SnapshotCoverage } from './lib/snapshot-coverage.js';
import { discoverSnapshots, treeFiles } from './lib/snapshot-store.js';
import type { SnapshotRef } from './lib/snapshot-store.js';

const REPO = process.cwd();

async function measure(ref: SnapshotRef, storeLabel: string, scratch: string): Promise<SnapshotCoverage> {
  const base = { id: ref.id, store: storeLabel, generator: ref.generator, task: ref.task, arm: ref.arm, run: ref.run, step: ref.step, snapshot: ref.snapshot, spec: ref.specRecorded };
  const tree = fs.mkdtempSync(path.join(scratch, 'snap-'));
  try {
    ref.materialise(tree);
    const files = treeFiles(tree);
    const texts = new Map<string, string>();
    for (const f of files) if (f.endsWith('.ts')) texts.set(f, fs.readFileSync(path.join(tree, f), 'utf8'));
    const tc = treeCoverage(texts, files);
    const unmapped = ref.specPath !== null && fs.existsSync(ref.specPath) ? await unmatchedShare(ref.specPath, tc.sourceFiles.map((f) => f.slice('src/'.length))) : null;
    const v = coverageVerdict(unmapped, tc);
    return {
      ...base,
      files: tc.sourceFiles.length,
      unmappedShare: unmapped,
      unparsed: tc.unparsed,
      notExtracted: tc.notExtracted,
      barrels: tc.barrels.length,
      require: tc.require,
      requireNonLiteral: tc.requireNonLiteral,
      dynamicImport: tc.dynamicImport,
      dynamicImportNonLiteral: tc.dynamicImportNonLiteral,
      verdict: v.verdict,
      reasons: v.reasons,
    };
  } catch (e) {
    return {
      ...base, files: 0, unmappedShare: null, unparsed: [], notExtracted: [], barrels: 0, require: 0, requireNonLiteral: 0, dynamicImport: 0, dynamicImportNonLiteral: 0,
      verdict: 'no-data', reasons: ['measure error'], error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
  }
}

async function main(argv: readonly string[]): Promise<number> {
  let out = '';
  let spec: string | undefined;
  const stores: { dir: string; label: string; generator: string }[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--out') out = argv[++i] ?? '';
    else if (a === '--spec') spec = argv[++i];
    else if (a.startsWith('--')) {
      process.stderr.write(`unknown option ${a}\n`);
      return 2;
    } else {
      const [dir = '', generator = 'unknown'] = a.split('=');
      stores.push({ dir: path.resolve(dir), label: path.relative(REPO, path.resolve(dir)).split(path.sep).join('/'), generator });
    }
  }
  if (out === '' || stores.length === 0) {
    process.stderr.write('usage: snapshot-coverage.ts --out <dir> <store>[=<generator>] ...\n');
    return 2;
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-coverage-'));
  const results: { store: string; rows: SnapshotCoverage[] }[] = [];
  let errors = 0;
  try {
    for (const s of stores) {
      const refs = discoverSnapshots(s.dir, REPO, { generator: s.generator, ...(spec !== undefined ? { spec } : {}) });
      const rows: SnapshotCoverage[] = [];
      for (const r of refs) {
        const m = await measure(r, s.label, scratch);
        if (m.error !== undefined) errors++;
        rows.push(m);
      }
      results.push({ store: s.label, rows });
      process.stderr.write(`${s.label}: ${String(rows.length)} snapshots\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const md = renderCoverage(results);
  fs.mkdirSync(path.resolve(out), { recursive: true });
  const json = { schema: 'snapshot-coverage/v1', bar: { unmappedMax: 0.1, unparsedMax: 0 }, stores: results.map((r) => ({ store: r.store, aggregates: aggregateCoverage(r.rows), rows: r.rows })) };
  fs.writeFileSync(path.join(out, 'coverage.json'), `${JSON.stringify(json, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'summary.md'), md);
  process.stdout.write(md);
  return errors > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exitCode = 2;
  },
);
