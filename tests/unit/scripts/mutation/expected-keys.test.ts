/**
 * Hand-written key table of the 22 FR-24 acceptance entries (U5a plan Step 31; BR-U5a-20, 14, 04; §2.3 of
 * `business-logic-model.md`). Each entry is applied once at its forced site (BR-U5a-55); `expected.keys` (with
 * `lineRule` and mutant `line`) and the collateral (kind, cause, function, key) must equal the table. Also: every
 * row validates, no edit adds or removes a class or interface (BR-U5a-14 iv), every added import declaration is a
 * named or default import (BR-U5a-10), and `fixtures/correct-reference` is unchanged (BR-U5a-04).
 */
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { validateManifest } from '../../../../scripts/lib/manifest.js';
import type { Manifest, ManifestRow } from '../../../../scripts/lib/manifest.js';
import { CATALOGUE_OPERATORS } from '../../../../scripts/lib/mutation/operators/index.js';
import { CORRECT_DIR, REPO, applyForced, fixtureBase } from './operator-harness.js';
import { FORCED_SITES } from './forced-sites.js';

jest.setTimeout(600_000);

const TASK = 'src/domain/entities/Task.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const ORPHAN = 'src/application/use-cases/OrphanHelper.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const RULES = 'src/domain/rules/taskRules.ts';

/** keys: [functionId, filePath, target, discriminator, lineRule, line]; collateral: [kind, cause, functionId, filePath, target, discriminator, lineRule, line]. */
const TABLE: Readonly<Record<string, { keys: unknown[]; collateral: unknown[] }>> = {
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
    keys: [],
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

interface Applied {
  readonly manifest: Manifest;
  readonly row: ManifestRow;
  readonly copy: string;
}

function digest(dir: string): string {
  const entries: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else entries.push(`${path.relative(dir, p)}\0${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`);
    }
  };
  walk(dir);
  return crypto.createHash('sha256').update(entries.sort().join('\n')).digest('hex');
}

const project = new Project({ skipAddingFilesFromTsConfig: true });
function parse(file: string): SourceFile | undefined {
  if (!fs.existsSync(file)) return undefined;
  return project.createSourceFile(`${file}.${String(Math.random()).slice(2)}.ts`, fs.readFileSync(file, 'utf8'), { overwrite: true });
}
const declCount = (sf: SourceFile | undefined): number =>
  sf === undefined ? 0 : sf.getDescendants().filter((n) => n.getKindName() === 'ClassDeclaration' || n.getKindName() === 'InterfaceDeclaration').length;

let scratch: string;
const applied = new Map<string, Applied>();
let before: string;
beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-expected-keys-'));
  before = digest(CORRECT_DIR);
  for (const e of FORCED_SITES) {
    const r = await applyForced(scratch, CATALOGUE_OPERATORS, e.id, fixtureBase(e.spec), e.site);
    if (r.row === undefined) throw new Error(`${e.id}: no row`);
    applied.set(e.id, { manifest: r.manifest, row: r.row, copy: r.copy });
  }
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe('expected keys of the 22 forced entries (BR-U5a-20)', () => {
  it('the table covers every catalogue entry exactly once', () => {
    expect(Object.keys(TABLE).sort()).toEqual(CATALOGUE_OPERATORS.map((o) => o.id).sort());
    expect(FORCED_SITES.map((f) => f.id).sort()).toEqual(CATALOGUE_OPERATORS.map((o) => o.id).sort());
  });

  it.each(FORCED_SITES.map((f) => f.id))('%s: keys and collateral equal the table; the row validates', (id) => {
    const a = applied.get(id);
    if (a === undefined) throw new Error(`${id} not applied`);
    const keys = a.row.expected.keys.map((k) => [k.functionId, k.filePath, k.target, k.discriminator, k.lineRule, k.line ?? null]);
    const coll = a.row.expected.collateral.map((c) => [c.kind, c.cause, c.functionId, c.key?.filePath ?? null, c.key?.target ?? null, c.key?.discriminator ?? null, c.key?.lineRule ?? null, c.key?.line ?? null]);
    expect({ keys, collateral: coll }).toEqual(TABLE[id]);
    expect(validateManifest(REPO, a.manifest)).toEqual({ valid: true, errors: [] });
    expect(a.row.siteSelection).toBe('forced');
    expect(a.row.typecheck.mutantErrors).toBe(0);
  });
});

describe('edit shape (BR-U5a-14 iv, BR-U5a-10, BR-U5a-04)', () => {
  it('no catalogue edit adds or removes a class or interface', () => {
    for (const [id, a] of applied) {
      for (const f of [...a.row.editedFiles, ...a.row.createdFiles]) {
        expect([id, f, declCount(parse(path.join(a.copy, f)))]).toEqual([id, f, declCount(parse(path.join(CORRECT_DIR, f)))]);
      }
    }
  });

  it('every added import declaration is a named or default import', () => {
    for (const [id, a] of applied) {
      for (const f of [...a.row.editedFiles, ...a.row.createdFiles]) {
        const old = new Set(parse(path.join(CORRECT_DIR, f))?.getImportDeclarations().map((d) => d.getText()) ?? []);
        for (const d of parse(path.join(a.copy, f))?.getImportDeclarations() ?? []) {
          if (old.has(d.getText())) continue;
          expect([id, f, d.getNamespaceImport() === undefined, d.getNamedImports().length > 0 || d.getDefaultImport() !== undefined]).toEqual([id, f, true, true]);
        }
        expect(parse(path.join(a.copy, f))?.getDescendants().some((n) => n.getKindName() === 'ImportEqualsDeclaration')).toBe(false);
      }
    }
  });

  it('fixtures/correct-reference is byte-identical after all 22 applications', () => {
    expect(digest(CORRECT_DIR)).toBe(before);
    expect(execFileSync('git', ['status', '--porcelain', '--', 'fixtures'], { cwd: REPO, encoding: 'utf8' })).toBe('');
  });
});

