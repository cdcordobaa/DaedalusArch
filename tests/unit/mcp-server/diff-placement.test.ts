import { checkDiff, parseUnifiedDiff } from '../../../src/mcp-server/diff-check.js';
import { baseNameOf, roleOf, suggestPlacement } from '../../../src/mcp-server/placement.js';
import { resolveLayer } from '../../../src/mcp-server/layer-resolver.js';
import { checkSource } from '../../../src/mcp-server/file-check.js';
import { CLEAN_ARCH_SPEC, LAYERED_SPEC, NO_DOMAIN_SPEC, loadSpec } from './helpers.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

let clean: ParsedSpec;
let layered: ParsedSpec;
let noDomain: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(CLEAN_ARCH_SPEC);
  layered = await loadSpec(LAYERED_SPEC);
  noDomain = await loadSpec(NO_DOMAIN_SPEC);
});

const DIFF = [
  'diff --git a/src/domain/entities/Order.ts b/src/domain/entities/Order.ts',
  'index 1111111..2222222 100644',
  '--- a/src/domain/entities/Order.ts',
  '+++ b/src/domain/entities/Order.ts',
  '@@ -1,4 +1,5 @@',
  " import { Money } from '../value-objects/Money';",
  "+import { Column } from 'typeorm';",
  '---- a removed line that looks like a header',
  ' export class Order {',
  '+  @Column() total!: Money;',
  ' }',
  'diff --git a/src/application/OrderServiceImpl.ts b/src/application/OrderServiceImpl.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/src/application/OrderServiceImpl.ts',
  '@@ -0,0 +1,3 @@',
  "+import { SqlOrderRepository } from '../infrastructure/repositories/SqlOrderRepository';",
  '+',
  '+export class OrderServiceImpl {}',
  'diff --git a/README.md b/README.md',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/src/old.ts b/src/old.ts',
  'deleted file mode 100644',
  '--- a/src/old.ts',
  '+++ /dev/null',
  '@@ -1 +0,0 @@',
  '-gone',
].join('\n');

describe('parseUnifiedDiff', () => {
  it('reads paths and the new-file line of each added line, not fooled by removed "---" lines', () => {
    const files = parseUnifiedDiff(DIFF);
    expect(files.map((f) => [f.oldPath, f.newPath])).toEqual([
      ['src/domain/entities/Order.ts', 'src/domain/entities/Order.ts'],
      [null, 'src/application/OrderServiceImpl.ts'],
      ['README.md', 'README.md'],
      ['src/old.ts', null],
    ]);
    expect(files[0]?.added.map((a) => a.line)).toEqual([2, 4]);
    expect(files[1]?.added.map((a) => a.line)).toEqual([1, 2, 3]);
  });

  it('handles plain diff -u output without git headers', () => {
    const files = parseUnifiedDiff(
      "--- a/x.ts\t2026-01-01\n+++ b/x.ts\t2026-01-02\n@@ -1 +1,2 @@\n a\n+import 'b';\n",
    );
    expect(files).toEqual([
      { oldPath: 'x.ts', newPath: 'x.ts', added: [{ line: 2, text: "import 'b';" }] },
    ]);
  });
});

describe('check_diff (checkDiff)', () => {
  it('checks added lines with new-file line numbers and skips deleted and non-source files', () => {
    const res = checkDiff(clean, DIFF);
    expect(res.verdict).toBe('violations');
    expect(res.files.map((f) => [f.path, f.change, f.verdict])).toEqual([
      ['src/domain/entities/Order.ts', 'modified', 'violations'],
      ['src/application/OrderServiceImpl.ts', 'added', 'violations'],
    ]);
    expect(res.files[0]?.violations.map((v) => [v.rule, v.line])).toEqual([['FF-P01', 2]]);
    expect(res.files[0]?.notes).toContain('only added lines were checked');
    expect(res.files[1]?.violations.map((v) => [v.rule, v.line])).toEqual([
      ['FF-S01', 1],
      ['FF-CV02', 3],
    ]);
    expect(res.skipped).toEqual([
      { path: 'README.md', reason: 'not a TypeScript/JavaScript source file' },
      { path: 'src/old.ts', reason: 'deleted' },
    ]);
    expect(res.summary).toBe(
      '3 violation(s) in src/domain/entities/Order.ts, src/application/OrderServiceImpl.ts; apply each fix.',
    );
  });

  it('notes a rename across layers', () => {
    const res = checkDiff(
      clean,
      [
        'diff --git a/src/application/Price.ts b/src/domain/Price.ts',
        'similarity index 90%',
        'rename from src/application/Price.ts',
        'rename to src/domain/Price.ts',
        '--- a/src/application/Price.ts',
        '+++ b/src/domain/Price.ts',
        '@@ -1 +1,2 @@',
        ' export class Price {}',
        '+export const x = 1;',
      ].join('\n'),
    );
    expect(res.verdict).toBe('clean');
    expect(res.files[0]?.change).toBe('renamed');
    expect(res.files[0]?.notes.join(' ')).toMatch(/moved from application to domain/);
  });

  it('is clean on a clean diff', () => {
    const res = checkDiff(
      clean,
      '--- /dev/null\n+++ b/src/domain/entities/Invoice.ts\n@@ -0,0 +1 @@\n+export class Invoice {}\n',
    );
    expect(res).toMatchObject({ verdict: 'clean', summary: '1 source file(s) checked: clean.' });
  });
});

describe('suggest_placement (suggestPlacement)', () => {
  it('maps purposes to roles and base names', () => {
    expect(roleOf('repository for orders')?.role).toBe('repository');
    expect(roleOf('use case to cancel an order')?.role).toBe('use-case');
    expect(roleOf('REST controller for invoices')?.role).toBe('controller');
    expect(roleOf('value object for money')?.role).toBe('value-object');
    expect(roleOf('something vague')).toBeUndefined();
    expect(baseNameOf('repository for orders', roleOf('repository for orders'))).toBe('Order');
    expect(baseNameOf('use case to cancel an order', roleOf('use case to cancel an order'))).toBe(
      'CancelOrder',
    );
  });

  it('splits a repository into a domain interface and an infrastructure implementation', () => {
    const res = suggestPlacement(clean, { purpose: 'repository for orders' });
    expect(res.placements.map((p) => [p.role, p.layer, p.path, p.className])).toEqual([
      [
        'repository-interface',
        'domain',
        'src/domain/repositories/IOrderRepository.ts',
        'IOrderRepository',
      ],
      [
        'repository-impl',
        'infrastructure',
        'src/infrastructure/repositories/SqlOrderRepository.ts',
        'SqlOrderRepository',
      ],
    ]);
    expect(res.placements[0]?.forbiddenPackages).toContain('typeorm');
    expect(res.placements[0]?.mayImport).toEqual([]);
    expect(res.placements[1]?.mayImport).toEqual(['domain', 'application']);
    expect(res.summary).toBe(
      'IOrderRepository -> src/domain/repositories/IOrderRepository.ts (domain); SqlOrderRepository -> src/infrastructure/repositories/SqlOrderRepository.ts (infrastructure)',
    );
  });

  it.each([
    [
      'use case to cancel an order',
      'application',
      'src/application/use-cases/CancelOrderUseCase.ts',
    ],
    [
      'controller for invoices',
      'infrastructure',
      'src/infrastructure/controllers/InvoiceController.ts',
    ],
    ['value object for money', 'domain', 'src/domain/value-objects/Money.ts'],
    ['domain entity for customers', 'domain', 'src/domain/entities/Customer.ts'],
    ['dto for order creation', 'application', 'src/application/dto/OrderCreationDto.ts'],
  ])('%s -> %s', (purpose, layer, path) => {
    const [p] = suggestPlacement(clean, { purpose }).placements;
    expect(p?.layer).toBe(layer);
    expect(p?.path).toBe(path);
  });

  it('every suggested path resolves to its layer and every name passes check_file', () => {
    for (const purpose of [
      'repository for orders',
      'service that sends invoices',
      'use case to ship an order',
    ]) {
      for (const p of suggestPlacement(clean, { purpose }).placements) {
        expect(resolveLayer(clean, p.path)?.layer).toBe(p.layer);
        expect(
          checkSource(clean, { path: p.path, content: `export class ${p.className} {}` }).verdict,
        ).toBe('clean');
      }
    }
  });

  it('uses an explicit name', () => {
    const [p] = suggestPlacement(clean, { purpose: 'use case', name: 'archiveTask' }).placements;
    expect(p?.className).toBe('ArchiveTaskUseCase');
  });

  it('keeps a repository whole when the spec has a layer that owns repositories (layered)', () => {
    const res = suggestPlacement(layered, { purpose: 'repository for orders' });
    expect(res.placements.map((p) => [p.layer, p.path])).toEqual([
      ['persistence', 'src/infrastructure/repositories/OrderRepository.ts'],
    ]);
  });

  it('falls back by layer kind and says when no layer fits', () => {
    const [ctl] = suggestPlacement(noDomain, { purpose: 'controller for tasks' }).placements;
    expect(ctl?.layer).toBe('presentation');
    const entity = suggestPlacement(noDomain, { purpose: 'entity for tasks' });
    expect(entity.placements).toEqual([]);
    expect(entity.notes.join(' ')).toMatch(/no layer of this spec takes role entity/);
  });

  it('defaults to an entity with a note when no role is recognised', () => {
    const res = suggestPlacement(clean, { purpose: 'something for shipments' });
    expect(res.placements[0]?.role).toBe('entity');
    expect(res.notes[0]).toMatch(/no role keyword recognised/);
  });
});
