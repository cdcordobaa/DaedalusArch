/**
 * v1.3 DRAFT anti-pattern operators AP-* and their twins (`Docs/operator-catalogue-antipatterns.md`). Each operator
 * and twin is applied through the mutation pipeline (`applyMutation`) on `fixtures/unit/antipattern-nest`, a
 * NestJS/TypeORM fixture with vendored typings; a row is appended only when the mutant type-checks with 0 errors
 * under the repository's tsc (BR-U5a-07), so every row below is a compiling mutant.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateManifest } from '../../../../scripts/lib/manifest.js';
import { parseCatalogue } from '../../../../scripts/lib/mutation/catalogue-parser.js';
import { openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import {
  ANTIPATTERN_CATALOGUE_PATH,
  ANTIPATTERN_OPERATORS,
  buildAntipatternRegistry,
  isAntipatternId,
  loadAntipatternRegistry,
} from '../../../../scripts/lib/mutation/antipatterns/index.js';
import { AP_DUP_RULE, AP_DUP_RULEN } from '../../../../scripts/lib/mutation/antipatterns/ap-dup-rule.js';
import { AP_DUP_RULE2, AP_DUP_RULE2N } from '../../../../scripts/lib/mutation/antipatterns/ap-dup-rule-v2.js';
import { loadCompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { AP_FAT_CONTROLLER, AP_FAT_CONTROLLERN } from '../../../../scripts/lib/mutation/antipatterns/ap-fat-controller.js';
import { AP_FRAMEWORK_LEAK, AP_FRAMEWORK_LEAKN } from '../../../../scripts/lib/mutation/antipatterns/ap-framework-leak.js';
import { AP_PERSIST_IN_DOMAIN, AP_PERSIST_IN_DOMAINN } from '../../../../scripts/lib/mutation/antipatterns/ap-persist-in-domain.js';
import { AP_REPO_BYPASS, AP_REPO_BYPASSN } from '../../../../scripts/lib/mutation/antipatterns/ap-repo-bypass.js';
import { decodeImports, encodeImports, paramRules, substituteText } from '../../../../scripts/lib/mutation/antipatterns/common.js';
import { CATALOGUE_OPERATORS } from '../../../../scripts/lib/mutation/operators/index.js';
import { defaultMutateDeps } from '../../../../scripts/lib/mutation/mutate-main.js';
import { catalogueVersionOf } from '../../../../scripts/lib/mutation/registry.js';
import { SITE_KINDS } from '../../../../scripts/lib/mutation/types.js';
import { countBase } from '../../../../scripts/antipattern-sites.js';
import { CLEAN_SPEC, CORRECT_DIR, REPO, applyForced, fixtureBase, tryApply } from './operator-harness.js';

jest.setTimeout(300_000);

const DIR = path.join(REPO, 'fixtures/unit/antipattern-nest');
const SPEC = 'fixtures/unit/antipattern-nest/firewall.spec.yaml';
const SERVICE = 'src/order/order.service.ts';
const INVOICE = 'src/invoice/invoice.service.ts';
const CTRL = 'src/order/order.controller.ts';
const ORDER = 'src/order/domain/order.ts';
const ALL = ANTIPATTERN_OPERATORS;
const base = (): ReturnType<typeof fixtureBase> => fixtureBase(SPEC, DIR);

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ops-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

const read = (copy: string, rel: string): string => fs.readFileSync(path.join(copy, rel), 'utf8');
const judgeOnly = (dimension: 'semantic' | 'integrity') => ({
  functionIds: [],
  disabledFunctionIds: [],
  absentTemplates: [],
  dimension,
  keys: [],
  collateral: [],
  coverage: 'outside',
  judgeProbe: dimension,
});

describe('AP-REPO-BYPASS (Integrity)', () => {
  const site = { filePath: SERVICE, detail: { class: 'OrderService', method: 'create', field: 'orderRepository', orm: 'typeorm', entity: 'OrderEntity', doc: '' } };

  it('the method fetches the global TypeORM repository instead of the injected one; compiles', async () => {
    const { row, copy, manifest } = await applyForced(scratch, ALL, 'AP-REPO-BYPASS', base(), site);
    expect(row?.expected).toEqual(judgeOnly('integrity'));
    expect(validateManifest(REPO, manifest).valid).toBe(true);
    const text = read(copy, SERVICE);
    expect(text).toContain("import { Repository, getRepository } from 'typeorm';");
    expect(text).toContain('const orderRepository = getRepository(OrderEntity);');
    expect(text).toContain('const order = orderRepository.create(');
    expect(text).toContain('return orderRepository.save(order);');
    // Only the seeded method changes: findOne still uses the injection.
    expect(text).toContain('await this.orderRepository.findOne(');
    expect(row?.editedFiles).toEqual([SERVICE]);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-REPO-BYPASSn: the same local bound to the injected field; negative; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-REPO-BYPASSn', base(), site);
    expect(row?.expected).toEqual({ negative: true, twinOf: 'AP-REPO-BYPASS', functionIds: [], keys: [], collateral: [], coverage: 'outside' });
    const text = read(copy, SERVICE);
    expect(text).toContain('const orderRepository = this.orderRepository;');
    expect(text).not.toContain('getRepository');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });
});

describe('AP-FAT-CONTROLLER (Semantic)', () => {
  const site = {
    filePath: CTRL,
    detail: {
      controller: 'OrderController',
      handler: 'create',
      call: '0',
      serviceFile: SERVICE,
      serviceClass: 'OrderService',
      method: 'create',
      guard: '0',
      imports: 'pkg @nestjs/common BadRequestException new',
    },
  };

  it('the quantity rule leaves OrderService.create and guards the handler on request data; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-FAT-CONTROLLER', base(), site);
    expect(row?.expected).toEqual(judgeOnly('semantic'));
    const ctrl = read(copy, CTRL);
    expect(ctrl).toContain("import { Body, Controller, Get, Param, Post, BadRequestException } from '@nestjs/common';");
    expect(ctrl).toMatch(/if \(dto\.quantity <= 0\) \{\s+throw new BadRequestException\('Quantity must be positive'\);\s+\}\s+return this\.orderService\.create\(/);
    const service = read(copy, SERVICE);
    expect(service).not.toContain('Quantity must be positive');
    expect(service).toContain('throw new NotFoundException');
    expect(row?.editedFiles).toEqual([SERVICE, CTRL].sort());
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-FAT-CONTROLLERn: request mapping to a local, no rule moved; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-FAT-CONTROLLERn', base(), {
      filePath: CTRL,
      detail: { controller: 'OrderController', handler: 'create', call: '0', arg: '0' },
    });
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'AP-FAT-CONTROLLER' });
    const ctrl = read(copy, CTRL);
    expect(ctrl).toContain('const customerId = dto.customerId;');
    expect(ctrl).toContain('return this.orderService.create(customerId, dto.quantity, dto.unitPrice);');
    expect(read(copy, SERVICE)).toContain('Quantity must be positive');
    expect(row?.editedFiles).toEqual([CTRL]);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });
});

describe('AP-PERSIST-IN-DOMAIN (Semantic; FF-P01 overlap)', () => {
  const site = { filePath: ORDER, detail: { class: 'Order', property: 'status', package: 'typeorm' } };

  it('the plain domain model becomes a TypeORM entity; the FF-P01 key is the expected (symbolic) key; compiles', async () => {
    const { row, copy, manifest } = await applyForced(scratch, ALL, 'AP-PERSIST-IN-DOMAIN', base(), site);
    expect(validateManifest(REPO, manifest).valid).toBe(true);
    expect(row?.expected).toMatchObject({ functionIds: [], dimension: 'semantic', judgeProbe: 'semantic', coverage: 'outside' });
    expect(row?.expected.keys).toEqual([
      { functionId: 'FF-P01', filePath: ORDER, target: 'typeorm', discriminator: ['IMPORTS'], lineRule: 'site-line', line: 1 },
    ]);
    const text = read(copy, ORDER);
    expect(text.split('\n')[0]).toBe("import { Entity, Column } from 'typeorm';");
    expect(text).toMatch(/@Entity\(\)\s*\nexport class Order \{/);
    expect(text).toMatch(/@Column\(\)\s*\n\s*status: OrderStatus = 'open';/);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-PERSIST-IN-DOMAINn: a plain domain query; negative; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-PERSIST-IN-DOMAINn', base(), site);
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'AP-PERSIST-IN-DOMAIN', keys: [] });
    const text = read(copy, ORDER);
    expect(text).toContain('hasStatus(): boolean {');
    expect(text).toContain('return this.status !== undefined;');
    expect(text).not.toContain('typeorm');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('a class whose file already imports an ORM package is not eligible (already-imported)', async () => {
    const { result } = await tryApply(scratch, [AP_PERSIST_IN_DOMAIN], 'AP-PERSIST-IN-DOMAIN', base(), {
      filePath: 'src/order/order.entity.ts',
      detail: { class: 'OrderEntity', property: 'id', package: 'typeorm' },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.map((e) => [e.code, e.context])).toEqual([['MUT_SITE_OVERRIDE_INVALID', { rejectedByReason: { 'already-imported': 2 } }]]);
  });
});

describe('AP-DUP-RULE (Integrity)', () => {
  const site = {
    filePath: INVOICE,
    detail: {
      class: 'InvoiceService',
      sourceFile: SERVICE,
      sourceClass: 'OrderService',
      method: 'create',
      guard: '0',
      imports: 'pkg @nestjs/common BadRequestException new',
      typeImports: '',
    },
  };

  it('the quantity rule is copied into InvoiceService; the original stays; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-DUP-RULE', base(), site);
    expect(row?.expected).toEqual(judgeOnly('integrity'));
    const invoice = read(copy, INVOICE);
    expect(invoice).toContain("import { Injectable, BadRequestException } from '@nestjs/common';");
    expect(invoice).toMatch(/validateCreate\(quantity: number\): void \{\s+if \(quantity <= 0\) \{\s+throw new BadRequestException\('Quantity must be positive'\);/);
    expect(read(copy, SERVICE)).toContain("throw new BadRequestException('Quantity must be positive');");
    expect(row?.editedFiles).toEqual([INVOICE]);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-DUP-RULEn: one shared helper, called by both services; the rule exists once; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-DUP-RULEn', base(), site);
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'AP-DUP-RULE', keys: [] });
    const service = read(copy, SERVICE);
    const invoice = read(copy, INVOICE);
    expect(service).toContain('assertCreateRule(quantity);');
    expect(service).toContain('export function assertCreateRule(quantity: number): void {');
    expect(invoice).toContain("import { assertCreateRule } from '../order/order.service';");
    expect(invoice).toMatch(/validateCreate\(quantity: number\): void \{\s+assertCreateRule\(quantity\);/);
    expect((service + invoice).match(/Quantity must be positive/g)).toHaveLength(1);
    expect(row?.editedFiles).toEqual([INVOICE, SERVICE].sort());
    expect(row?.typecheck.mutantErrors).toBe(0);
  });
});

describe('AP-DUP-RULE v2 (Integrity; catalogue §8)', () => {
  const v1Detail = { class: 'InvoiceService', sourceFile: SERVICE, sourceClass: 'OrderService', method: 'create', guard: '0', imports: 'pkg @nestjs/common BadRequestException new', typeImports: '' };
  const site = { filePath: INVOICE, detail: { ...v1Detail, twinHost: SERVICE, twinHostKind: 'own', twinHostImports: '', twinEdges: '' } };

  it('AP-DUP-RULE2 is the v1 positive edit, unchanged', async () => {
    const v1 = await applyForced(scratch, ALL, 'AP-DUP-RULE', base(), { filePath: INVOICE, detail: v1Detail });
    const v2 = await applyForced(scratch, ALL, 'AP-DUP-RULE2', base(), site);
    expect(v2.row?.expected).toEqual(judgeOnly('integrity'));
    expect(read(v2.copy, INVOICE)).toBe(read(v1.copy, INVOICE));
    expect(read(v2.copy, SERVICE)).toBe(read(v1.copy, SERVICE));
    expect(v2.row?.editedFiles).toEqual([INVOICE]);
    expect(v2.row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-DUP-RULE2n (own-file host): the rule moves once into a local helper; the second service is untouched; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-DUP-RULE2n', base(), site);
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'AP-DUP-RULE2', keys: [] });
    const service = read(copy, SERVICE);
    expect(service).toContain('assertCreateRule(quantity);');
    expect(service).toMatch(/\nfunction assertCreateRule\(quantity: number\): void \{/);
    expect(service).not.toContain('export function assertCreateRule');
    expect(service.match(/Quantity must be positive/g)).toHaveLength(1);
    expect(read(copy, INVOICE)).toBe(fs.readFileSync(path.join(DIR, INVOICE), 'utf8'));
    expect(row?.editedFiles).toEqual([SERVICE]);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-DUP-RULE2n (domain host): an is<X> guard rule becomes an assertion function next to the guard; narrowing kept; compiles', async () => {
    const dir = fs.mkdtempSync(path.join(scratch, 'v2-domain-'));
    const w = (rel: string, lines: readonly string[]): void => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), `${lines.join('\n')}\n`);
    };
    w('tsconfig.json', [JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', moduleResolution: 'node', noEmit: true, skipLibCheck: true, types: [] }, include: ['src/**/*.ts'] })]);
    w('src/domain/order-status.ts', ['export type OrderStatus = "placed" | "paid";', '', 'export function isOrderStatus(value: unknown): value is OrderStatus {', '  return value === "placed" || value === "paid";', '}']);
    w('src/domain/domain-error.ts', ['export class DomainError extends Error {}']);
    w('src/domain/order-repository.ts', ['import { OrderStatus } from "./order-status";', '', 'export interface OrderRepository {', '  findByStatus(status: OrderStatus): string[];', '}']);
    w('src/application/list-orders-use-case.ts', [
      'import { DomainError } from "../domain/domain-error";',
      'import { OrderRepository } from "../domain/order-repository";',
      'import { isOrderStatus } from "../domain/order-status";',
      '',
      'export class ListOrdersUseCase {',
      '  constructor(private readonly orders: OrderRepository) {}',
      '',
      '  execute(status: unknown): string[] {',
      '    if (!isOrderStatus(status)) {',
      '      throw new DomainError("unknown status");',
      '    }',
      '    return this.orders.findByStatus(status);',
      '  }',
      '}',
    ]);
    w('src/application/get-order-use-case.ts', [
      'import { OrderRepository } from "../domain/order-repository";',
      '',
      'export class GetOrderUseCase {',
      '  constructor(private readonly orders: OrderRepository) {}',
      '',
      '  execute(id: string): string {',
      '    return id;',
      '  }',
      '}',
    ]);
    const compiled = await loadCompiledSpec(REPO, path.join(REPO, CLEAN_SPEC));
    if (!compiled.success) throw new Error('spec');
    const sites = AP_DUP_RULE2N.findSites(openImportGraphProject(dir, 'tsconfig.json'), compiled.data.spec);
    expect(sites.map((s) => [s.filePath, s.detail.twinHost, s.detail.twinHostKind, s.detail.twinEdges])).toEqual([
      ['src/application/get-order-use-case.ts', 'src/domain/order-status.ts', 'domain', 'src/domain/order-status.ts>src/domain/domain-error.ts'],
    ]);
    const s = sites[0];
    if (s === undefined) throw new Error('site');
    const { row, copy } = await applyForced(scratch, ALL, 'AP-DUP-RULE2n', fixtureBase(CLEAN_SPEC, dir), { filePath: s.filePath, detail: s.detail });
    const host = read(copy, 'src/domain/order-status.ts');
    expect(host).toContain('import { DomainError } from "./domain-error";');
    expect(host).toContain('export function assertOrderStatus(status: unknown): asserts status is OrderStatus {');
    const uc = read(copy, 'src/application/list-orders-use-case.ts');
    expect(uc).toContain('import { assertOrderStatus } from "../domain/order-status";');
    expect(uc).toContain('    assertOrderStatus(status);\n    return this.orders.findByStatus(status);');
    expect(uc).not.toContain('DomainError');
    expect(read(copy, 'src/application/get-order-use-case.ts')).toBe(fs.readFileSync(path.join(dir, 'src/application/get-order-use-case.ts'), 'utf8'));
    expect(row?.editedFiles).toEqual(['src/application/list-orders-use-case.ts', 'src/domain/order-status.ts']);
    expect(row?.typecheck.mutantErrors).toBe(0);
  });
});

describe('AP-FRAMEWORK-LEAK (Semantic)', () => {
  const site = { filePath: INVOICE, detail: { class: 'InvoiceService', method: 'issue', framework: 'express' } };

  it('the application service method takes the Express request; callers unchanged; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-FRAMEWORK-LEAK', base(), site);
    expect(row?.expected).toEqual(judgeOnly('semantic'));
    const text = read(copy, INVOICE);
    expect(text).toContain("import { Request } from 'express';");
    expect(text).toContain('async issue(orderId: string, amount: number, request?: Request): Promise<InvoiceEntity> {');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });

  it('AP-FRAMEWORK-LEAKn: a plain DTO parameter instead; negative; compiles', async () => {
    const { row, copy } = await applyForced(scratch, ALL, 'AP-FRAMEWORK-LEAKn', base(), site);
    expect(row?.expected).toMatchObject({ negative: true, twinOf: 'AP-FRAMEWORK-LEAK' });
    const text = read(copy, INVOICE);
    expect(text).toContain('async issue(orderId: string, amount: number, context?: IssueContextDto): Promise<InvoiceEntity> {');
    expect(text).toContain('export interface IssueContextDto {');
    expect(text).not.toContain('express');
    expect(row?.typecheck.mutantErrors).toBe(0);
  });
});

describe('sites and preconditions on the fixtures (label-free)', () => {
  it('antipattern-nest: per-operator candidates and eligible sites', async () => {
    const r = await countBase(REPO, { projectId: 'antipattern-nest', kind: 'fixture', dir: DIR, tsconfigPath: 'tsconfig.json', specPath: SPEC, commit: '0'.repeat(40) }, ALL);
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.map((x) => [x.operatorId, x.candidates, x.eligible])).toEqual([
      ['AP-REPO-BYPASS', 4, 4],
      ['AP-REPO-BYPASSn', 4, 4],
      ['AP-FAT-CONTROLLER', 1, 1],
      ['AP-FAT-CONTROLLERn', 1, 1],
      ['AP-PERSIST-IN-DOMAIN', 3, 1],
      ['AP-PERSIST-IN-DOMAINn', 3, 3],
      ['AP-DUP-RULE', 1, 1],
      ['AP-DUP-RULEn', 1, 1],
      ['AP-FRAMEWORK-LEAK', 4, 4],
      ['AP-FRAMEWORK-LEAKn', 4, 4],
      ['AP-DUP-RULE2', 1, 1],
      ['AP-DUP-RULE2n', 1, 1],
    ]);
    expect(r.data.find((x) => x.operatorId === 'AP-PERSIST-IN-DOMAIN')?.rejectedByReason).toEqual({ 'already-imported': 2 });
  });

  it('correct-reference (no ORM, no injected repository, no parameter rule): only AP-FRAMEWORK-LEAKn places sites', async () => {
    const r = await countBase(REPO, { projectId: 'correct-reference', kind: 'fixture', dir: CORRECT_DIR, tsconfigPath: 'tsconfig.json', specPath: CLEAN_SPEC, commit: '0'.repeat(40) }, ALL);
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.filter((x) => x.eligible > 0).map((x) => x.operatorId)).toEqual(['AP-FRAMEWORK-LEAKn']);
    // No express in the fixture: the framework leak would not compile there.
    expect(r.data.find((x) => x.operatorId === 'AP-FRAMEWORK-LEAK')?.rejectedByReason).toEqual({ 'type-shape': 2 });
  });

  it('the parameter rule of OrderService.create and its import encoding', () => {
    const handle = openImportGraphProject(DIR, 'tsconfig.json');
    const cls = handle.project.getSourceFileOrThrow(path.join(DIR, SERVICE)).getClassOrThrow('OrderService');
    const method = cls.getMethodOrThrow('create');
    const rules = paramRules(method);
    expect(rules.map((r) => [r.index, r.params.map((p) => p.getName()), r.imports.map((i) => [i.module, i.name, i.constructed])])).toEqual([
      [0, ['quantity'], [['@nestjs/common', 'BadRequestException', true]]],
    ]);
    const rule = rules[0];
    if (rule === undefined) throw new Error('rule');
    expect(substituteText(rule.statement, new Map([['quantity', 'dto.quantity']]))).toContain('if (dto.quantity <= 0) {');
    const encoded = encodeImports(rule.imports, (abs) => abs);
    expect(encoded).toBe('pkg @nestjs/common BadRequestException new');
    expect(decodeImports(encoded)).toEqual([{ kind: 'pkg', target: '@nestjs/common', name: 'BadRequestException', constructed: true }]);
    // findOne's rule reads a local (`order`), not a parameter: not a parameter rule.
    expect(paramRules(cls.getMethodOrThrow('findOne'))).toEqual([]);
  });
});

describe('registry and DRAFT catalogue', () => {
  const text = fs.readFileSync(path.join(REPO, ANTIPATTERN_CATALOGUE_PATH), 'utf8');

  it('twelve entries, one to one with the registry on id, twin, dimension, expected templates, coverage, site kinds, source', () => {
    const parsed = parseCatalogue(text);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.data.entries.map((e) => e.id)).toEqual(ALL.map((o) => o.id));
    for (const e of parsed.data.entries) {
      const op = ALL.find((o) => o.id === e.id);
      if (op === undefined) throw new Error(e.id);
      expect([e.twin, e.dimension, e.expectedTemplates, e.coverage, e.source]).toEqual([
        op.twinOf ?? `${op.id}n`,
        op.dimension,
        op.expectedTemplates.map((t) => t.template),
        op.coverage,
        op.source,
      ]);
      for (const k of e.siteKinds) expect(SITE_KINDS).toContain(k);
    }
  });

  it('every entry is a judge probe outside coverage, and every positive has its twin', () => {
    for (const op of ALL) {
      expect([op.coverage, op.judgeProbe !== undefined]).toEqual(['outside', true]);
      if (op.role === 'twin') expect(ALL.some((p) => p.id === op.twinOf && p.role === 'positive')).toBe(true);
    }
    expect(ALL.filter((o) => o.role === 'positive').map((o) => o.id)).toEqual([
      AP_REPO_BYPASS.id,
      AP_FAT_CONTROLLER.id,
      AP_PERSIST_IN_DOMAIN.id,
      AP_DUP_RULE.id,
      AP_FRAMEWORK_LEAK.id,
      AP_DUP_RULE2.id,
    ]);
    expect([AP_REPO_BYPASSN, AP_FAT_CONTROLLERN, AP_PERSIST_IN_DOMAINN, AP_DUP_RULEN, AP_FRAMEWORK_LEAKN, AP_DUP_RULE2N].map((o) => o.role)).toEqual(['twin', 'twin', 'twin', 'twin', 'twin', 'twin']);
  });

  it('the registry carries the DRAFT catalogue sha256, never the frozen one, and shares no id with it', () => {
    const r = loadAntipatternRegistry(REPO);
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.catalogueVersion).toBe(catalogueVersionOf(text));
    expect(r.data.catalogueVersion).not.toBe(catalogueVersionOf(fs.readFileSync(path.join(REPO, 'Docs/operator-catalogue.md'))));
    expect(r.data.isFrozen).toBe(true);
    expect(buildAntipatternRegistry('d'.repeat(64)).list()).toHaveLength(12);
    const frozenIds = new Set(CATALOGUE_OPERATORS.map((o) => o.id));
    expect(ALL.some((o) => frozenIds.has(o.id))).toBe(false);
  });

  it('scripts/mutate.ts routes AP-* ids to the anti-pattern registry', () => {
    expect(isAntipatternId('AP-DUP-RULE')).toBe(true);
    expect(isAntipatternId('MO-X02')).toBe(false);
    const r = defaultMutateDeps().registryFor(REPO, 'AP-DUP-RULE');
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.get('AP-DUP-RULE')).toBe(AP_DUP_RULE);
  });
});
