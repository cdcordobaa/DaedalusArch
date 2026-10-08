/**
 * Judge-construction probes MO-X02 (Semantic) and MO-X03 (Integrity) with twins (U5a plan Step 30; FR-24
 * amendment; BR-U5a-26..29; U4P Q6, Q12). Sites forced on correct-reference under `specs/clean-arch.yaml`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateManifest } from '../../../../scripts/lib/manifest.js';
import type { JudgeSelection } from '../../../../scripts/lib/mutation/types.js';
import { MO_X02, MO_X02N } from '../../../../scripts/lib/mutation/operators/mo-x02.js';
import { MO_X03, MO_X03N } from '../../../../scripts/lib/mutation/operators/mo-x03.js';
import { CLEAN_SPEC, REPO, applyForced, fixtureBase } from './operator-harness.js';

jest.setTimeout(300_000);
const ALL = [MO_X02, MO_X02N, MO_X03, MO_X03N];
const TASK = 'src/domain/entities/Task.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const RULES = 'src/domain/rules/taskRules.ts';
const X02_SITE = {
  filePath: TASK,
  detail: { class: 'Task', method: 'isValid', controllerFile: CTRL, controller: 'TaskController', handler: 'createTask', guardFiles: CREATE },
};
const X03_SITE = { filePath: TASK, detail: { class: 'Task', method: 'isValid', guardFile: CREATE } };

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-ops-judge-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

const read = (copy: string, rel: string): string => fs.readFileSync(path.join(copy, rel), 'utf8');
/** The rule `title.length > 0 && categoryId.length > 0` over any receiver (`this.`, `input.` or none). */
const RULE = /(?:\b\w+\.)?title\.length > 0 && (?:\b\w+\.)?categoryId\.length > 0/g;

describe('MO-X02 (BR-U5a-26, 28)', () => {
  it('guard moves into TaskController.createTask; Task.isValid and the guard are removed; no domain import', async () => {
    const { row, copy, manifest } = await applyForced(scratch, ALL, 'MO-X02', fixtureBase(CLEAN_SPEC), X02_SITE);
    expect(row?.expected).toEqual({
      functionIds: [],
      disabledFunctionIds: [],
      absentTemplates: [],
      dimension: 'semantic',
      keys: [],
      collateral: [],
      coverage: 'outside',
      judgeProbe: 'semantic',
    });
    expect(validateManifest(REPO, manifest).valid).toBe(true);
    expect(read(copy, TASK)).not.toContain('isValid');
    const useCase = read(copy, CREATE);
    expect(useCase).not.toContain('isValid');
    expect(useCase).not.toContain('Invalid task data');
    const ctrl = read(copy, CTRL);
    expect(ctrl).toContain('if (!(title.length > 0 && categoryId.length > 0)) {');
    expect(ctrl.match(/^import .* from '([^']+)';$/gm)?.some((l) => l.includes('/domain/'))).toBe(false);
    expect(row?.editedFiles).toEqual([CREATE, TASK, CTRL].sort());
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('MO-X02n: local extraction in the controller, no import, negative', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-X02n', fixtureBase(CLEAN_SPEC), {
      filePath: CTRL,
      detail: { controllerFile: CTRL, controller: 'TaskController', handler: 'createTask' },
    });
    expect(row?.expected).toEqual({ negative: true, twinOf: 'MO-X02', functionIds: [], keys: [], collateral: [], coverage: 'outside' });
    expect(read(copy, CTRL)).toContain('const result = this.createTaskUseCase.execute(title, description, categoryId);');
    expect(row?.editedFiles).toEqual([CTRL]);
  });
});

describe('MO-X03 (BR-U5a-26, 29)', () => {
  it('rule module imported and called by the use case; rule twice outside Task.ts; only test-file-pairing collateral', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-X03', fixtureBase(CLEAN_SPEC), X03_SITE);
    expect(row?.createdFiles).toEqual([RULES]);
    const rules = read(copy, RULES);
    expect(rules).not.toMatch(/^import /m);
    expect(rules).toContain('export function isValidTask(title: string, categoryId: string): boolean {');
    const useCase = read(copy, CREATE);
    expect(useCase.match(/^import .*$/gm)?.filter((l) => l.includes('rules/taskRules'))).toHaveLength(1);
    expect(useCase).toContain('if (!isValidTask(task.title, task.categoryId)) {');
    expect(useCase).toContain('if (!(input.title.length > 0 && input.categoryId.length > 0)) {');
    expect([...rules.matchAll(RULE)].length + [...useCase.matchAll(RULE)].length).toBe(2);
    expect(read(copy, TASK)).not.toContain('isValid');
    expect(row?.expected).toMatchObject({ functionIds: [], dimension: 'integrity', judgeProbe: 'integrity', coverage: 'outside', keys: [] });
    expect(row?.expected.collateral.map((c) => [c.cause, c.functionId, c.key?.filePath])).toEqual([['created-without-test', 'FF-CV05', RULES]]);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('MO-X03n: private method extraction in Task, negative', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'MO-X03n', fixtureBase(CLEAN_SPEC), {
      filePath: TASK,
      detail: { class: 'Task', method: 'isValid', limit: '10' },
    });
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'MO-X03', collateral: [] });
    const text = read(copy, TASK);
    expect(text).toContain('return this.isValidInvariant();');
    expect(text).toContain('private isValidInvariant(): boolean {');
  });
});

describe('judge placement over the per-function selection (BR-U5a-27)', () => {
  const both = (integrityCapped: boolean): JudgeSelection[] => [
    { template: 'intent-alignment', functionId: 'FF-N02', capped: true, selectedFiles: [CREATE, TASK, CTRL].sort() },
    { template: 'architectural-integrity', functionId: 'FF-N01', capped: integrityCapped, selectedFiles: [CTRL] },
  ];

  it('files selected only for intent-alignment: MO-X02 eligible, MO-X03 rejected judge-unit-not-selected on a capped base', async () => {
    const x02 = await applyForced(scratch, ALL, 'MO-X02', fixtureBase(CLEAN_SPEC, undefined, both(true)), X02_SITE);
    expect(x02.manifest.rows).toHaveLength(1);
    const x03 = await applyForced(scratch, ALL, 'MO-X03', fixtureBase(CLEAN_SPEC, undefined, both(true)), undefined);
    expect(x03.manifest.rows).toEqual([]);
    expect(x03.manifest.rejections.map((r) => [r.reason, (JSON.parse(r.detail) as { rejectedByReason: unknown }).rejectedByReason])).toEqual([
      // Task.isValid: not selected for integrity; Category.isValid: never called, so not a removable guard.
      ['no-site', { 'judge-unit-not-selected': 1, 'not-removable-guard': 1 }],
    ]);
  });

  it("with the integrity entry's capped: false, MO-X03 is eligible", async () => {
    const x03 = await applyForced(scratch, ALL, 'MO-X03', fixtureBase(CLEAN_SPEC, undefined, both(false)), X03_SITE);
    expect(x03.manifest.rows).toHaveLength(1);
  });

  it('a capped base without an entry for the probed function rejects every site', async () => {
    const only: JudgeSelection[] = [{ template: 'intent-alignment', functionId: 'FF-N02', capped: true, selectedFiles: [TASK] }];
    const x03 = await applyForced(scratch, ALL, 'MO-X03', fixtureBase(CLEAN_SPEC, undefined, only), undefined);
    expect(x03.manifest.rejections.map((r) => r.reason)).toEqual(['no-site']);
  });
});
