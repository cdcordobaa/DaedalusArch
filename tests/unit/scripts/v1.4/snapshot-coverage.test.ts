/**
 * L1 per-snapshot coverage check (`scripts/v1.4/lib/snapshot-coverage.ts`) and the snapshot stores it reads
 * (`scripts/v1.4/lib/snapshot-store.ts`), on small fixture trees written to a temporary directory.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { aggregateCoverage, coverageVerdict, renderCoverage, treeCoverage } from '../../../../scripts/v1.4/lib/snapshot-coverage.js';
import type { SnapshotCoverage } from '../../../../scripts/v1.4/lib/snapshot-coverage.js';
import { discoverSnapshots, finalSnapshots, storeKind, treeFiles } from '../../../../scripts/v1.4/lib/snapshot-store.js';
import { unmatchedShare } from '../../../../scripts/lib/loop/pilot-metrics.js';

const REPO = path.resolve(__dirname, '../../../..');

function write(root: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
}

function texts(files: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(files).filter(([f]) => f.endsWith('.ts')));
}

describe('treeCoverage', () => {
  const files: Record<string, string> = {
    'src/business/a.ts': "import { b } from '../persistence/b';\nexport const a = b;\n",
    'src/persistence/b.ts': "const fs = require('fs');\nexport const b = 1;\nexport async function c(n: string) { return import(n); }\n",
    'src/persistence/index.ts': "export * from './b';\n",
    'src/presentation/broken.ts': 'export const x = {;\n',
    'src/presentation/lazy.ts': "export const l = () => import('../business/a');\n",
    'src/presentation/view.tsx': 'export const v = 1;\n',
    'src/types.d.ts': 'declare const t: number;\n',
    'README.md': '# x\n',
  };
  const tc = treeCoverage(texts(files), Object.keys(files));

  it('lists the extractor source files (no .d.ts) and the code files it does not read', () => {
    expect(tc.sourceFiles).toEqual(['src/business/a.ts', 'src/persistence/b.ts', 'src/persistence/index.ts', 'src/presentation/broken.ts', 'src/presentation/lazy.ts']);
    expect(tc.notExtracted).toEqual(['src/presentation/view.tsx']);
  });

  it('flags a file with a parse diagnostic as unparsed', () => {
    expect(tc.unparsed.map((u) => u.file)).toEqual(['src/presentation/broken.ts']);
    expect(tc.unparsed[0]?.diagnostics).toBeGreaterThan(0);
  });

  it('counts barrels, require and import(), with the non-literal ones apart', () => {
    expect(tc.barrels).toEqual(['src/persistence/index.ts']);
    expect(tc.require).toBe(1);
    expect(tc.requireNonLiteral).toBe(0);
    expect(tc.dynamicImport).toBe(2);
    expect(tc.dynamicImportNonLiteral).toBe(1);
  });
});

describe('coverageVerdict', () => {
  const ok = { sourceFiles: ['src/a.ts'], unparsed: [] };
  it('passes at exactly 10 % unmapped and fails above', () => {
    expect(coverageVerdict(0.1, ok).verdict).toBe('pass');
    expect(coverageVerdict(0.11, ok)).toEqual({ verdict: 'fail', reasons: ['unmapped 11.0 % > 10 %'] });
  });
  it('fails on any unparsed file', () => {
    expect(coverageVerdict(0, { sourceFiles: ['src/a.ts'], unparsed: [{ file: 'src/a.ts', diagnostics: 1, first: 'x' }] }).verdict).toBe('fail');
  });
  it('is no-data without a spec or without source files', () => {
    expect(coverageVerdict(null, ok).verdict).toBe('no-data');
    expect(coverageVerdict(0, { sourceFiles: [], unparsed: [] }).verdict).toBe('no-data');
  });
});

describe('unmapped share against a real preset', () => {
  it('counts a file outside the layered folders as unmapped', async () => {
    const share = await unmatchedShare(path.join(REPO, 'presets/layered.yaml'), ['business/a.ts', 'persistence/b.ts', 'presentation/c.ts', 'main.ts']);
    expect(share).toBeCloseTo(0.25, 10);
  });
});

describe('snapshot stores', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcov-'));
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('reads a probe store: tasks, arms, steps, and the spec of the step record (tool arm: .post.json)', () => {
    write(dir, {
      'hive/none/step-01.json': JSON.stringify({ spec: 'presets/layered.yaml' }),
      'hive/none/step-02.json': JSON.stringify({ spec: 'presets/layered.yaml' }),
      'hive/none/snapshots/step-01/src/business/a.ts': 'export const a = 1;\n',
      'hive/none/snapshots/step-02/src/business/a.ts': 'export const a = 2;\n',
      'hive/tool/step-01.post.json': JSON.stringify({ spec: 'presets/layered.yaml' }),
      'hive/tool/snapshots/step-01/src/business/a.ts': 'export const a = 3;\n',
    });
    expect(storeKind(dir)).toBe('probe');
    const refs = discoverSnapshots(dir, REPO, { generator: 'g' });
    expect(refs.map((r) => r.id)).toEqual(['hive/none/step-01', 'hive/none/step-02', 'hive/tool/step-01']);
    expect(refs.every((r) => r.specPath === path.join(REPO, 'presets/layered.yaml') && r.generator === 'g')).toBe(true);
    expect(finalSnapshots(refs).map((r) => r.id)).toEqual(['hive/none/step-02', 'hive/tool/step-01']);
    const into = path.join(dir, 'out');
    refs[1]?.materialise(into);
    expect(treeFiles(into)).toEqual(['src/business/a.ts']);
    expect(fs.readFileSync(path.join(into, 'src/business/a.ts'), 'utf8')).toBe('export const a = 2;\n');
  });

  it('reads a plain store with the given spec', () => {
    write(dir, { 'src/a.ts': 'export {};\n', 'node_modules/x/index.js': '' });
    expect(storeKind(dir)).toBe('plain');
    const [ref] = discoverSnapshots(dir, REPO, { spec: 'presets/layered.yaml' });
    const into = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcov-out-'));
    try {
      ref?.materialise(path.join(into, 't'));
      expect(treeFiles(path.join(into, 't'))).toEqual(['src/a.ts']);
    } finally {
      fs.rmSync(into, { recursive: true, force: true });
    }
  });

  it('picks the repair turn as the final snapshot of a step', () => {
    const base = { store: 'loop' as const, generator: 'g', task: 't', arm: 'gate', run: 'run-0', specPath: null, specRecorded: null, materialise: () => undefined };
    const refs = [
      { ...base, id: 'a/step-02', step: 2, snapshot: 'step-02' },
      { ...base, id: 'a/step-02-repair', step: 2, snapshot: 'step-02-repair' },
      { ...base, id: 'a/step-01', step: 1, snapshot: 'step-01' },
    ];
    expect(finalSnapshots(refs).map((r) => r.snapshot)).toEqual(['step-02-repair']);
  });
});

describe('aggregateCoverage and the summary', () => {
  const row = (arm: string, unmapped: number | null, verdict: SnapshotCoverage['verdict']): SnapshotCoverage => ({
    id: `x/${arm}/${String(unmapped)}`, store: 's', generator: 'g', task: 'x', arm, run: '', step: 1, snapshot: 'step-01', spec: null, files: 3,
    unmappedShare: unmapped, unparsed: [], notExtracted: [], barrels: 1, require: 0, requireNonLiteral: 0, dynamicImport: 1, dynamicImportNonLiteral: 1, verdict, reasons: verdict === 'fail' ? ['unmapped'] : [],
  });
  it('groups per generator × arm', () => {
    const a = aggregateCoverage([row('none', 0, 'pass'), row('none', 0.5, 'fail'), row('tool', null, 'no-data')]);
    expect(a).toEqual([
      { generator: 'g', arm: 'none', snapshots: 2, pass: 1, fail: 1, noData: 0, meanUnmapped: 0.25, maxUnmapped: 0.5, unparsedFiles: 0, notExtractedFiles: 0, barrels: 2, require: 0, dynamicImport: 2, nonLiteral: 2 },
      { generator: 'g', arm: 'tool', snapshots: 1, pass: 0, fail: 0, noData: 1, meanUnmapped: null, maxUnmapped: null, unparsedFiles: 0, notExtractedFiles: 0, barrels: 1, require: 0, dynamicImport: 1, nonLiteral: 1 },
    ]);
    const md = renderCoverage([{ store: 's', rows: [row('none', 0.5, 'fail')] }]);
    expect(md).toContain('| g | none | 1 | 0 | 1 | 0 | 50.0 % | 50.0 % |');
    expect(md).toContain('`x/none/0.5`: fail (unmapped)');
  });
});
