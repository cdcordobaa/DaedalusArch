/**
 * Structural, pattern and coupling operators with twins (U5a plan Step 27; §3 MO-S01, MO-P01, MO-C04, MO-X01,
 * MO-S03; BR-U5a-10, 12, 13, 14; F-U5A-CYCLE). Sites are the forced sites of `business-logic-model.md` §2.3.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../../src/spec-parser/index.js';
import { compileFunctions, compilerInputFromSpec } from '../../../../src/fitness-compiler/index.js';
import { MO_C04, MO_C04N } from '../../../../scripts/lib/mutation/operators/mo-c04.js';
import { MO_P01, MO_P01N } from '../../../../scripts/lib/mutation/operators/mo-p01.js';
import { MO_S01, MO_S01N } from '../../../../scripts/lib/mutation/operators/mo-s01.js';
import { MO_S03, MO_S03N } from '../../../../scripts/lib/mutation/operators/mo-s03.js';
import { MO_X01, MO_X01N } from '../../../../scripts/lib/mutation/operators/mo-x01.js';
import { CLEAN_SPEC, LAYERED_SPEC, REPO, applyForced, collateralTuples, fixtureBase, keyTuples } from './operator-harness.js';

jest.setTimeout(300_000);
const TASK = 'src/domain/entities/Task.ts';
const REPO_FILE = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const ICAT = 'src/domain/repositories/ICategoryRepository.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const ORPHAN = 'src/application/use-cases/OrphanHelper.ts';
const ALL = [MO_S01, MO_S01N, MO_P01, MO_P01N, MO_C04, MO_C04N, MO_X01, MO_X01N, MO_S03, MO_S03N];

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-ops-structural-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

const clean = (): ReturnType<typeof fixtureBase> => fixtureBase(CLEAN_SPEC);
const read = (copy: string, rel: string): string => fs.readFileSync(path.join(copy, rel), 'utf8');

describe('layered fixture spec (asserted first)', () => {
  it('parses and compiles under U1 with FF-S03 compiled', async () => {
    const p = await parseSpec({ specFilePath: path.join(REPO, LAYERED_SPEC) });
    if (!p.success) throw new Error(JSON.stringify(p.errors));
    const c = compileFunctions(compilerInputFromSpec(p.data));
    if (!c.success) throw new Error(JSON.stringify(c.errors));
    expect(c.data.symbolicQueries.map((q) => String(q.functionId))).toContain('FF-S03');
  });
});

describe('MO-S01 / MO-S01n', () => {
  it('MO-S01 (F-U5A-CYCLE): expected S01/S04 keys and exactly the two §2.4 FF-S02 keys', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-S01', clean(), {
      filePath: TASK,
      detail: { symbol: 'InMemoryTaskRepository', targetFile: REPO_FILE },
    });
    expect(keyTuples(row?.expected.keys ?? [])).toEqual([
      ['FF-S01', TASK, REPO_FILE, ['IMPORTS'], 'site-line', 1],
      ['FF-S04', TASK, REPO_FILE, ['IMPORTS'], 'site-line', 1],
    ]);
    const c1 = [TASK, REPO_FILE, TASK];
    const c2 = [TASK, REPO_FILE, ITASK, TASK];
    expect(row?.expected.collateral.map((c) => [c.kind, c.cause, c.key?.functionId, c.key?.filePath, c.key?.target, c.key?.discriminator, c.key?.lineRule])).toEqual([
      ['site', 'cycle', 'FF-S02', String(c1), REPO_FILE, [JSON.stringify(c1)], 'first-edge-line'],
      ['site', 'cycle', 'FF-S02', String(c2), REPO_FILE, [JSON.stringify(c2)], 'first-edge-line'],
    ]);
    expect(row?.expected.collateral[0]?.key?.filePath).toBe(
      'src/domain/entities/Task.ts,src/infrastructure/repositories/InMemoryTaskRepository.ts,src/domain/entities/Task.ts',
    );
    expect(row?.expected.functionIds).toEqual(['FF-S01', 'FF-S04']);
    const text = read(copy, TASK);
    expect(row?.lineShifts).toEqual([
      { filePath: TASK, afterLine: 0, delta: 2 },
      { filePath: TASK, afterLine: 19, delta: 1 },
    ]);
    expect(text.split('\n').slice(2, 21).join('\n')).toBe(fs.readFileSync(path.join(REPO, 'fixtures/correct-reference', TASK), 'utf8').split('\n').slice(0, 19).join('\n'));
    expect(text).toContain(`import { InMemoryTaskRepository } from "../../infrastructure/repositories/InMemoryTaskRepository";`);
    expect(text).toContain('export const inMemoryTaskRepositoryRef = InMemoryTaskRepository;');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('MO-S01 on the no-domain fixture → one no-site rejection (F-U5A-NOSITE)', async () => {
    const { manifest } = await applyForced(
      scratch,
      ALL,
      'MO-S01',
      fixtureBase('tests/fixtures/u5a/no-domain/firewall.spec.yaml', path.join(REPO, 'tests/fixtures/u5a/no-domain')),
      undefined,
    );
    expect(manifest.rows).toEqual([]);
    expect(manifest.rejections.map((r) => r.reason)).toEqual(['no-site']);
  });

  it('MO-S01n: InMemoryTaskRepository → ICategoryRepository, negative, no collateral', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-S01n', clean(), {
      filePath: REPO_FILE,
      detail: { symbol: 'ICategoryRepository', targetFile: ICAT },
    });
    expect(row?.expected).toEqual({ negative: true, twinOf: 'MO-S01', functionIds: [], keys: [], collateral: [], coverage: 'in' });
    expect(read(copy, REPO_FILE)).toContain('export type ICategoryRepositoryRef = ICategoryRepository;');
  });
});

describe('MO-P01 / MO-P01n', () => {
  it('MO-P01: express default import with a default-export stub; domain-purity key on the package', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-P01', clean(), { filePath: TASK, detail: { package: 'express' } });
    expect(keyTuples(row?.expected.keys ?? [])).toEqual([['FF-P01', TASK, 'express', ['IMPORTS'], 'site-line', 1]]);
    expect(row?.expected.collateral).toEqual([]);
    expect(row?.provisionedStubs).toEqual([{ specifier: 'express', path: 'node_modules/express' }]);
    expect(read(copy, 'node_modules/express/index.d.ts')).toContain('export default _default');
    expect(read(copy, TASK)).toContain('import express from "express";');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('MO-P01n: same import in InMemoryTaskRepository, negative', async () => {
    const { row } = await applyForced(scratch, ALL, 'MO-P01n', clean(), { filePath: REPO_FILE, detail: { package: 'express' } });
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'MO-P01', collateral: [] });
  });
});

describe('MO-C04 / MO-C04n', () => {
  it('MO-C04: orphan file → FF-C04 key, test-file-pairing collateral only', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-C04', clean(), { filePath: ORPHAN, detail: { directory: 'src/application/use-cases' } });
    expect(row?.createdFiles).toEqual([ORPHAN]);
    expect(row?.editedFiles).toEqual([]);
    expect(keyTuples(row?.expected.keys ?? [])).toEqual([['FF-C04', ORPHAN, '', [], 'none', null]]);
    expect(collateralTuples(row)).toEqual([['site', 'created-without-test', 'FF-CV05', ORPHAN, '', []]]);
    expect(read(copy, ORPHAN)).toBe('export const orphanHelperValue = 1;\n');
  });

  it('MO-C04n: imported by CreateTaskUseCase → test-file-pairing only, no metric crossing', async () => {
    const { row } = await applyForced(scratch, ALL, 'MO-C04n', clean(), {
      filePath: ORPHAN,
      detail: { directory: 'src/application/use-cases', importer: CREATE },
    });
    expect(row?.editedFiles).toEqual([CREATE]);
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'MO-C04' });
    expect(collateralTuples(row)).toEqual([['site', 'created-without-test', 'FF-CV05', ORPHAN, '', []]]);
  });
});

describe('MO-X01 / MO-X01n (outside coverage)', () => {
  it('MO-X01: import() in Task, intended S01/S04 keys, no static edge, no collateral', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-X01', clean(), {
      filePath: TASK,
      detail: { symbol: 'InMemoryTaskRepository', targetFile: REPO_FILE },
    });
    expect(row?.expected).toMatchObject({ coverage: 'outside', functionIds: ['FF-S01', 'FF-S04'], collateral: [] });
    expect(row?.expected.keys.map((k) => [k.functionId, k.filePath, k.target])).toEqual([
      ['FF-S01', TASK, REPO_FILE],
      ['FF-S04', TASK, REPO_FILE],
    ]);
    expect(read(copy, TASK)).toContain(`return import('../../infrastructure/repositories/InMemoryTaskRepository');`);
  });

  it('MO-X01n: import() of ICategoryRepository in InMemoryTaskRepository, negative', async () => {
    const { row } = await applyForced(scratch, ALL, 'MO-X01n', clean(), {
      filePath: REPO_FILE,
      detail: { symbol: 'ICategoryRepository', targetFile: ICAT },
    });
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'MO-X01', collateral: [], coverage: 'outside' });
  });
});

describe('MO-S03 / MO-S03n (layered fixture spec)', () => {
  it('MO-S03: presentation → persistence → FF-S03 key, no cycle collateral', async () => {
    const { row } = await applyForced(scratch, ALL, 'MO-S03', fixtureBase(LAYERED_SPEC), {
      filePath: CTRL,
      detail: { symbol: 'InMemoryTaskRepository', targetFile: REPO_FILE },
    });
    expect(row?.expected.functionIds).toEqual(['FF-S03']);
    expect(keyTuples(row?.expected.keys ?? [])).toEqual([['FF-S03', CTRL, REPO_FILE, ['IMPORTS'], 'site-line', 3]]);
    expect(row?.expected.collateral).toEqual([]);
  });

  it('MO-S03n: presentation → Task (business), negative', async () => {
    const { row } = await applyForced(scratch, ALL, 'MO-S03n', fixtureBase(LAYERED_SPEC), {
      filePath: CTRL,
      detail: { symbol: 'Task', targetFile: TASK },
    });
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'MO-S03', collateral: [] });
  });

  it('MO-S03 under a nestjs spec → one precondition rejection (BR-U5a-12 a, BR-U5a-19)', async () => {
    const { manifest } = await applyForced(scratch, ALL, 'MO-S03', fixtureBase('presets/nestjs.yaml'), undefined);
    expect(manifest.rows).toEqual([]);
    expect(manifest.rejections.map((r) => r.reason)).toEqual(['precondition']);
  });
});
