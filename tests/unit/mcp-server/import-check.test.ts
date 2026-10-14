import * as path from 'node:path';
import { checkImport } from '../../../src/mcp-server/import-check.js';
import { packageRoot } from '../../../src/mcp-server/import-check.js';
import {
  CLEAN_ARCH_SPEC,
  FIXTURES,
  LAYERED_SPEC,
  NO_DOMAIN_SPEC,
  importsOf,
  loadSpec,
} from './helpers.js';

describe('check_import', () => {
  it('flags a domain file importing infrastructure with both structural rules and their reasons', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const result = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: '../../infrastructure/config/InfraConfig',
    });
    expect(result.verdict).toBe('violation');
    expect(result.from.layer).toBe('domain');
    expect(result.to).toMatchObject({
      kind: 'internal',
      path: 'src/infrastructure/config/InfraConfig',
      layer: 'infrastructure',
    });
    expect(result.violations.map((v) => v.ruleId)).toEqual(['FF-S01', 'FF-S04']);
    expect(result.violations[0]).toMatchObject({
      ruleName: 'dependency-direction',
      violationType: 'LAYER_VIOLATION',
      severity: 'critical',
    });
    expect(result.violations[0]?.reason).toMatch(/domain .* may not import infrastructure/);
  });

  it('allows an inward import and an import within one layer', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    expect(
      checkImport(spec, {
        fromFile: 'src/application/use-cases/CreateTaskUseCase.ts',
        module: '../../domain/entities/Task',
      }).verdict,
    ).toBe('allowed');
    expect(
      checkImport(spec, {
        fromFile: 'src/domain/entities/Task.ts',
        module: '../repositories/ITaskRepository',
      }).verdict,
    ).toBe('allowed');
  });

  it('accepts .js and .ts extensions and directory index specifiers', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const from = 'src/domain/entities/Task.ts';
    expect(
      checkImport(spec, { fromFile: from, module: '../../infrastructure/db.js' }).verdict,
    ).toBe('violation');
    expect(checkImport(spec, { fromFile: from, module: '../../infrastructure' }).verdict).toBe(
      'violation',
    );
  });

  it('flags a forbidden package from the domain, with the matching entry, and ignores it elsewhere', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const bad = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: '@nestjs/common/decorators',
    });
    expect(bad.verdict).toBe('violation');
    expect(bad.to).toMatchObject({ kind: 'external-package', package: '@nestjs/common' });
    expect(bad.violations).toHaveLength(1);
    expect(bad.violations[0]).toMatchObject({
      ruleId: 'FF-P01',
      violationType: 'DOMAIN_PURITY_VIOLATION',
    });
    expect(bad.violations[0]?.reason).toContain('"@nestjs/*"');
    expect(
      checkImport(spec, { fromFile: 'src/infrastructure/repositories/R.ts', module: 'typeorm' })
        .verdict,
    ).toBe('allowed');
    expect(
      checkImport(spec, { fromFile: 'src/domain/entities/Task.ts', module: 'lodash' }).verdict,
    ).toBe('allowed');
  });

  it('treats node built-ins as allowed', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const result = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: 'node:crypto',
    });
    expect(result).toMatchObject({ verdict: 'allowed', to: { kind: 'node-builtin' } });
  });

  it('reads a bare specifier as a project path when a layer claims it', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const result = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: 'src/infrastructure/db',
    });
    expect(result.verdict).toBe('violation');
    expect(result.notes).toContain('bare specifier read as a project-relative path');
  });

  it('answers unknown for an alias it cannot resolve, and resolves it with resolvedPath', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const unknown = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: '@/infrastructure/db',
    });
    expect(unknown.verdict).toBe('unknown');
    expect(unknown.notes.join(' ')).toMatch(/resolvedPath/);
    const resolved = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: '@/infrastructure/db',
      resolvedPath: 'src/infrastructure/db.ts',
    });
    expect(resolved.verdict).toBe('violation');
  });

  it('applies no layer rule to files or targets outside every layer', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const fromOutside = checkImport(spec, {
      fromFile: 'scripts/seed.ts',
      module: '../src/infrastructure/db',
    });
    expect(fromOutside.verdict).toBe('allowed');
    expect(fromOutside.from.layer).toBeNull();
    expect(fromOutside.notes.join(' ')).toMatch(/belongs to no layer/);
    const toOutside = checkImport(spec, {
      fromFile: 'src/domain/entities/Task.ts',
      module: '../../shared/util',
    });
    expect(toOutside.verdict).toBe('allowed');
    expect(toOutside.to.layer).toBeNull();
  });

  it('enforces closed layering (no-layer-skip) in the layered style, naming the allowed transitions', async () => {
    const spec = await loadSpec(LAYERED_SPEC);
    const skip = checkImport(spec, {
      fromFile: 'src/infrastructure/controllers/NoteController.ts',
      module: '../repositories/NoteRepository',
    });
    expect(skip.verdict).toBe('violation');
    // presentation to persistence points inward, so dependency-direction is silent; only closed layering objects.
    expect(skip.violations.map((v) => v.ruleId)).toEqual(['FF-S03']);
    expect(skip.violations.find((v) => v.ruleId === 'FF-S03')?.reason).toContain(
      'business>persistence, presentation>business',
    );
    expect(
      checkImport(spec, {
        fromFile: 'src/infrastructure/controllers/NoteController.ts',
        module: '../../application/NoteService',
      }).verdict,
    ).toBe('allowed');
  });

  it('skips the domain rules when the spec has no domain layer', async () => {
    const spec = await loadSpec(NO_DOMAIN_SPEC);
    const result = checkImport(spec, {
      fromFile: 'src/presentation/NoteController.ts',
      module: 'typeorm',
    });
    expect(result.verdict).toBe('allowed');
    expect(result.checkedRules).not.toContain('FF-P01');
  });

  it('lists the rules it checked', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    expect(checkImport(spec, { fromFile: 'src/domain/a.ts', module: './b' }).checkedRules).toEqual([
      'FF-S01',
      'FF-S04',
      'FF-P01',
    ]);
  });

  it("honours a rule's exclude_paths for the importing file", async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const excluded = {
      ...spec,
      fitnessFunctions: spec.fitnessFunctions.map((ff) =>
        ff.name === 'dependency-direction' ? { ...ff, excludePaths: ['src/domain/legacy/**'] } : ff,
      ),
    };
    const legacy = checkImport(excluded, {
      fromFile: 'src/domain/legacy/Old.ts',
      module: '../../infrastructure/db',
    });
    expect(legacy.violations.map((v) => v.ruleId)).toEqual(['FF-S04']);
    const current = checkImport(excluded, {
      fromFile: 'src/domain/entities/Task.ts',
      module: '../../infrastructure/db',
    });
    expect(current.violations.map((v) => v.ruleId)).toEqual(['FF-S01', 'FF-S04']);
  });

  it('derives the package root of scoped and plain specifiers', () => {
    expect(packageRoot('@scope/pkg/deep/file')).toBe('@scope/pkg');
    expect(packageRoot('pkg/deep')).toBe('pkg');
    expect(packageRoot('pkg')).toBe('pkg');
  });
});

describe('check_import on the tests/fixtures projects (parity with the symbolic structural rules)', () => {
  it('finds no violation in any import of correct-reference', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const project = path.join(FIXTURES, 'correct-reference');
    const imports = importsOf(project);
    expect(imports.length).toBeGreaterThan(5);
    const violations = imports
      .map((i) => checkImport(spec, { fromFile: i.file, module: i.specifier }))
      .filter((r) => r.verdict !== 'allowed');
    expect(violations).toEqual([]);
  });

  it('finds the planted layer violations in variant-a-structural', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const project = path.join(FIXTURES, 'variant-a-structural');
    const flagged = importsOf(project)
      .map((i) => ({ i, r: checkImport(spec, { fromFile: i.file, module: i.specifier }) }))
      .filter(({ r }) => r.verdict === 'violation')
      .map(
        ({ i, r }) =>
          `${i.file} -> ${i.specifier} [${r.violations.map((v) => v.ruleId).join(',')}]`,
      );
    expect(flagged).toEqual(
      expect.arrayContaining([
        'src/domain/entities/Task.ts -> ../../infrastructure/config/InfraConfig [FF-S01,FF-S04]',
        'src/application/use-cases/CreateTaskUseCase.ts -> ../../infrastructure/repositories/InMemoryTaskRepository [FF-S01]',
      ]),
    );
  });

  it('finds forbidden packages in the domain of variant-b-pattern', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const project = path.join(FIXTURES, 'variant-b-pattern');
    const purity = importsOf(project)
      .map((i) => checkImport(spec, { fromFile: i.file, module: i.specifier }))
      .filter((r) => r.violations.some((v) => v.ruleId === 'FF-P01'));
    expect(purity.length).toBeGreaterThan(0);
    for (const r of purity) expect(r.from.layer).toBe('domain');
  });
});
