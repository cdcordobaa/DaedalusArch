/**
 * Hand-written key table of the 22 FR-24 acceptance entries at their forced sites (`business-logic-model.md`
 * §2.3–§2.4; BR-U5a-14, 20). Shared by `expected-keys.test.ts` (one manifest per entry) and
 * `fr24-acceptance.test.ts` (all 22 through `scripts/mutate.ts` into one manifest).
 */
const TASK = 'src/domain/entities/Task.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const ORPHAN = 'src/application/use-cases/OrphanHelper.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const RULES = 'src/domain/rules/taskRules.ts';

/** keys: [functionId, filePath, target, discriminator, lineRule, line]; collateral: [kind, cause, functionId, filePath, target, discriminator, lineRule, line]. */
export const KEY_TABLE: Readonly<Record<string, { keys: unknown[]; collateral: unknown[] }>> = {
  'MO-S01': {
    keys: [['FF-S01', TASK, IMPL, ['IMPORTS'], 'site-line', 1], ['FF-S04', TASK, IMPL, ['IMPORTS'], 'site-line', 1]],
    collateral: [['site', 'cycle', 'FF-S02', [TASK, IMPL, TASK].join(','), IMPL, [JSON.stringify([TASK, IMPL, TASK])], 'first-edge-line', 1], ['site', 'cycle', 'FF-S02', [TASK, IMPL, ITASK, TASK].join(','), IMPL, [JSON.stringify([TASK, IMPL, ITASK, TASK])], 'first-edge-line', 1]],
  },
  'MO-S01n': {
    keys: [],
    collateral: [],
  },
  'MO-P01': {
    keys: [['FF-P01', TASK, 'express', ['IMPORTS'], 'site-line', 1]],
    collateral: [],
  },
  'MO-P01n': {
    keys: [],
    collateral: [],
  },
  'MO-C04': {
    keys: [['FF-C04', ORPHAN, '', [], 'none', null]],
    collateral: [['site', 'created-without-test', 'FF-CV05', ORPHAN, '', [], 'none', null]],
  },
  'MO-C04n': {
    keys: [],
    collateral: [['site', 'created-without-test', 'FF-CV05', ORPHAN, '', [], 'none', null]],
  },
  'MO-SO01': {
    keys: [['FF-SO01', TASK, '', ['Task'], 'site-line', 2]],
    collateral: [],
  },
  'MO-SO01n': {
    keys: [],
    collateral: [],
  },
  'MO-CV02': {
    keys: [['FF-CV02', CREATE, '', ['CreateTaskUseCaseDefault'], 'site-line', 10]],
    collateral: [['operator', 'declared', 'FF-CV01', CREATE, '', ['CreateTaskUseCaseDefault'], 'site-line', 10]],
  },
  'MO-CV02n': {
    keys: [],
    collateral: [['operator', 'declared', 'FF-CV01', CREATE, '', ['CoreCreateTaskUseCase'], 'site-line', 10]],
  },
  'MO-DF01': {
    keys: [['FF-P06', TASK, IMPL, ['Task', 'InMemoryTaskRepository', 'FLOWS_TO', 'repo'], 'site-line', 5]],
    collateral: [['operator', 'declared', 'FF-S01', TASK, IMPL, ['IMPORTS'], 'site-line', 1], ['operator', 'declared', 'FF-S04', TASK, IMPL, ['IMPORTS'], 'site-line', 1], ['site', 'cycle', 'FF-S02', [TASK, IMPL, TASK].join(','), IMPL, [JSON.stringify([TASK, IMPL, TASK])], 'first-edge-line', 1], ['site', 'cycle', 'FF-S02', [TASK, IMPL, ITASK, TASK].join(','), IMPL, [JSON.stringify([TASK, IMPL, ITASK, TASK])], 'first-edge-line', 1]],
  },
  'MO-DF01n': {
    keys: [],
    collateral: [],
  },
  'MO-X01': {
    keys: [['FF-S01', TASK, IMPL, ['IMPORTS'], 'site-line', 21], ['FF-S04', TASK, IMPL, ['IMPORTS'], 'site-line', 21]],
    collateral: [],
  },
  'MO-X01n': {
    keys: [],
    collateral: [],
  },
  'MO-X02': {
    keys: [],
    collateral: [],
  },
  'MO-X02n': {
    keys: [],
    collateral: [],
  },
  'MO-SO02': {
    keys: [['FF-SO02', ITASK, '', ['ITaskRepository'], 'site-line', 3]],
    collateral: [],
  },
  'MO-SO02n': {
    keys: [],
    collateral: [],
  },
  'MO-X03': {
    keys: [],
    collateral: [['site', 'created-without-test', 'FF-CV05', RULES, '', [], 'none', null]],
  },
  'MO-X03n': {
    keys: [],
    collateral: [],
  },
  'MO-S03': {
    keys: [['FF-S03', CTRL, IMPL, ['IMPORTS'], 'site-line', 3]],
    collateral: [],
  },
  'MO-S03n': {
    keys: [],
    collateral: [],
  },
};
