import * as fs from 'node:fs';
import * as path from 'node:path';
import { blankComments, scanSource } from '../../../src/mcp-server/source-scan.js';
import { checkSource, fileCheckedRules, suggestName } from '../../../src/mcp-server/file-check.js';
import { checkImport } from '../../../src/mcp-server/import-check.js';
import { checkFileCli, positionals } from '../../../src/mcp-server/check-file-cli.js';
import { createSpecLoader } from '../../../src/mcp-server/tools.js';
import { CLEAN_ARCH_SPEC, FIXTURES, LAYERED_SPEC, loadSpec } from './helpers.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

let clean: ParsedSpec;
let layered: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(CLEAN_ARCH_SPEC);
  layered = await loadSpec(LAYERED_SPEC);
});

describe('scanSource', () => {
  it('finds every import form with its line and kind', () => {
    const scan = scanSource(
      [
        "import { A } from './a';",
        "import type { B } from '../b';",
        "export * from './c';",
        "import './side';",
        "import x = require('legacy');",
        "const y = require('cjs');",
        "const z = await import('lazy');",
        'import {',
        '  D,',
        "} from 'multi';",
      ].join('\n'),
    );
    expect(scan.imports.map((i) => [i.specifier, i.line, i.kind])).toEqual([
      ['./a', 1, 'static'],
      ['../b', 2, 'type'],
      ['./c', 3, 'static'],
      ['./side', 4, 'side-effect'],
      ['legacy', 5, 'static'],
      ['cjs', 6, 'require'],
      ['lazy', 7, 'dynamic'],
      ['multi', 8, 'static'],
    ]);
  });

  it('ignores imports inside comments but keeps strings that look like comments', () => {
    const text =
      "// import x from 'gone';\n/* import y from 'gone2' */\nconst u = 'http://example.com';\nimport z from 'kept';";
    expect(blankComments(text).split('\n')).toHaveLength(4);
    expect(blankComments(text)).toContain("'http://example.com'");
    expect(scanSource(text).imports.map((i) => i.specifier)).toEqual(['kept']);
  });

  it('finds classes with their decorators and lines', () => {
    const scan = scanSource(
      "@Controller('orders')\nexport class OrdersCtl {}\n\nexport default abstract class BaseRepo {}\nclass Plain {}",
    );
    expect(scan.classes).toEqual([
      { name: 'OrdersCtl', line: 2, decorators: ['Controller'] },
      { name: 'BaseRepo', line: 4, decorators: [] },
      { name: 'Plain', line: 5, decorators: [] },
    ]);
  });
});

describe('suggestName', () => {
  it('cuts after the role suffix, or moves a leading suffix to the end', () => {
    expect(suggestName('OrderRepositoryImpl', '*Repository|*Repo')).toBe('OrderRepository');
    expect(suggestName('RepoOrders', '*Repository|*Repo')).toBe('OrdersRepo');
    expect(suggestName('ServiceForOrders', '*Service|*UseCase')).toBe('ForOrdersService');
    expect(suggestName('Anything', 'Prefix*')).toBeUndefined();
  });
});

describe('check_file (checkSource) on specs/clean-arch.yaml', () => {
  it('lists the import and naming rules it evaluates', () => {
    // FF-S03 no-layer-skip is not applicable to clean-architecture; FF-CV01/FF-CV04 are disabled in the spec.
    expect(fileCheckedRules(clean)).toEqual(['FF-S01', 'FF-S04', 'FF-P01', 'FF-CV02', 'FF-CV03']);
    expect(fileCheckedRules(layered)).toContain('FF-S03');
  });

  it('flags a domain file that imports infrastructure and a framework, with rule ids, reasons and fixes', () => {
    const res = checkSource(clean, {
      path: 'src/domain/entities/Order.ts',
      content: [
        "import { Entity } from 'typeorm';",
        "import { SqlOrderRepository } from '../../infrastructure/repositories/SqlOrderRepository';",
        'export class Order {}',
      ].join('\n'),
    });
    expect(res.layer).toBe('domain');
    expect(res.verdict).toBe('violations');
    expect(res.violations.map((v) => [v.rule, v.line])).toEqual([
      ['FF-P01', 1],
      ['FF-S01', 2],
      ['FF-S04', 2],
    ]);
    const purity = res.violations[0];
    expect(purity?.subject).toBe('import "typeorm"');
    expect(purity?.fix).toMatch(/Remove the "typeorm" import from domain.*infrastructure/);
    const direction = res.violations[1];
    expect(direction?.reason).toMatch(/domain .* may not import infrastructure/);
    expect(direction?.fix).toMatch(
      /Declare an interface .* in domain, implement it in infrastructure/,
    );
    expect(res.summary).toBe(
      'src/domain/entities/Order.ts (domain): 3 violation(s) of FF-P01, FF-S01, FF-S04; apply each fix.',
    );
  });

  it('passes a clean file', () => {
    const res = checkSource(clean, {
      path: 'src/application/use-cases/CreateOrderUseCase.ts',
      content:
        "import { Order } from '../../domain/entities/Order';\nexport class CreateOrderUseCase {}",
    });
    expect(res).toMatchObject({ verdict: 'clean', violations: [], advisories: [], unresolved: [] });
    expect(res.summary).toBe(
      'src/application/use-cases/CreateOrderUseCase.ts (application): clean.',
    );
  });

  it('flags naming-services and naming-repos with a rename', () => {
    const res = checkSource(clean, {
      path: 'src/application/services/OrderServiceHelper.ts',
      content: 'export class OrderServiceHelper {}\nexport class OrderRepoImpl {}',
    });
    expect(res.violations.map((v) => [v.rule, v.line, v.fix])).toEqual([
      ['FF-CV02', 1, 'Rename OrderServiceHelper to OrderService.'],
      ['FF-CV03', 2, 'Rename OrderRepoImpl to OrderRepo.'],
    ]);
  });

  it('does not apply naming-services outside the application layers (template parity)', () => {
    const res = checkSource(clean, {
      path: 'src/domain/services/PricingServiceImpl.ts',
      content: 'export class PricingServiceImpl {}',
    });
    expect(res.verdict).toBe('clean');
  });

  it('reports require()/import() hits as advisories, not violations', () => {
    const res = checkSource(clean, {
      path: 'src/domain/entities/Order.ts',
      content: "const orm = require('typeorm');",
    });
    expect(res.violations).toEqual([]);
    expect(res.advisories.map((a) => a.rule)).toEqual(['FF-P01']);
    expect(res.verdict).toBe('clean');
  });

  it('returns unknown for an unresolvable alias import', () => {
    const res = checkSource(clean, {
      path: 'src/domain/entities/Order.ts',
      content: "import { x } from '@/infrastructure/x';",
    });
    expect(res.verdict).toBe('unknown');
    expect(res.unresolved).toEqual([{ line: 1, specifier: '@/infrastructure/x' }]);
  });

  it('says so when the file belongs to no layer', () => {
    const res = checkSource(clean, { path: 'scripts/seed.ts', content: "import 'typeorm';" });
    expect(res.layer).toBeNull();
    expect(res.verdict).toBe('clean');
    expect(res.notes[0]).toMatch(/no layer glob matches/);
  });

  it("honours a rule's exclude_paths", () => {
    const excluded: ParsedSpec = {
      ...clean,
      fitnessFunctions: clean.fitnessFunctions.map((ff) =>
        ff.name === 'domain-purity' || ff.name === 'naming-repos'
          ? { ...ff, excludePaths: ['src/domain/legacy/**'] }
          : ff,
      ),
    };
    const content = "import 'typeorm';\nexport class OldRepoImpl {}";
    expect(checkSource(excluded, { path: 'src/domain/legacy/Old.ts', content }).verdict).toBe(
      'clean',
    );
    expect(
      checkSource(excluded, { path: 'src/domain/Old.ts', content }).violations.map((v) => v.rule),
    ).toEqual(['FF-P01', 'FF-CV03']);
  });
});

describe('check_file on the layered fixture spec (closed layering)', () => {
  it('flags a layer skip with a fix that names the adjacent layer', () => {
    const res = checkSource(layered, {
      path: 'src/infrastructure/controllers/TaskController.ts',
      content: "import { Repo } from '../repositories/InMemoryTaskRepository';",
    });
    expect(res.layer).toBe('presentation');
    expect(res.violations.map((v) => v.rule)).toEqual(['FF-S03']);
    expect(res.violations[0]?.fix).toMatch(/^Go through business/);
  });

  it('allows the adjacent inner layer', () => {
    const res = checkSource(layered, {
      path: 'src/infrastructure/controllers/TaskController.ts',
      content: "import { Task } from '../../domain/entities/Task';",
    });
    expect(res.verdict).toBe('clean');
  });
});

describe('check_file agrees with check_import on every import of the fixtures', () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
    });

  it.each([
    'correct-reference',
    'variant-a-structural',
    'variant-b-pattern',
    'variant-c-everything',
  ])('%s', (fixture) => {
    const root = path.join(FIXTURES, fixture);
    for (const file of walk(path.join(root, 'src'))) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      const content = fs.readFileSync(file, 'utf-8');
      const res = checkSource(clean, { path: rel, content });
      const importRules = res.violations.filter((v) => !v.rule.startsWith('FF-CV'));
      const expected = scanSource(content)
        .imports.filter((i) => i.kind !== 'require' && i.kind !== 'dynamic')
        .flatMap((i) => checkImport(clean, { fromFile: rel, module: i.specifier }).violations)
        .map((h) => h.ruleId);
      expect(importRules.map((v) => v.rule).sort()).toEqual(expected.sort());
    }
  });
});

describe('check-file-cli', () => {
  const ctx = {
    defaultSpecPath: CLEAN_ARCH_SPEC,
    env: {},
    evaluateDeps: {} as never,
    loadSpec: createSpecLoader(),
  };

  it('prints the check_file JSON and exits 1 on violations, 0 when clean, 2 on usage', async () => {
    const out: string[] = [];
    const write = (s: string): void => {
      out.push(s);
    };
    const dirty = await checkFileCli(
      ['--spec', CLEAN_ARCH_SPEC, 'src/domain/A.ts', 'x.ts'],
      ctx,
      () => "import 'express';",
      write,
    );
    expect(dirty).toBe(1);
    expect(JSON.parse(out.join('')) as unknown).toMatchObject({ verdict: 'violations' });
    expect(
      await checkFileCli(
        ['src/domain/A.ts'],
        ctx,
        () => 'export class A {}',
        () => undefined,
      ),
    ).toBe(0);
    expect(
      await checkFileCli(
        [],
        ctx,
        () => '',
        () => undefined,
      ),
    ).toBe(2);
    expect(positionals(['--spec', 's.yaml', 'a.ts', '--project', 'p', 'b.ts'])).toEqual([
      'a.ts',
      'b.ts',
    ]);
  });
});
