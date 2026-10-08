/**
 * The mutation pipeline (U5a plan Step 26; BR-U5a-03, 06, 08, 11, 12, 13, 16, 17, 18, 34, 55; F-U5A-REJECT,
 * F-U5A-NOSITE; D-U5a-14). Test operators live in `test-operators.ts` (never in the catalogue).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { parseSpec } from '../../../../src/spec-parser/index.js';
import { compileFunctions, compilerInputFromSpec } from '../../../../src/fitness-compiler/index.js';
import { loadManifest, validateManifest } from '../../../../scripts/lib/manifest.js';
import type { Manifest } from '../../../../scripts/lib/manifest.js';
import { COPY_MARKER, applyMutation, lineShiftsOf } from '../../../../scripts/lib/mutation/apply.js';
import type { MutationEnv } from '../../../../scripts/lib/mutation/apply.js';
import { buildImportGraph, openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import { makePreparedBase, repoTscPath } from '../../../../scripts/lib/mutation/prepare.js';
import { evaluatePreconditions, sampleSites, sortSites } from '../../../../scripts/lib/mutation/sites.js';
import type { ApplyOptions, MutationOperator, PreconditionContext, PreparedBase } from '../../../../scripts/lib/mutation/types.js';
import { TASK, breakOperator, edgeOperator, linesOperator, testRegistry, throwOperator } from './test-operators.js';

const REPO = process.cwd();
const SHA1 = 'a'.repeat(40);
const runner = new NodeProcessRunner();
const NOW = '2026-10-08T12:00:00.000Z';
const INFRA_REPO = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
jest.setTimeout(300_000);

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-apply-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

let n = 0;
function fresh(name: string): { scratchRoot: string; manifest: string } {
  n++;
  const dir = path.join(scratch, `${name}-${String(n)}`);
  fs.mkdirSync(dir, { recursive: true });
  return { scratchRoot: path.join(dir, 'copies'), manifest: path.join(dir, 'manifest.json') };
}

function baseOf(dir: string, specPath: string, over: Partial<Parameters<typeof makePreparedBase>[0]> = {}): PreparedBase {
  const r = makePreparedBase({
    projectId: path.basename(dir),
    baseKind: 'fixture',
    dir,
    baseCommit: SHA1,
    tsconfigPath: 'tsconfig.json',
    tscPath: repoTscPath(REPO),
    tscVersion: '5.9.3',
    overlays: [],
    specPath,
    ...over,
  });
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

const CORRECT = (): PreparedBase => baseOf(path.join(REPO, 'fixtures/correct-reference'), 'specs/clean-arch.yaml');

function env(ops: readonly MutationOperator[], over: Partial<MutationEnv> = {}): MutationEnv {
  return { repoRoot: REPO, runner, registry: testRegistry(ops), masterSeed: 20261008, sitesPerOperator: 1, split: 'dev', now: () => NOW, ...over };
}

function manifestOf(p: string): Manifest {
  const m = loadManifest(REPO, p);
  if (!m.success) throw new Error(JSON.stringify(m.errors));
  return m.data;
}

const sha = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const s01Like = (): MutationOperator =>
  edgeOperator('MO-TEST-edge', (s, t) => s.startsWith('src/domain/') && t.startsWith('src/infrastructure/'), {
    needsDomain: true,
    templates: ['dependency-direction', 'no-domain-outward-dep'],
  });
const FORCED: ApplyOptions = {
  cycleStrategy: 'simple-cycles',
  siteOverride: { filePath: TASK, detail: { symbol: 'InMemoryTaskRepository', targetFile: INFRA_REPO } },
};

describe('fixtures compile under U1 (asserted first)', () => {
  it('the no-domain fixture spec parses and compiles with no fatal error', async () => {
    const p = await parseSpec({ specFilePath: path.join(REPO, 'tests/fixtures/u5a/no-domain/firewall.spec.yaml') });
    if (!p.success) throw new Error(JSON.stringify(p.errors));
    const c = compileFunctions(compilerInputFromSpec(p.data));
    expect(c.success).toBe(true);
    expect(p.data.layerModel.layers.some((l) => l.kind === 'domain')).toBe(false);
  });
});

describe('line shifts (BR-U5a-18)', () => {
  it('three lines after base line 4 → one entry; separate blocks → separate entries; equal-count change → none', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f'].join('\n');
    expect(lineShiftsOf('f.ts', before, ['a', 'b', 'c', 'd', 'x', 'y', 'z', 'e', 'f'].join('\n'))).toEqual([{ filePath: 'f.ts', afterLine: 4, delta: 3 }]);
    expect(lineShiftsOf('f.ts', before, ['i', 'a', 'b', 'c', 'd', 'e', 'f', 'j', 'k'].join('\n'))).toEqual([
      { filePath: 'f.ts', afterLine: 0, delta: 1 },
      { filePath: 'f.ts', afterLine: 6, delta: 2 },
    ]);
    expect(lineShiftsOf('f.ts', before, ['a', 'B', 'c', 'd', 'e', 'f'].join('\n'))).toEqual([]);
    expect(lineShiftsOf('f.ts', before, ['a', 'b', 'e', 'f'].join('\n'))).toEqual([{ filePath: 'f.ts', afterLine: 2, delta: -2 }]);
  });

  it('through the pipeline on Task.ts, text outside the inserted lines byte-identical', async () => {
    const f = fresh('lines');
    const r = await applyMutation(env([linesOperator()]), CORRECT(), 'MO-TEST-lines', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    const row = manifestOf(f.manifest).rows[0];
    expect(row?.lineShifts).toEqual([{ filePath: TASK, afterLine: 4, delta: 3 }]);
    expect(row?.editedFiles).toEqual([TASK]);
    const orig = fs.readFileSync(path.join(REPO, 'fixtures/correct-reference', TASK), 'utf8').split('\n');
    const mut = fs.readFileSync(path.join(f.scratchRoot, 'correct-reference/MO-TEST-lines/k-0', TASK), 'utf8').split('\n');
    expect([...mut.slice(0, 4), ...mut.slice(7)]).toEqual(orig);
  });
});

describe('pipeline order and forced sites (BR-U5a-06, 55; F-U5A-CYCLE; D-U5a-14)', () => {
  it('step trace order on correct-reference, forced site, two FF-S02 cycle keys', async () => {
    const f = fresh('trace');
    const steps: string[] = [];
    const r = await applyMutation(env([s01Like()], { trace: (s) => steps.push(s) }), CORRECT(), 'MO-TEST-edge', f.manifest, f.scratchRoot, FORCED);
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data).toEqual({ rows: 1, rejections: 0 });
    expect(steps).toEqual([
      'copy', 'prepare', 'baseTreeSha', 'base-typecheck', 'base-graph', 'find-sites', 'preconditions', 'seeds',
      'app-copy', 'app-prepare', 'apply', 'line-shifts', 'mutant-typecheck', 'mutant-graph', 'collateral', 'expected', 'append',
    ]);
    const m = manifestOf(f.manifest);
    expect(m.cycleStrategy).toBe('simple-cycles');
    const row = m.rows[0];
    if (row === undefined) throw new Error('no row');
    expect(row.siteSelection).toBe('forced');
    expect(row.seedDerivation).toEqual({ projectId: 'correct-reference', operatorId: 'MO-TEST-edge', k: 0 });
    expect(row.expected.functionIds).toEqual(['FF-S01', 'FF-S04']);
    expect(row.expected.keys.map((k) => [k.functionId, k.filePath, k.target, k.discriminator, k.lineRule])).toEqual([
      ['FF-S01', TASK, INFRA_REPO, ['IMPORTS'], 'site-line'],
      ['FF-S04', TASK, INFRA_REPO, ['IMPORTS'], 'site-line'],
    ]);
    const cycles = row.expected.collateral.filter((c) => c.cause === 'cycle');
    expect(cycles.map((c) => c.key?.discriminator[0])).toEqual([
      JSON.stringify([TASK, INFRA_REPO, TASK]),
      JSON.stringify([TASK, INFRA_REPO, 'src/domain/repositories/ITaskRepository.ts', TASK]),
    ]);
    expect(row.baseTreeSha).toMatch(/^[0-9a-f]{40}$/);
    expect(fs.existsSync(path.join(f.scratchRoot, 'correct-reference/MO-TEST-edge/k-0', COPY_MARKER))).toBe(true);
    expect(fs.readdirSync(path.join(f.scratchRoot, 'correct-reference/MO-TEST-edge'))).toEqual(['k-0']);

    // BR-U5a-55: a forced row validates as dev and fails as held-out.
    expect(validateManifest(REPO, m).valid).toBe(true);
    expect(validateManifest(REPO, { ...m, rows: [{ ...row, split: 'held-out', baseKind: 'corpus' }] }).valid).toBe(false);

    // BR-U5a-03: a second application on the same copy is refused before anything is written.
    const before = sha(f.manifest);
    const again = await applyMutation(env([s01Like()]), CORRECT(), 'MO-TEST-edge', f.manifest, f.scratchRoot, FORCED);
    expect(!again.success && again.errors[0]?.code).toBe('MUT_COPY_ALREADY_SEEDED');
    expect(sha(f.manifest)).toBe(before);
  });

  it('scc strategy: header scc, one SCC key', async () => {
    const f = fresh('scc');
    const r = await applyMutation(env([s01Like()]), CORRECT(), 'MO-TEST-edge', f.manifest, f.scratchRoot, { ...FORCED, cycleStrategy: 'scc' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    const m = manifestOf(f.manifest);
    expect(m.cycleStrategy).toBe('scc');
    expect(m.rows[0]?.expected.collateral.filter((c) => c.cause === 'cycle').map((c) => [c.key?.filePath, c.key?.target, c.key?.discriminator])).toEqual([
      [TASK, '', ['scc']],
    ]);
  });

  it('an override outside the eligible list → MUT_SITE_OVERRIDE_INVALID, manifest unchanged', async () => {
    const f = fresh('override');
    const first = await applyMutation(env([linesOperator()]), CORRECT(), 'MO-TEST-lines', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    expect(first.success).toBe(true);
    const before = sha(f.manifest);
    const r = await applyMutation(env([s01Like()]), CORRECT(), 'MO-TEST-edge', f.manifest, f.scratchRoot, {
      cycleStrategy: 'simple-cycles',
      siteOverride: { filePath: TASK, detail: { symbol: 'Nope', targetFile: INFRA_REPO } },
    });
    expect(!r.success && r.errors[0]?.code).toBe('MUT_SITE_OVERRIDE_INVALID');
    expect(sha(f.manifest)).toBe(before);
  });

  it('the same override twice on fresh copies gives identical rows except appliedAt', async () => {
    const a = fresh('twice-a');
    const b = fresh('twice-b');
    let t = 0;
    const clock = (): string => `2026-10-08T12:00:0${String(t++ % 10)}.000Z`;
    await applyMutation(env([s01Like()], { now: clock }), CORRECT(), 'MO-TEST-edge', a.manifest, a.scratchRoot, FORCED);
    await applyMutation(env([s01Like()], { now: clock }), CORRECT(), 'MO-TEST-edge', b.manifest, b.scratchRoot, FORCED);
    const ra = manifestOf(a.manifest).rows[0];
    const rb = manifestOf(b.manifest).rows[0];
    expect(ra?.appliedAt).not.toBe(rb?.appliedAt);
    expect({ ...ra, appliedAt: '' }).toEqual({ ...rb, appliedAt: '' });
  });

  it('BR-U5a-08: the row carries the PreparedBase tscPath/tscVersion pair', async () => {
    const f = fresh('tsc');
    const link = path.join(scratch, `tsc-pinned-${String(n)}.js`);
    fs.symlinkSync(repoTscPath(REPO), link);
    const b = baseOf(path.join(REPO, 'fixtures/correct-reference'), 'specs/clean-arch.yaml', { tscPath: link, tscVersion: '5.9.3-pinned' });
    const r = await applyMutation(env([linesOperator()]), b, 'MO-TEST-lines', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(manifestOf(f.manifest).rows[0]?.typecheck).toEqual({ tscPath: link, tscVersion: '5.9.3-pinned', baseErrors: 0, mutantErrors: 0 });
  });
});

describe('rejections (BR-U5a-09, 16, 17, 34; F-U5A-REJECT, F-U5A-NOSITE)', () => {
  it('F-U5A-REJECT: one typecheck rejection, zero rows, copy gone', async () => {
    const f = fresh('reject');
    const r = await applyMutation(env([breakOperator()]), CORRECT(), 'MO-TEST-break', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data).toEqual({ rows: 0, rejections: 1 });
    const m = manifestOf(f.manifest);
    expect(m.rows).toEqual([]);
    expect(m.rejections.map((x) => x.reason)).toEqual(['typecheck']);
    expect(fs.existsSync(path.join(f.scratchRoot, 'correct-reference/MO-TEST-break/k-0'))).toBe(false);
  });

  it('F-U5A-NOSITE: a domain-requiring operator on the no-domain fixture → one no-site rejection', async () => {
    const f = fresh('nosite');
    const b = baseOf(path.join(REPO, 'tests/fixtures/u5a/no-domain'), 'tests/fixtures/u5a/no-domain/firewall.spec.yaml');
    const op = edgeOperator('MO-TEST-edge', () => true, { needsDomain: true });
    const r = await applyMutation(env([op]), b, 'MO-TEST-edge', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    const m = manifestOf(f.manifest);
    expect(m.rows).toEqual([]);
    expect(m.rejections.map((x) => x.reason)).toEqual(['no-site']);
  });

  it('BR-U5a-34: a throwing operator → one scrubbed apply-error, no row, copy removed', async () => {
    const f = fresh('throw');
    const token = ['sk', 'ant', 'api03', 'ABCDEFGHIJKLMNOPQRSTUV'].join('-');
    const r = await applyMutation(env([throwOperator(os.homedir(), token)]), CORRECT(), 'MO-TEST-throw', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    const m = manifestOf(f.manifest);
    expect(m.rows).toEqual([]);
    expect(m.rejections).toHaveLength(1);
    const detail = m.rejections[0]?.detail ?? '';
    expect(m.rejections[0]?.reason).toBe('apply-error');
    expect(detail).not.toContain(os.homedir());
    expect(detail).not.toContain(token);
    expect(fs.existsSync(path.join(f.scratchRoot, 'correct-reference/MO-TEST-throw/k-0'))).toBe(false);
  });

  it('BR-U5a-17: failure at sample position 1 of 3 → 2 rows, 1 rejection, no re-draw', async () => {
    const f = fresh('nodraw');
    const op = edgeOperator('MO-TEST-edge', (s, t) => s.startsWith('src/infrastructure/') && t.startsWith('src/domain/'), { breakOnCall: 2 });
    const r = await applyMutation(env([op], { sitesPerOperator: 3 }), CORRECT(), 'MO-TEST-edge', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data).toEqual({ rows: 2, rejections: 1 });
    const m = manifestOf(f.manifest);
    expect(m.rows.map((x) => x.seedDerivation.k)).toEqual([0, 2]);
    expect(m.rejections.map((x) => [x.reason, x.seedDerivation?.k])).toEqual([['typecheck', 1]]);
    expect(m.rows.every((x) => x.siteSelection === 'sampled')).toBe(true);
  });

  it('BR-U5a-12 (a): a positive whose templates are all style-disabled → one precondition rejection', async () => {
    const f = fresh('style');
    const op = edgeOperator('MO-TEST-edge', () => true, { templates: ['no-layer-skip'] });
    const r = await applyMutation(env([op]), CORRECT(), 'MO-TEST-edge', f.manifest, f.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(manifestOf(f.manifest).rejections.map((x) => [x.reason, (JSON.parse(x.detail) as { reason: string }).reason])).toEqual([['precondition', 'style-disabled']]);
  });
});

// ── Synthetic projects ──────────────────────────────────────────────────────────────────────────────────────────

const SYN_SPEC = 'tests/fixtures/u5a/no-domain/firewall.spec.yaml';
const TSCONFIG = JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', strict: true, skipLibCheck: true }, include: ['src/**/*.ts'] });

function writeProject(name: string, files: Readonly<Record<string, string>>): string {
  const dir = path.join(scratch, name);
  for (const [rel, text] of Object.entries({ 'tsconfig.json': TSCONFIG, ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

describe('cycle cap through the pipeline (BR-U5a-13)', () => {
  function capProject(): string {
    const files: Record<string, string> = {};
    for (let i = 0; i < 99; i++) {
      files[`src/persistence/c/a${String(i)}.ts`] = `import { b${String(i)} } from './b${String(i)}';\nexport const a${String(i)} = 1;\nexport const ra${String(i)} = (): number => b${String(i)};\n`;
      files[`src/persistence/c/b${String(i)}.ts`] = `import { a${String(i)} } from './a${String(i)}';\nexport const b${String(i)} = 1;\nexport const rb${String(i)} = (): number => a${String(i)};\n`;
    }
    files['src/persistence/x.ts'] = `export const x = 1;\n`;
    files['src/persistence/z.ts'] = `import { x } from './x';\nexport const z = 1;\nexport const rz = (): number => x;\n`;
    files['src/persistence/y.ts'] = `import { x } from './x';\nimport { z } from './z';\nexport const y = x + z;\n`;
    files['src/persistence/w.ts'] = `export const w = 1;\n`;
    files['src/persistence/v.ts'] = `import { w } from './w';\nexport const v = w;\n`;
    return writeProject('cap', files);
  }

  it('99 base cycles: a site adding 2 → cycle-cap (no row); a site adding 1 → a row', async () => {
    const dir = capProject();
    const b = baseOf(dir, SYN_SPEC);
    const two = edgeOperator('MO-TEST-edge', (s, t) => s === 'src/persistence/x.ts' && t === 'src/persistence/y.ts');
    const f1 = fresh('cap2');
    const r1 = await applyMutation(env([two]), b, 'MO-TEST-edge', f1.manifest, f1.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r1.success) throw new Error(JSON.stringify(r1.errors));
    const m1 = manifestOf(f1.manifest);
    expect(m1.rows).toEqual([]);
    expect(m1.rejections.map((x) => [x.reason, (JSON.parse(x.detail) as { rejectedByReason: unknown }).rejectedByReason])).toEqual([['no-site', { 'cycle-cap': 1 }]]);

    const one = edgeOperator('MO-TEST-edge', (s, t) => s === 'src/persistence/w.ts' && t === 'src/persistence/v.ts');
    const f2 = fresh('cap1');
    const r2 = await applyMutation(env([one]), b, 'MO-TEST-edge', f2.manifest, f2.scratchRoot, { cycleStrategy: 'simple-cycles' });
    if (!r2.success) throw new Error(JSON.stringify(r2.errors));
    const row = manifestOf(f2.manifest).rows[0];
    expect(row?.expected.collateral.filter((c) => c.cause === 'cycle').map((c) => c.key?.filePath)).toEqual([
      'src/persistence/v.ts,src/persistence/w.ts,src/persistence/v.ts',
    ]);
  });
});

describe('site order, preconditions and sampling (BR-U5a-11, 12, 16)', () => {
  const FILES: Record<string, string> = {
    'src/persistence/a.ts': `export const a = 1;\n`,
    'src/persistence/b.ts': `import { a } from './a';\nexport const b = a;\n`,
    'src/presentation/c.ts': `export const c = 1;\n`,
  };

  function handleWithOrder(order: readonly string[]): ReturnType<typeof openImportGraphProject> {
    const dir = writeProject(`order-${order.join('-').replace(/[/.]/g, '_')}`, FILES);
    const project = new Project({ compilerOptions: { strict: true }, skipAddingFilesFromTsConfig: true });
    for (const rel of order) project.addSourceFileAtPath(path.join(dir, rel));
    return { root: dir, tsconfigPath: path.join(dir, 'tsconfig.json'), project };
  }

  it('BR-U5a-11: the same project loaded in two orders yields identical site lists', async () => {
    const p = await parseSpec({ specFilePath: path.join(REPO, SYN_SPEC) });
    if (!p.success) throw new Error('spec');
    const op = edgeOperator('MO-TEST-edge', () => true);
    const keys = Object.keys(FILES);
    const one = sortSites(op.findSites(handleWithOrder(keys), p.data));
    const two = sortSites(op.findSites(handleWithOrder([...keys].reverse()), p.data));
    expect(one.length).toBe(6);
    expect(two).toEqual(one);
  });

  it('BR-U5a-12: each excluded candidate is absent and counted under its reason', async () => {
    const p = await parseSpec({ specFilePath: path.join(REPO, SYN_SPEC) });
    if (!p.success) throw new Error('spec');
    const dir = writeProject('pre', FILES);
    const handle = openImportGraphProject(dir, 'tsconfig.json');
    const g = buildImportGraph(handle, [
      { name: 'persistence', directories: ['src/persistence/**'] },
      { name: 'presentation', directories: ['src/presentation/**'] },
    ]);
    const base = baseOf(dir, SYN_SPEC, {
      judgeSelection: [{ template: 'architectural-integrity', functionId: 'FF-N01', capped: true, selectedFiles: ['src/persistence/a.ts'] }],
    });
    const ctx = (over: Partial<PreconditionContext> = {}): PreconditionContext => ({
      base,
      baseGraph: g,
      baseCycleCount: 0,
      maxCycleLength: 10,
      cycleRowCap: 100,
      thresholds: {},
      templateParams: {},
      enabledTemplates: [],
      ...over,
    });
    const site = (from: string, to: string, extra: Record<string, string> = {}) => ({
      filePath: from,
      line: 1,
      kind: 'import-edge' as const,
      detail: { targetFile: to, symbol: 'x', ...extra },
    });
    const op = edgeOperator('MO-TEST-edge', () => true);
    // edge pre-exists
    let t = evaluatePreconditions(op, handle, p.data, [site('src/persistence/b.ts', 'src/persistence/a.ts'), site('src/persistence/a.ts', 'src/presentation/c.ts')], ctx());
    expect(t.eligible.map((e) => e.site.filePath)).toEqual(['src/persistence/a.ts']);
    expect(t.rejectedByReason).toEqual({ 'edge-exists': 1 });
    // operator restriction
    t = evaluatePreconditions(op, handle, p.data, [site('src/persistence/a.ts', 'src/presentation/c.ts', { reject: 'controller-or-entity' })], ctx());
    expect([t.eligible.length, t.rejectedByReason]).toEqual([0, { 'controller-or-entity': 1 }]);
    // cycle cap (base already at the cap)
    t = evaluatePreconditions(op, handle, p.data, [site('src/persistence/a.ts', 'src/presentation/c.ts')], ctx({ baseCycleCount: 100 }));
    expect(t.rejectedByReason).toEqual({ 'cycle-cap': 1 });
    // planned edge closing one cycle at base + new = cap stays eligible (the over-cap case runs through the pipeline)
    t = evaluatePreconditions(op, handle, p.data, [site('src/persistence/a.ts', 'src/persistence/b.ts')], ctx({ baseCycleCount: 99 }));
    expect([t.eligible.length, t.rejectedByReason]).toEqual([1, {}]);
    // judge placement (BR-U5a-27): file selected only for integrity
    const semantic = edgeOperator('MO-TEST-judge', () => true, { judgeProbe: 'semantic' });
    const integrity = edgeOperator('MO-TEST-judge', () => true, { judgeProbe: 'integrity' });
    const s = site('src/persistence/a.ts', 'src/presentation/c.ts');
    expect(evaluatePreconditions(integrity, handle, p.data, [s], ctx()).eligible).toHaveLength(1);
    expect(evaluatePreconditions(semantic, handle, p.data, [s], ctx()).rejectedByReason).toEqual({ 'judge-unit-not-selected': 1 });
    expect(evaluatePreconditions(integrity, handle, p.data, [site('src/persistence/b.ts', 'src/presentation/c.ts')], ctx()).rejectedByReason).toEqual({
      'judge-unit-not-selected': 1,
    });
    const uncapped = baseOf(dir, SYN_SPEC, {
      judgeSelection: [{ template: 'intent-alignment', functionId: 'FF-N02', capped: false, selectedFiles: [] }],
    });
    expect(evaluatePreconditions(semantic, handle, p.data, [s], ctx({ base: uncapped })).eligible).toHaveLength(1);
  });

  it('BR-U5a-16 (a, b): same seed same sample, no duplicate, min(k, n) taken', () => {
    const eligible = Array.from({ length: 7 }, (_, i) => ({ site: { filePath: `f${String(i)}.ts`, line: 1, kind: 'import-edge' as const, detail: {} }, siteIndex: i }));
    const a = sampleSites(eligible, 3, 757368179);
    expect(sampleSites(eligible, 3, 757368179)).toEqual(a);
    expect(new Set(a.map((e) => e.siteIndex)).size).toBe(3);
    expect(sampleSites(eligible, 10, 1)).toHaveLength(7);
    expect(sampleSites(eligible, 3, 1)).not.toEqual(sampleSites(eligible, 3, 2));
  });
});
