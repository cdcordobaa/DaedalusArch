/**
 * The 22 forced FR-24 acceptance sites of `business-logic-model.md` §2.3 (BR-U5a-55): correct-reference under
 * `specs/clean-arch.yaml`, MO-S03/MO-S03n under the layered fixture spec.
 */
import { CLEAN_SPEC, LAYERED_SPEC } from './operator-harness.js';

const TASK = 'src/domain/entities/Task.ts';
const CATEGORY = 'src/domain/entities/Category.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const ICAT = 'src/domain/repositories/ICategoryRepository.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const ORPHAN = 'src/application/use-cases/OrphanHelper.ts';

export interface ForcedEntry {
  readonly id: string;
  readonly spec: string;
  readonly site: { readonly filePath: string; readonly detail: Readonly<Record<string, string>> };
}

export const FORCED_SITES: readonly ForcedEntry[] = [
  { id: 'MO-S01', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { symbol: 'InMemoryTaskRepository', targetFile: IMPL } } },
  { id: 'MO-S01n', spec: CLEAN_SPEC, site: { filePath: IMPL, detail: { symbol: 'ICategoryRepository', targetFile: ICAT } } },
  { id: 'MO-P01', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { package: 'express' } } },
  { id: 'MO-P01n', spec: CLEAN_SPEC, site: { filePath: IMPL, detail: { package: 'express' } } },
  { id: 'MO-C04', spec: CLEAN_SPEC, site: { filePath: ORPHAN, detail: { directory: 'src/application/use-cases' } } },
  { id: 'MO-C04n', spec: CLEAN_SPEC, site: { filePath: ORPHAN, detail: { directory: 'src/application/use-cases', importer: CREATE } } },
  { id: 'MO-SO01', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { class: 'Task', limit: '10' } } },
  { id: 'MO-SO01n', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { class: 'Task', limit: '10' } } },
  { id: 'MO-CV02', spec: CLEAN_SPEC, site: { filePath: CREATE, detail: { class: 'CreateTaskUseCase' } } },
  { id: 'MO-CV02n', spec: CLEAN_SPEC, site: { filePath: CREATE, detail: { class: 'CreateTaskUseCase' } } },
  { id: 'MO-DF01', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { class: 'Task', targetFile: IMPL, targetName: 'InMemoryTaskRepository' } } },
  { id: 'MO-DF01n', spec: CLEAN_SPEC, site: { filePath: IMPL, detail: { class: 'InMemoryTaskRepository', targetFile: CATEGORY, targetName: 'Category' } } },
  { id: 'MO-X01', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { symbol: 'InMemoryTaskRepository', targetFile: IMPL } } },
  { id: 'MO-X01n', spec: CLEAN_SPEC, site: { filePath: IMPL, detail: { symbol: 'ICategoryRepository', targetFile: ICAT } } },
  {
    id: 'MO-X02',
    spec: CLEAN_SPEC,
    site: { filePath: TASK, detail: { class: 'Task', method: 'isValid', controllerFile: CTRL, controller: 'TaskController', handler: 'createTask', guardFiles: CREATE } },
  },
  { id: 'MO-X02n', spec: CLEAN_SPEC, site: { filePath: CTRL, detail: { controllerFile: CTRL, controller: 'TaskController', handler: 'createTask' } } },
  { id: 'MO-SO02', spec: CLEAN_SPEC, site: { filePath: ITASK, detail: { interface: 'ITaskRepository', limit: '5', classLimit: '10' } } },
  { id: 'MO-SO02n', spec: CLEAN_SPEC, site: { filePath: ICAT, detail: { interface: 'ICategoryRepository', limit: '5', classLimit: '10' } } },
  { id: 'MO-X03', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { class: 'Task', method: 'isValid', guardFile: CREATE } } },
  { id: 'MO-X03n', spec: CLEAN_SPEC, site: { filePath: TASK, detail: { class: 'Task', method: 'isValid', limit: '10' } } },
  { id: 'MO-S03', spec: LAYERED_SPEC, site: { filePath: CTRL, detail: { symbol: 'InMemoryTaskRepository', targetFile: IMPL } } },
  { id: 'MO-S03n', spec: LAYERED_SPEC, site: { filePath: CTRL, detail: { symbol: 'Task', targetFile: TASK } } },
];
