/**
 * SP-* sensitivity probes (U5a plan Step 33; ADR-015 item 10; ADR-016 b; Q12; BR-U5a-30).
 *
 * - The set of probe target function ids equals the symbolic set `compileFunctions(compilerInputFromSpec(…))`
 *   compiles for `specs/clean-arch.yaml` plus FF-S03 under the layered fixture spec; since the U3 merge the clean-arch
 *   set holds FF-P06 (`domain-state-purity`), reached by SP-DF01-ci, so every probe resolves (OI-U5a-18).
 * - Each probe applies to its fixture at a forced site with `split: 'probe'`, the mutant type-checks, the row
 *   validates and carries the declared key of its target (expected key, `cycle` collateral, or the keyless
 *   `project-metric` entry).
 * - The catalogue §5 table equals the rendered probe set and its `SP hash` is the sha256 of that table.
 * Test code may import `src/apg-extractor` (BR-U5a-25).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../../src/apg-extractor/index.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { loadManifest, validateManifest } from '../../../../scripts/lib/manifest.js';
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import { applyMutation } from '../../../../scripts/lib/mutation/apply.js';
import { parseCatalogue } from '../../../../scripts/lib/mutation/catalogue-parser.js';
import { loadCompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import type { CompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import { defaultMutateDeps, main } from '../../../../scripts/lib/mutation/mutate-main.js';
import { CATALOGUE_PATH, MASTER_SEED } from '../../../../scripts/lib/mutation/operators/index.js';
import {
  PROBE_TARGET_IDS,
  SP_OPERATORS,
  SP_PROBES,
  buildProbeRegistry,
  loadProbeRegistry,
  probeEntries,
  probeTableText,
  renderedProbeTable,
  spHashOf,
} from '../../../../scripts/lib/mutation/operators/sp/index.js';
import type { MutationSite } from '../../../../scripts/lib/mutation/types.js';
import { CLEAN_SPEC, CORRECT_DIR, LAYERED_SPEC, NOW, REPO, fixtureBase } from './operator-harness.js';

jest.setTimeout(900_000);

const TASK = 'src/domain/entities/Task.ts';
const CATEGORY = 'src/domain/entities/Category.ts';
const ICAT = 'src/domain/repositories/ICategoryRepository.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const ICREATE = 'src/application/use-cases/ICreateTaskUseCase.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const ORPHAN = 'src/application/use-cases/OrphanHelper.ts';

/** Forced site of each probe on correct-reference: file plus a detail predicate (the full detail comes from findSites). */
const FORCED: Readonly<Record<string, { readonly filePath: string; readonly match?: (d: Readonly<Record<string, string>>) => boolean }>> = {
  'SP-FF-S01': { filePath: CATEGORY, match: (d) => d.targetFile === IMPL },
  'SP-FF-S02': { filePath: CATEGORY, match: (d) => d.targetFile === ICAT },
  'SP-FF-S03': { filePath: CTRL, match: (d) => d.targetFile === IMPL },
  'SP-FF-S04': { filePath: CATEGORY, match: (d) => d.targetFile === ICREATE },
  'SP-FF-P01': { filePath: TASK, match: (d) => d.package === 'express' },
  'SP-FF-P02': { filePath: CREATE },
  'SP-FF-P03': { filePath: IMPL },
  'SP-FF-P04': { filePath: CREATE, match: (d) => (d.deps ?? '').startsWith('InMemoryTaskRepository=') },
  'SP-FF-P05': { filePath: CTRL },
  'SP-DF01-ci': { filePath: CATEGORY, match: (d) => d.targetName === 'InMemoryTaskRepository' },
  'SP-FF-C01': { filePath: CATEGORY },
  'SP-FF-C02': { filePath: CATEGORY },
  'SP-FF-C03': { filePath: CATEGORY },
  'SP-FF-C04': { filePath: ORPHAN },
  'SP-FF-C05': { filePath: TASK },
  'SP-FF-C06': { filePath: 'src/application/use-cases/ProbeAbstraction.ts' },
  'SP-FF-SO01': { filePath: TASK },
  'SP-FF-SO02': { filePath: ITASK },
  'SP-FF-SO03': { filePath: 'src/application/use-cases/ProbeHierarchy.ts' },
  'SP-FF-CV01': { filePath: CATEGORY },
  'SP-FF-CV02': { filePath: CREATE },
  'SP-FF-CV03': { filePath: IMPL },
  'SP-FF-CV04': { filePath: CTRL },
  'SP-FF-CV05': { filePath: ORPHAN, match: (d) => d.importer === CREATE },
  'SP-FF-CV06': { filePath: 'src/domain/entities/index.ts' },
};

const runner = new NodeProcessRunner();
const compiled = new Map<string, CompiledSpec>();
let scratch: string;
let manifestPath: string;
const rows = new Map<string, ManifestRow>();
const sites = new Map<string, MutationSite>();

async function spec(p: string): Promise<CompiledSpec> {
  const hit = compiled.get(p);
  if (hit !== undefined) return hit;
  const r = await loadCompiledSpec(REPO, p);
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  compiled.set(p, r.data);
  return r.data;
}

beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-sp-'));
  manifestPath = path.join(scratch, 'manifest.json');
  const registry = buildProbeRegistry('d'.repeat(64));
  const handle = openImportGraphProject(CORRECT_DIR, 'tsconfig.json');
  for (const p of SP_PROBES) {
    const c = await spec(p.spec);
    const want = FORCED[p.op.id];
    if (want === undefined) throw new Error(`${p.op.id}: no forced site`);
    const site = p.op.findSites(handle, c.spec).find((s) => s.filePath === want.filePath && (want.match?.(s.detail) ?? true));
    if (site === undefined) throw new Error(`${p.op.id}: forced site ${want.filePath} not found`);
    sites.set(p.op.id, site);
    const r = await applyMutation(
      { repoRoot: REPO, runner, registry, masterSeed: MASTER_SEED, sitesPerOperator: 1, split: 'probe', now: () => NOW },
      fixtureBase(p.spec),
      p.op.id,
      manifestPath,
      path.join(scratch, 'copies'),
      { cycleStrategy: 'simple-cycles', siteOverride: { filePath: site.filePath, detail: site.detail } },
    );
    if (!r.success) throw new Error(`${p.op.id}: ${JSON.stringify(r.errors)}`);
    if (r.data.rows !== 1) {
      const m = loadManifest(REPO, manifestPath);
      throw new Error(`${p.op.id}: ${JSON.stringify(m.success ? m.data.rejections.at(-1) : m.errors)}`);
    }
  }
  const m = loadManifest(REPO, manifestPath);
  if (!m.success) throw new Error(JSON.stringify(m.errors));
  for (const row of m.data.rows) rows.set(row.operatorId, row);
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe('SP target set (BR-U5a-30)', () => {
  it('equals the compiled symbolic set of clean-arch plus FF-S03 under the layered spec; every probe resolves (FF-P06 since U3)', async () => {
    const clean = await spec(CLEAN_SPEC);
    const layered = await spec(LAYERED_SPEC);
    const expected = new Set([...clean.enabled.values()].flat().map((f) => f.functionId));
    expect(expected.size).toBe(24);
    expect(expected.has('FF-P06')).toBe(true);
    expect(expected.has('FF-S03')).toBe(false);
    expect((layered.enabled.get('no-layer-skip') ?? []).map((f) => f.functionId)).toEqual(['FF-S03']);
    expected.add('FF-S03');
    const resolved = new Set<string>();
    const unresolved: string[] = [];
    for (const p of SP_PROBES) {
      const ids = ((await spec(p.spec)).enabled.get(p.targetTemplate) ?? []).map((f) => f.functionId);
      if (ids.length === 0) unresolved.push(p.op.id);
      for (const id of ids) {
        resolved.add(id);
        expect([p.op.id, PROBE_TARGET_IDS[p.targetTemplate]]).toEqual([p.op.id, id]);
      }
    }
    expect([...resolved].sort()).toEqual([...expected].sort());
    expect(unresolved).toEqual([]);
  });

  it('one probe per target, ids SP-<functionId> (plus SP-DF01-ci), role probe, no twin, in coverage', () => {
    expect(SP_PROBES).toHaveLength(25);
    expect(new Set(SP_OPERATORS.map((o) => o.id)).size).toBe(25);
    for (const p of SP_PROBES) {
      const id = PROBE_TARGET_IDS[p.targetTemplate] ?? '';
      expect([p.op.id, p.op.role, p.op.twinOf, p.op.coverage]).toEqual([p.op.id === 'SP-DF01-ci' ? 'SP-DF01-ci' : `SP-${id}`, 'probe', undefined, 'in']);
      expect(p.op.coveredByTemplates).toEqual([p.targetTemplate]);
    }
    expect(new Set(SP_PROBES.map((p) => p.targetTemplate)).size).toBe(25);
  });

  it('the probe registry is frozen and loads with the catalogue sha256', () => {
    const r = loadProbeRegistry(REPO);
    if (!r.success) throw new Error('load');
    expect(r.data.list().map((o) => o.id).sort()).toEqual(SP_OPERATORS.map((o) => o.id).sort());
    const first = SP_OPERATORS[0];
    if (first === undefined) throw new Error('empty');
    const late = r.data.register({ ...first, id: 'SP-LATE' });
    expect(!late.success && late.errors[0]?.code).toBe('CAT_FROZEN');
  });
});

describe('each probe applies to its fixture and type-checks', () => {
  it('one probe row per probe; the manifest validates; every mutant has zero errors', () => {
    expect([...rows.keys()].sort()).toEqual(SP_OPERATORS.map((o) => o.id).sort());
    expect(validateManifest(REPO, JSON.parse(fs.readFileSync(manifestPath, 'utf8')))).toEqual({ valid: true, errors: [] });
    for (const r of rows.values()) {
      expect([r.operatorId, r.split, r.siteSelection, r.typecheck.mutantErrors]).toEqual([r.operatorId, 'probe', 'forced', 0]);
    }
  });

  it.each(SP_PROBES.map((p) => [p.op.id, p] as const))('%s carries the declared key of its target', (id, p) => {
    const row = rows.get(id);
    if (row === undefined) throw new Error(`${id}: no row`);
    const target = PROBE_TARGET_IDS[p.targetTemplate] ?? '';
    if (p.declaredBy === 'cycle-collateral') {
      expect(row.expected.collateral.some((c) => c.cause === 'cycle' && c.functionId === target && c.key !== undefined)).toBe(true);
    } else if (p.declaredBy === 'project-metric') {
      expect(row.expected.collateral.filter((c) => c.cause === 'project-metric').map((c) => [c.functionId, c.key])).toEqual([[target, undefined]]);
    } else if (id === 'SP-DF01-ci') {
      // BR-U3-22: the injection row has no line; key (site, target, [class, targetName, 'CONSTRUCTOR_INJECTS', parameter]).
      expect(row.expected.functionIds).toEqual(['FF-P06']);
      expect(row.expected.keys.map((k) => [k.functionId, k.lineRule, k.discriminator[2]])).toEqual([['FF-P06', 'none', 'CONSTRUCTOR_INJECTS']]);
    } else {
      expect(row.expected.functionIds).toEqual([target]);
      expect(row.expected.keys.map((k) => k.functionId)).toEqual([target]);
    }
  });
});

describe('probe edits (worked values on correct-reference)', () => {
  const keyOf = (id: string): unknown[] => (rows.get(id)?.expected.keys ?? []).map((k) => [k.filePath, k.target, k.discriminator, k.lineRule]);

  it('stated amounts: P02 1 concrete injection; C01 1, C02 11, C03 5 imported files; C05 10 importers; C06 6 classes; SO03 depth 4', () => {
    expect(sites.get('SP-FF-P02')?.detail).toMatchObject({ class: 'CreateTaskUseCase', interfaceDeps: '1', totalDeps: '1', amount: '1', deps: `Category=${CATEGORY}` });
    expect(rows.get('SP-FF-C01')?.createdFiles).toEqual(['src/application/use-cases/ProbeStability0.ts']);
    expect(rows.get('SP-FF-C02')?.createdFiles).toHaveLength(11);
    expect(rows.get('SP-FF-C03')?.createdFiles).toHaveLength(5);
    expect(rows.get('SP-FF-C05')?.createdFiles).toHaveLength(10);
    expect(sites.get('SP-FF-C06')?.detail).toMatchObject({ interfaces: '5', total: '11', amount: '6' });
    expect(sites.get('SP-FF-SO03')?.detail).toEqual({ maxDepth: '3', class: 'ProbeLevel4' });
  });

  it('keys: class-, implementation-, useCase- and controller/entity-discriminated', () => {
    expect(keyOf('SP-FF-P02')).toEqual([[CREATE, '', ['CreateTaskUseCase'], 'none']]);
    expect(keyOf('SP-FF-P03')).toEqual([[IMPL, '', ['InMemoryTaskRepository'], 'none']]);
    expect(keyOf('SP-FF-P04')).toEqual([[CREATE, '', ['CreateTaskUseCase'], 'none']]);
    expect(keyOf('SP-FF-P05')).toEqual([[CTRL, '', ['TaskController', 'ProbeEntity'], 'none']]);
    expect(keyOf('SP-FF-SO03')).toEqual([['src/application/use-cases/ProbeHierarchy.ts', '', ['ProbeLevel4'], 'none']]);
    expect(keyOf('SP-FF-CV01')).toEqual([[CATEGORY, '', ['category_probe'], 'site-line']]);
    expect(keyOf('SP-FF-CV03')).toEqual([[IMPL, '', ['InMemoryTaskRepositoryImpl'], 'site-line']]);
    expect(keyOf('SP-FF-CV04')).toEqual([[CTRL, '', ['TaskHandler'], 'site-line']]);
    expect(keyOf('SP-FF-CV06')).toEqual([['src/domain/entities/index.ts', '', [], 'none']]);
    expect(keyOf('SP-FF-S04')).toEqual([[CATEGORY, ICREATE, ['IMPORTS'], 'site-line']]);
  });

  it('SP-DF01-ci adds one CONSTRUCTOR_INJECTS edge Category → InMemoryTaskRepository (extractor, test code only)', async () => {
    const count = async (dir: string): Promise<number> => {
      const r = await extractAPG(dir);
      if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
      const name = new Map(r.data.nodes.map((n) => [n.id, n.name]));
      return r.data.edges.filter((e) => e.type === 'CONSTRUCTOR_INJECTS' && name.get(e.sourceId) === 'Category' && name.get(e.targetId) === 'InMemoryTaskRepository').length;
    };
    expect(await count(CORRECT_DIR)).toBe(0);
    expect(await count(path.join(scratch, 'copies', 'correct-reference', 'SP-DF01-ci', 'k-0'))).toBe(1);
    expect(rows.get('SP-DF01-ci')?.site.detail).toMatchObject({ class: 'Category', targetName: 'InMemoryTaskRepository', targetFile: IMPL });
  });

  it('SP-FF-C06 adds classes and declares the keyless project metric; SP-FF-S02 closes the Category ⇄ ICategoryRepository cycle', () => {
    expect(rows.get('SP-FF-C06')?.expected.collateral.find((c) => c.cause === 'project-metric')).toEqual({ kind: 'site', template: 'abstraction-ratio', functionId: 'FF-C06', cause: 'project-metric' });
    const cyc = rows.get('SP-FF-S02')?.expected.collateral.filter((c) => c.cause === 'cycle').map((c) => c.key?.filePath);
    expect(cyc).toEqual([[CATEGORY, ICAT, CATEGORY].join(',')]);
  });
});

describe('catalogue §5 and the SP hash', () => {
  const TEXT = fs.readFileSync(path.join(REPO, CATALOGUE_PATH), 'utf8');

  it('the §5 table equals the rendered probe set and parses back to the same entries', () => {
    const { table } = renderedProbeTable();
    expect(probeTableText(TEXT)).toBe(table);
    const parsed = parseCatalogue(TEXT);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.data.probes).toEqual(probeEntries());
  });

  it('the SP hash line equals sha256 of the table; a one-byte change alters it', () => {
    const { table, hash } = renderedProbeTable();
    expect(TEXT).toContain(`SP hash: \`sha256:${hash}\``);
    expect(spHashOf(table)).toBe(hash);
    expect(spHashOf(table + ' ')).not.toBe(hash);
  });
});

describe('scripts/mutate.ts resolves SP-* ids through the probe registry', () => {
  it('SP-FF-C04 on correct-reference with --split probe exits 0', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const site = sites.get('SP-FF-C04');
    if (site === undefined) throw new Error('no site');
    const code = await main(
      ['--base', 'fixtures/correct-reference', '--spec', CLEAN_SPEC, '--operator', 'SP-FF-C04', '--split', 'probe', '--site', JSON.stringify({ filePath: site.filePath, detail: site.detail }), '--manifest', path.join(scratch, 'cli.json'), '--out', path.join(scratch, 'cli')],
      REPO,
      { ...defaultMutateDeps(), now: () => NOW, out: (t) => out.push(t), err: (t) => err.push(t) },
    );
    expect([code, err.join('')]).toEqual([0, '']);
    const m = loadManifest(REPO, path.join(scratch, 'cli.json'));
    expect(m.success && m.data.rows.map((r) => [r.operatorId, r.split])).toEqual([['SP-FF-C04', 'probe']]);
  });
});
