/**
 * Data-flow operator MO-DF01 and its twin (U5a plan Step 29; FR-21; BR-U5a-14, 25; SO2). Test code may import
 * `src/apg-extractor` (BR-U5a-25); the mutation modules never do (BR-U5a-06).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../../src/apg-extractor/index.js';
import { resolveKey } from '../../../../scripts/lib/mutation/expected.js';
import { MO_DF01, MO_DF01N } from '../../../../scripts/lib/mutation/operators/mo-df01.js';
import { CLEAN_SPEC, CORRECT_DIR, applyForced, fixtureBase, keyTuples, tryApply } from './operator-harness.js';

jest.setTimeout(300_000);
const ALL = [MO_DF01, MO_DF01N];
const TASK = 'src/domain/entities/Task.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const CATEGORY = 'src/domain/entities/Category.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-ops-df-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

async function flowsTo(dir: string): Promise<{ count: number; via: unknown[]; field: unknown[] }> {
  const r = await extractAPG(dir);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  const edges = r.data.edges.filter((e) => e.type === 'FLOWS_TO');
  return { count: edges.length, via: edges.map((e) => e.properties.via), field: edges.map((e) => e.properties.field) };
}

describe('MO-DF01 (BR-U5a-25)', () => {
  it('Task holds new InMemoryTaskRepository(): FLOWS_TO 0 → 1 with the row via; keyed operator collateral and the two cycle keys', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-DF01', fixtureBase(CLEAN_SPEC), {
      filePath: TASK,
      detail: { class: 'Task', targetFile: IMPL, targetName: 'InMemoryTaskRepository' },
    });
    expect((await flowsTo(CORRECT_DIR)).count).toBe(0);
    const after = await flowsTo(copy);
    expect(after.count).toBe(1);
    expect(row?.expected.expectedEdges).toEqual([{ type: 'FLOWS_TO', source: 'Task', target: 'InMemoryTaskRepository', via: 'new' }]);
    expect(after.via).toEqual([row?.expected.expectedEdges?.[0]?.via]);
    expect(after.field).toEqual(['repo']);
    // Since U3 (FF-P06 declared by specs/clean-arch.yaml, BR-U3-22..24) MO-DF01 carries its expected key: field line, FLOWS_TO.
    expect(row?.expected).toMatchObject({ functionIds: ['FF-P06'], absentTemplates: [], dimension: 'pattern', coverage: 'in' });
    expect(keyTuples(row?.expected.keys ?? [])).toEqual([['FF-P06', TASK, IMPL, ['Task', 'InMemoryTaskRepository', 'FLOWS_TO', 'repo'], 'site-line', 5]]);
    const ops = (row?.expected.collateral ?? []).filter((c) => c.kind === 'operator');
    expect(keyTuples(ops.flatMap((c) => (c.key !== undefined ? [c.key] : [])))).toEqual([
      ['FF-S01', TASK, IMPL, ['IMPORTS'], 'site-line', 1],
      ['FF-S04', TASK, IMPL, ['IMPORTS'], 'site-line', 1],
    ]);
    expect((row?.expected.collateral ?? []).filter((c) => c.cause === 'cycle').map((c) => c.key?.filePath)).toEqual([
      [TASK, IMPL, TASK].join(','),
      [TASK, IMPL, ITASK, TASK].join(','),
    ]);
    expect(fs.readFileSync(path.join(copy, TASK), 'utf8')).toContain('private readonly repo = new InMemoryTaskRepository();');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('domain-state-purity key form when a spec declares the template (field line, FLOWS_TO relType per template)', () => {
    const site = { filePath: TASK, line: 2, kind: 'field-new' as const, detail: { class: 'Task', targetFile: IMPL, targetName: 'InMemoryTaskRepository' } };
    const edit = {
      editedFiles: [TASK],
      createdFiles: [],
      lineShifts: [],
      newEdges: [],
      keyAnchor: { line: 1, lines: { 'domain-state-purity': 5 }, values: { class: 'Task', targetName: 'InMemoryTaskRepository', field: 'repo', 'relType@domain-state-purity': 'FLOWS_TO' } },
    };
    const rule = MO_DF01.expectedTemplates[0];
    if (rule === undefined) throw new Error('no rule');
    const k = resolveKey(rule, 'FF-P06', site, edit);
    expect(k.success && k.data).toEqual({ functionId: 'FF-P06', filePath: TASK, target: IMPL, discriminator: ['Task', 'InMemoryTaskRepository', 'FLOWS_TO', 'repo'], lineRule: 'site-line', line: 5 });
    const op = MO_DF01.operatorCollateral[0];
    if (op === undefined) throw new Error('no collateral rule');
    const c = resolveKey(op, 'FF-S01', site, edit);
    expect(c.success && c.data).toEqual({ functionId: 'FF-S01', filePath: TASK, target: IMPL, discriminator: ['IMPORTS'], lineRule: 'site-line', line: 1 });
  });
});

describe('MO-DF01n (BR-U5a-25)', () => {
  it('InMemoryTaskRepository holds new Category(literals): FLOWS_TO 0 → 1, negative', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-DF01n', fixtureBase(CLEAN_SPEC), {
      filePath: IMPL,
      detail: { class: 'InMemoryTaskRepository', targetFile: CATEGORY, targetName: 'Category' },
    });
    const after = await flowsTo(copy);
    expect(after.count).toBe(1);
    expect(after.via).toEqual(['new']);
    expect(row?.expected).toEqual({
      negative: true,
      twinOf: 'MO-DF01',
      functionIds: [],
      keys: [],
      collateral: [],
      coverage: 'in',
      expectedEdges: [{ type: 'FLOWS_TO', source: 'InMemoryTaskRepository', target: 'Category', via: 'new' }],
    });
    expect(fs.readFileSync(path.join(copy, IMPL), 'utf8')).toContain(`private readonly held = new Category('u5a', 'u5a', 'u5a');`);
  });

  it('Task is not eligible (Date constructor parameter) → MUT_SITE_OVERRIDE_INVALID, counted type-shape', async () => {
    const { result } = await tryApply(scratch, ALL, 'MO-DF01n', fixtureBase(CLEAN_SPEC), {
      filePath: IMPL,
      detail: { class: 'InMemoryTaskRepository', targetFile: TASK, targetName: 'Task' },
    });
    expect(!result.success && result.errors[0]?.code).toBe('MUT_SITE_OVERRIDE_INVALID');
    expect(!result.success && JSON.stringify(result.errors[0]?.context)).toContain('"type-shape"');
  });
});
