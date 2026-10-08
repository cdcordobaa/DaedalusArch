/**
 * SOLID and convention operators with twins (U5a plan Step 28; BR-U5a-23, 24; BR-U1-38; ADR-016 f).
 * Sites are forced (BR-U5a-55) on copies of correct-reference under `specs/clean-arch.yaml`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { compilePattern } from '../../../../src/fitness-compiler/pattern-compiler.js';
import { MO_CV02, MO_CV02N, NAMING_ROLE, RENAME_SUFFIXES, TWIN_PREFIXES, positiveNames, twinNames } from '../../../../scripts/lib/mutation/operators/mo-cv02.js';
import { MO_SO01, MO_SO01N, arithmetic } from '../../../../scripts/lib/mutation/operators/mo-so01.js';
import { MO_SO02, MO_SO02N } from '../../../../scripts/lib/mutation/operators/mo-so02.js';
import { CLEAN_SPEC, applyForced, collateralTuples, fixtureBase, keyTuples, tryApply } from './operator-harness.js';

jest.setTimeout(300_000);
const ALL = [MO_SO01, MO_SO01N, MO_SO02, MO_SO02N, MO_CV02, MO_CV02N];
const TASK = 'src/domain/entities/Task.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const ICAT = 'src/domain/repositories/ICategoryRepository.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-ops-solid-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

const clean = (): ReturnType<typeof fixtureBase> => fixtureBase(CLEAN_SPEC);

function counts(copy: string, rel: string): { classes: Record<string, number>; interfaces: Record<string, number> } {
  const sf = new Project({ skipAddingFilesFromTsConfig: true }).addSourceFileAtPath(path.join(copy, rel));
  const classes: Record<string, number> = {};
  const interfaces: Record<string, number> = {};
  for (const c of sf.getClasses()) classes[c.getName() ?? ''] = c.getMethods().length;
  for (const i of sf.getInterfaces()) interfaces[i.getName()] = i.getMethods().length;
  return { classes, interfaces };
}

describe('threshold arithmetic (BR-U5a-24)', () => {
  it('positive adds t − b + 1 (b ≤ t), twin adds t − b (≥ 1)', () => {
    expect(arithmetic(2, 10, false)).toBe(9);
    expect(arithmetic(2, 10, true)).toBe(8);
    expect(arithmetic(10, 10, false)).toBe(1);
    expect(arithmetic(10, 10, true)).toEqual({ ok: false, reason: 'threshold-arithmetic' });
    expect(arithmetic(11, 10, false)).toEqual({ ok: false, reason: 'metric-already-violating' });
  });

  it('MO-SO01 on Task (2) adds 9 → FF-SO01 key; MO-SO01n adds 8 (total 10)', async () => {
    const pos = await applyForced(scratch, ALL, 'MO-SO01', clean(), { filePath: TASK, detail: { class: 'Task', limit: '10' } });
    expect(counts(pos.copy, TASK).classes.Task).toBe(11);
    expect(keyTuples(pos.row?.expected.keys ?? [])).toEqual([['FF-SO01', TASK, '', ['Task'], 'site-line', 2]]);
    expect(pos.row?.expected.collateral).toEqual([]);
    expect(pos.row?.typecheck.mutantErrors).toBe(0);
    const twin = await applyForced(scratch, ALL, 'MO-SO01n', clean(), { filePath: TASK, detail: { class: 'Task', limit: '10' } });
    expect(counts(twin.copy, TASK).classes.Task).toBe(10);
    expect(twin.row?.expected).toMatchObject({ negative: true, twinOf: 'MO-SO01', collateral: [] });
  });

  it('MO-SO02 on ITaskRepository (5) adds 1; InMemoryTaskRepository 5 → 6', async () => {
    const r = await applyForced(scratch, ALL, 'MO-SO02', clean(), { filePath: ITASK, detail: { interface: 'ITaskRepository', limit: '5', classLimit: '10' } });
    expect(counts(r.copy, ITASK).interfaces.ITaskRepository).toBe(6);
    expect(counts(r.copy, IMPL).classes.InMemoryTaskRepository).toBe(6);
    expect(r.row?.editedFiles).toEqual([ITASK, IMPL]);
    expect(keyTuples(r.row?.expected.keys ?? [])).toEqual([['FF-SO02', ITASK, '', ['ITaskRepository'], 'site-line', 3]]);
    expect(r.row?.typecheck.mutantErrors).toBe(0);
  });

  it('MO-SO02n on ITaskRepository → MUT_SITE_OVERRIDE_INVALID (counted threshold-arithmetic), manifest stays empty', async () => {
    const { result, manifestPath } = await tryApply(scratch, ALL, 'MO-SO02n', clean(), {
      filePath: ITASK,
      detail: { interface: 'ITaskRepository', limit: '5', classLimit: '10' },
    });
    expect(!result.success && result.errors[0]?.code).toBe('MUT_SITE_OVERRIDE_INVALID');
    expect(!result.success && JSON.stringify(result.errors[0]?.context)).toContain('"threshold-arithmetic":1');
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).toMatchObject({ rows: [], rejections: [] });
  });

  it('MO-SO02n on ICategoryRepository (4 → 5), no implementer → one row', async () => {
    const r = await applyForced(scratch, ALL, 'MO-SO02n', clean(), { filePath: ICAT, detail: { interface: 'ICategoryRepository', limit: '5', classLimit: '10' } });
    expect(counts(r.copy, ICAT).interfaces.ICategoryRepository).toBe(5);
    expect(r.row?.editedFiles).toEqual([ICAT]);
    expect(r.row?.expected).toMatchObject({ negative: true, twinOf: 'MO-SO02', collateral: [] });
  });
});

describe('MO-CV02 rename list (BR-U5a-23)', () => {
  const regex = new RegExp(compilePattern('*Service|*UseCase'));
  const NAMES = ['CreateTaskUseCase', 'CompleteTaskUseCase', 'BillingService', 'TaskServiceImpl', 'UseCaseRunner'];

  it("U1's compiled FF-CV02 pattern is ^(?:[^/]*Service|[^/]*UseCase)$", () => {
    expect(compilePattern('*Service|*UseCase')).toBe('^(?:[^/]*Service|[^/]*UseCase)$');
  });

  it('positive names contain Service/UseCase and fail the regex; twin names match it', () => {
    expect(RENAME_SUFFIXES.length).toBeGreaterThan(0);
    expect(TWIN_PREFIXES.length).toBeGreaterThan(0);
    for (const n of NAMES) {
      for (const p of positiveNames(n)) {
        expect(p).toMatch(NAMING_ROLE);
        expect(regex.test(p)).toBe(false);
      }
      for (const t of twinNames(n)) expect(regex.test(t)).toBe(true);
    }
  });

  it('MO-CV02 on CreateTaskUseCase: drawn positive name, naming-services key and keyed naming-conventions collateral', async () => {
    const r = await applyForced(scratch, ALL, 'MO-CV02', clean(), { filePath: CREATE, detail: { class: 'CreateTaskUseCase' } });
    const renamed = r.row?.expected.keys[0]?.discriminator[0] ?? '';
    expect(positiveNames('CreateTaskUseCase')).toContain(renamed);
    expect(regex.test(renamed)).toBe(false);
    expect(keyTuples(r.row?.expected.keys ?? [])).toEqual([['FF-CV02', CREATE, '', [renamed], 'site-line', 10]]);
    expect(collateralTuples(r.row)).toEqual([['operator', 'declared', 'FF-CV01', CREATE, '', [renamed]]]);
    expect(fs.readFileSync(path.join(r.copy, CREATE), 'utf8')).toContain(`export class ${renamed} {`);
    expect(fs.existsSync(path.join(r.copy, CREATE))).toBe(true);
    expect(r.row?.lineShifts).toEqual([]);
    expect(r.row?.typecheck.mutantErrors).toBe(0);
  });

  it('MO-CV02n: conforming name, negative with the keyed naming-conventions collateral', async () => {
    const r = await applyForced(scratch, ALL, 'MO-CV02n', clean(), { filePath: CREATE, detail: { class: 'CreateTaskUseCase' } });
    const renamed = r.row?.expected.collateral[0]?.key?.discriminator[0] ?? '';
    expect(twinNames('CreateTaskUseCase')).toContain(renamed);
    expect(regex.test(renamed)).toBe(true);
    expect(r.row?.expected).toMatchObject({ negative: true, twinOf: 'MO-CV02', keys: [] });
    expect(collateralTuples(r.row)).toEqual([['operator', 'declared', 'FF-CV01', CREATE, '', [renamed]]]);
  });
});
