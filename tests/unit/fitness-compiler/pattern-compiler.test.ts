import { compilePattern } from '../../../src/fitness-compiler/pattern-compiler.js';

// business-logic-model.md §4 table (BR-U1-06 a)
describe('compilePattern (FR-07, BR-U1-06)', () => {
  it.each([
    ['*Service', '^(?:[^/]*Service)$'],
    ['*Service|*UseCase', '^(?:[^/]*Service|[^/]*UseCase)$'],
    ['*Repository|*Repo', '^(?:[^/]*Repository|[^/]*Repo)$'],
    ['*Repository|*Repo|*Store', '^(?:[^/]*Repository|[^/]*Repo|[^/]*Store)$'],
    ['*Controller', '^(?:[^/]*Controller)$'],
    ['*Controller|*Handler', '^(?:[^/]*Controller|[^/]*Handler)$'],
    ['Legacy$*', '^(?:Legacy\\$[^/]*)$'],
  ])('%s -> %s', (pattern, regex) => {
    expect(compilePattern(pattern)).toBe(regex);
  });

  it.each([
    ['^(?:[^/]*Service)$', 'TaskService', true],
    ['^(?:[^/]*Service)$', 'CreateTaskUseCase', false],
    ['^(?:[^/]*Service|[^/]*UseCase)$', 'CreateTaskUseCase', true],
    ['^(?:[^/]*Repository|[^/]*Repo)$', 'InMemoryTaskRepository', true],
    ['^(?:[^/]*Repository|[^/]*Repo|[^/]*Store)$', 'FileSystemSnapshotStore', true],
    ['^(?:[^/]*Controller)$', 'TaskController', true],
    ['^(?:[^/]*Controller|[^/]*Handler)$', 'TaskHandler', true],
    ['^(?:Legacy\\$[^/]*)$', 'Legacy$Task', true],
    ['^(?:Legacy\\$[^/]*)$', 'LegacyTask', false],
  ])('%s on %s -> %s (table example column)', (regex, name, expected) => {
    expect(new RegExp(regex).test(name)).toBe(expected);
  });

  it('expands ? to a single character', () => {
    expect(compilePattern('Task?')).toBe('^(?:Task.)$');
  });
});
