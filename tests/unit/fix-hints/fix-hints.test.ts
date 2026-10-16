/**
 * Deterministic fix hints (Docs/v1.3/fix-hints.md): one template per rule family, spec-only and with graph facts, only
 * for blocking rules; the report entry and the human section.
 */
import * as path from 'node:path';
import { buildFixHint, buildReportFixHints, formatFixHintsHuman, graphFactsFromApg } from '../../../src/fix-hints/index.js';
import { globFolder, nameOfFile, portNameFor, stemOf } from '../../../src/fix-hints/spec-model.js';
import { FIX_HINT_TEMPLATES } from '../../../src/fix-hints/catalogue.js';
import { familyOf } from '../../../src/fix-hints/templates.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import { REPO, loadSpec } from '../mcp-server/helpers.js';

const REF = path.join(REPO, 'tests/fixtures/v1.3-reference');
let clean: ParsedSpec;
let layered: ParsedSpec;
let hex: ParsedSpec;
let nest: ParsedSpec;
let ddd: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(path.join(REF, 'clean-architecture/spec.yaml'));
  layered = await loadSpec(path.join(REF, 'layered/spec.yaml'));
  hex = await loadSpec(path.join(REF, 'hexagonal/spec.yaml'));
  nest = await loadSpec(path.join(REF, 'nestjs/spec.yaml'));
  ddd = await loadSpec(path.join(REPO, 'presets/ddd.yaml'));
});

describe('naming helpers', () => {
  it('derives port, stem and file names deterministically', () => {
    expect(portNameFor('SystemClock')).toBe('Clock');
    expect(portNameFor('InMemoryLoanRepository')).toBe('LoanRepository');
    expect(portNameFor('PaymentAdapter')).toBe('Payment');
    expect(portNameFor('Mailer')).toBe('MailerPort');
    expect(stemOf('ProductRecord')).toBe('Product');
    expect(stemOf('CatalogController')).toBe('Catalog');
    expect(nameOfFile('src/x/in-memory-registration.repository.ts')).toBe('InMemoryRegistrationRepository');
    expect(nameOfFile('src/domain/workshop.ts')).toBe('Workshop');
  });

  it('completes a directory glob from the file the fix starts at', () => {
    expect(globFolder('src/*/domain/**', 'src/ordering/application/PlaceOrder.ts')).toBe('src/ordering/domain/');
    expect(globFolder('src/domain/**', 'anything.ts')).toBe('src/domain/');
    expect(globFolder('src/main.ts', 'src/a/b.ts')).toBe('src/');
  });
});

describe('tiers', () => {
  it('builds hints for blocking rules only', () => {
    // FF-P02 is advisory; FF-S03 is blocking only in layered.
    expect(buildFixHint(clean, { ruleId: 'FF-P02', filePath: 'src/application/use-cases/X.ts' })).toBeUndefined();
    expect(buildFixHint(hex, { ruleId: 'FF-S03', filePath: 'src/adapters/inbound/http/A.ts', target: 'src/adapters/outbound/B.ts' })).toBeUndefined();
    expect(buildFixHint(layered, { ruleId: 'FF-S03', filePath: 'src/presentation/http/C.ts', target: 'src/persistence/G.ts' })).toBeDefined();
  });

  it('has a template text for every family and a family for every blocking template', () => {
    for (const name of ['dependency-direction', 'no-cyclic-deps', 'no-layer-skip', 'no-domain-outward-dep', 'domain-purity', 'domain-state-purity', 'repository-pattern',
      'dependency-direction-graph', 'core-isolation', 'port-adapter-pattern', 'bounded-context-modules', 'context-isolation', 'aggregate-boundary', 'repository-aggregate-root', 'value-object-immutability']) {
      const family = familyOf(name);
      expect(family).toBeDefined();
      expect(FIX_HINT_TEMPLATES[family ?? 'cycle'].length).toBeGreaterThan(20);
    }
  });
});

describe('spec-only hints (what the MCP tools build)', () => {
  it('dependency direction, core source, runtime import: a port in the source layer, next to the source', () => {
    const h = buildFixHint(clean, { ruleId: 'FF-S01', filePath: 'src/domain/services/LoanPolicy.ts', target: 'src/infrastructure/system/SystemClock.ts' });
    expect(h).toMatchObject({
      family: 'dependency-direction',
      basis: 'spec',
      target: { layer: 'domain', folder: 'src/domain/services/', path: 'src/domain/services/Clock.ts' },
      fix: { action: 'introduce-port' },
      breaks: { dependency: 'src/domain/services/LoanPolicy.ts (domain) -> src/infrastructure/system/SystemClock.ts (infrastructure)' },
    });
    expect(h?.breaks.rule).toContain('domain may import only itself');
    expect(h?.problem).toBe('LoanPolicy.ts in domain imports SystemClock.ts in infrastructure, which domain may not depend on.');
    expect(h?.edit).toEqual([
      { op: 'remove-import', from: 'src/domain/services/LoanPolicy.ts', to: 'src/infrastructure/system/SystemClock.ts' },
      { op: 'add-file', path: 'src/domain/services/Clock.ts', layer: 'domain', declares: { kind: 'Interface', name: 'Clock' } },
      { op: 'add-import', from: 'src/domain/services/LoanPolicy.ts', to: 'src/domain/services/Clock.ts', typeOnly: true },
      { op: 'add-import', from: 'src/infrastructure/system/SystemClock.ts', to: 'src/domain/services/Clock.ts', typeOnly: true },
    ]);
  });

  it('dependency direction, type-only import: the type moves into the source layer', () => {
    const h = buildFixHint(clean, { ruleId: 'FF-S04', filePath: 'src/domain/entities/Loan.ts', target: 'src/application/ports/Clock.ts', isTypeOnly: true });
    expect(h).toMatchObject({ family: 'dependency-direction', fix: { action: 'move-declaration' }, target: { layer: 'domain', path: 'src/domain/entities/Clock.ts' } });
    expect(h?.breaks.rule).toContain('the domain layer imports no other layer');
  });

  it('layered: an upward import is lifted into the upper layer, an inward skip is routed through the middle layer', () => {
    const up = buildFixHint(layered, { ruleId: 'FF-S01', filePath: 'src/persistence/ProductGateway.ts', target: 'src/business/model/Money.ts' });
    expect(up).toMatchObject({ fix: { action: 'lift-to-caller' }, target: { layer: 'business' } });
    const skip = buildFixHint(layered, { ruleId: 'FF-S03', filePath: 'src/presentation/http/CatalogController.ts', target: 'src/persistence/ProductGateway.ts' });
    expect(skip).toMatchObject({ family: 'layer-skip', fix: { action: 'route-through' }, target: { layer: 'business', path: 'src/business/ProductService.ts' } });
    expect(skip?.breaks.rule).toContain('closed layering');
  });

  it('cycle: cuts the closing edge with an interface both ends may import', () => {
    const cycle = ['src/domain/entities/Loan.ts', 'src/domain/entities/Member.ts', 'src/domain/entities/Loan.ts'];
    const h = buildFixHint(clean, { ruleId: 'FF-S02', filePath: cycle.join(','), target: cycle[1] ?? '', discriminator: [JSON.stringify(cycle)] });
    expect(h).toMatchObject({ family: 'cycle', fix: { action: 'break-cycle' }, target: { layer: 'domain', path: 'src/domain/entities/LoanContract.ts' } });
    expect(h?.edit[0]).toEqual({ op: 'remove-import', from: 'src/domain/entities/Member.ts', to: 'src/domain/entities/Loan.ts' });
  });

  it('domain purity: own type for a type-only import, an adapter for a runtime import', () => {
    const typeOnly = buildFixHint(clean, { ruleId: 'FF-P01', filePath: 'src/domain/entities/Member.ts', target: 'express', isTypeOnly: true });
    expect(typeOnly).toMatchObject({ fix: { action: 'replace-with-own-type' }, target: { layer: 'domain', path: 'src/domain/entities/MemberInput.ts' } });
    const runtime = buildFixHint(clean, { ruleId: 'FF-P01', filePath: 'src/domain/entities/Book.ts', target: 'typeorm' });
    expect(runtime).toMatchObject({ fix: { action: 'extract-adapter' }, target: { layer: 'infrastructure', path: 'src/infrastructure/BookRecord.ts' } });
    expect(runtime?.edit).toContainEqual({ op: 'add-import', from: 'src/infrastructure/BookRecord.ts', to: 'typeorm', package: true });
    // Layered: persistence may not import business, so the business file uses the adapter instead.
    const lay = buildFixHint(layered, { ruleId: 'FF-P01', filePath: 'src/business/model/Order.ts', target: 'typeorm' });
    expect(lay?.edit).toContainEqual({ op: 'add-import', from: 'src/business/model/Order.ts', to: 'src/persistence/OrderRecord.ts' });
  });

  it('held infrastructure and missing port', () => {
    const p06 = buildFixHint(clean, {
      ruleId: 'FF-P06', filePath: 'src/domain/services/LoanPolicy.ts', target: 'src/infrastructure/system/SystemClock.ts',
      discriminator: ['LoanPolicy', 'SystemClock', 'CONSTRUCTOR_INJECTS', 'clock'],
    });
    expect(p06).toMatchObject({ family: 'held-infrastructure', fix: { action: 'introduce-port' }, target: { layer: 'domain', path: 'src/domain/services/Clock.ts' } });
    expect(p06?.edit).toContainEqual(expect.objectContaining({ op: 'redirect-holding', className: 'LoanPolicy', interfaceName: 'Clock' }));
    const p03 = buildFixHint(clean, { ruleId: 'FF-P03', filePath: 'src/infrastructure/persistence/InMemoryLoanRepository.ts', discriminator: ['InMemoryLoanRepository'] });
    expect(p03).toMatchObject({ family: 'missing-port', fix: { action: 'introduce-port' }, target: { layer: 'domain', path: 'src/domain/LoanRepository.ts' } });
    const hexP03 = buildFixHint(hex, { ruleId: 'FF-P03', filePath: 'src/adapters/outbound/payment/FakePaymentGateway.ts', discriminator: ['FakePaymentGateway'] });
    expect(hexP03?.ruleName).toBe('port-adapter-pattern');
    expect(hexP03?.target.layer).toBe('domain');
  });

  it('nestjs feature modules keep kebab-case names', () => {
    const h = buildFixHint(nest, { ruleId: 'FF-P01', filePath: 'src/domain/workshop.ts', target: 'typeorm' });
    expect(h?.target.path).toBe('src/infrastructure/workshop-record.ts');
  });

  it('ddd: public API, aggregate root, immutability, context membership', () => {
    const ds02 = buildFixHint(ddd, { ruleId: 'FF-DS02', filePath: 'src/billing/application/IssueInvoice.ts', target: 'src/ordering/domain/order/Order.ts' });
    expect(ds02).toMatchObject({ family: 'context-boundary', fix: { action: 'use-public-api' }, target: { path: 'src/ordering/index.ts' } });
    expect(ds02?.fix.text).toContain("export { Order } from './domain/order/Order'");
    expect(ds02?.fix.text).toContain('src/billing/acl/');
    const dt01 = buildFixHint(ddd, { ruleId: 'FF-DT01', filePath: 'src/ordering/application/GetOrderSummary.ts', target: 'src/ordering/domain/order/OrderLine.ts', discriminator: ['Order', 'IMPORTS'] });
    expect(dt01).toMatchObject({ fix: { action: 'reference-root' }, target: { layer: 'domain', path: 'src/ordering/domain/order/Order.ts' } });
    const dt02 = buildFixHint(ddd, { ruleId: 'FF-DT02', filePath: 'src/ordering/domain/order/OrderLineRepository.ts', target: 'src/ordering/domain/order/OrderLine.ts', discriminator: ['Order', 'IMPORTS'] });
    expect(dt02).toMatchObject({ fix: { action: 'remove-repository' }, target: { path: 'src/ordering/domain/order/OrderRepository.ts' } });
    const dt03 = buildFixHint(ddd, {
      ruleId: 'FF-DT03', filePath: 'src/ordering/domain/value-objects/Quantity.ts',
      discriminator: ['Quantity', 'Quantity.value (public mutable field), Quantity.setValue (mutator method)'],
    });
    expect(dt03?.fix.text).toBe('Keep Quantity where it is and make it immutable: make value readonly (or private with a getter); let setValue return a new Quantity instead of assigning a field.');
    const ds01 = buildFixHint(ddd, { ruleId: 'FF-DS01', filePath: 'src/utils/formatCurrency.ts' });
    expect(ds01).toMatchObject({ fix: { action: 'move-file' }, target: { layer: 'domain', path: 'src/shared-kernel/formatCurrency.ts' } });
  });

  it('is deterministic', () => {
    const f = { ruleId: 'FF-S01', filePath: 'src/domain/services/LoanPolicy.ts', target: 'src/infrastructure/system/SystemClock.ts' };
    expect(JSON.stringify(buildFixHint(clean, f))).toBe(JSON.stringify(buildFixHint(clean, f)));
  });
});

// ── With graph facts (what `firewall evaluate --hints` builds) ────────────────────────────────────────────────────

let seq = 0;
function apg(files: Record<string, { classes?: string[]; interfaces?: string[]; functions?: string[] }>, imports: [string, string, string[]?][], impl: [string, string, string][] = []): { nodes: APGNode[]; edges: APGEdge[] } {
  const nodes: APGNode[] = [];
  const edges: APGEdge[] = [];
  const id = (): string => `n${String((seq += 1))}`;
  const fileId = new Map<string, string>();
  const declId = new Map<string, string>();
  for (const [file, d] of Object.entries(files)) {
    const fid = id();
    fileId.set(file, fid);
    nodes.push({ id: fid, type: 'File', filePath: file, name: path.posix.basename(file), decorators: [], properties: {} });
    for (const [type, names] of [['Class', d.classes], ['Interface', d.interfaces], ['Function', d.functions]] as const) {
      for (const n of names ?? []) {
        const nid = id();
        declId.set(`${file}#${n}`, nid);
        nodes.push({ id: nid, type, filePath: file, name: n, decorators: [], properties: {} });
      }
    }
  }
  for (const [from, to, names] of imports) {
    edges.push({ id: id(), type: 'IMPORTS', sourceId: fileId.get(from) ?? '', targetId: fileId.get(to) ?? '', properties: { importedNames: names ?? [], isTypeOnly: false } });
  }
  for (const [file, cls, iface] of impl) {
    const [ifile, iname] = iface.split('#');
    edges.push({ id: id(), type: 'IMPLEMENTS', sourceId: declId.get(`${file}#${cls}`) ?? '', targetId: declId.get(`${ifile ?? ''}#${iname ?? ''}`) ?? '', properties: {} });
  }
  return { nodes, edges };
}

describe('graph hints', () => {
  const policy = 'src/domain/services/LoanPolicy.ts';
  const sys = 'src/infrastructure/system/SystemClock.ts';

  it('moves an interface-only port the target implements into the source layer', () => {
    const g = graphFactsFromApg(apg(
      { [policy]: { classes: ['LoanPolicy'] }, [sys]: { classes: ['SystemClock'] }, 'src/application/ports/Clock.ts': { interfaces: ['Clock'] }, 'src/application/use-cases/Borrow.ts': { classes: ['Borrow'] } },
      [[policy, sys, ['SystemClock']], [sys, 'src/application/ports/Clock.ts', ['Clock']], ['src/application/use-cases/Borrow.ts', 'src/application/ports/Clock.ts', ['Clock']]],
      [[sys, 'SystemClock', 'src/application/ports/Clock.ts#Clock']],
    ));
    const h = buildFixHint(clean, { ruleId: 'FF-S01', filePath: policy, target: sys }, g);
    expect(h).toMatchObject({ basis: 'graph+spec', fix: { action: 'move-file' }, target: { layer: 'domain', path: 'src/domain/services/Clock.ts' } });
    expect(h?.edit[0]).toEqual({ op: 'move-file', from: 'src/application/ports/Clock.ts', to: 'src/domain/services/Clock.ts', layer: 'domain' });
  });

  it('depends on a port the source may already import', () => {
    const uc = 'src/application/use-cases/RegisterBookUseCase.ts';
    const repo = 'src/infrastructure/persistence/InMemoryBookRepository.ts';
    const port = 'src/domain/repositories/BookRepository.ts';
    const g = graphFactsFromApg(apg({ [uc]: { classes: ['RegisterBookUseCase'] }, [repo]: { classes: ['InMemoryBookRepository'] }, [port]: { interfaces: ['BookRepository'] } },
      [[uc, repo, ['InMemoryBookRepository']], [repo, port, ['BookRepository']]], [[repo, 'InMemoryBookRepository', `${port}#BookRepository`]]));
    expect(buildFixHint(clean, { ruleId: 'FF-S01', filePath: uc, target: repo }, g)).toMatchObject({ fix: { action: 'use-existing-port' }, target: { path: port } });
  });

  it('moves a constant the core imports instead of inventing a port for it', () => {
    const calc = 'src/domain/services/PriceCalculator.ts';
    const fake = 'src/adapters/outbound/payment/FakePaymentGateway.ts';
    const g = graphFactsFromApg(apg({ [calc]: { classes: ['PriceCalculator'] }, [fake]: { classes: ['FakePaymentGateway'] } }, [[calc, fake, ['PAYMENT_FEE_CENTS']]]));
    expect(buildFixHint(hex, { ruleId: 'FF-S01', filePath: calc, target: fake }, g)).toMatchObject({
      fix: { action: 'move-declaration' }, target: { layer: 'domain', path: 'src/domain/services/paymentFeeCents.ts' },
    });
  });

  it('lifts into the existing caller; routes a skip through the existing wrapper', () => {
    const svc = 'src/business/services/OrderService.ts';
    const view = 'src/presentation/views/OrderView.ts';
    const ctrl = 'src/presentation/http/OrderController.ts';
    const g = graphFactsFromApg(apg({ [svc]: { classes: ['OrderService'] }, [view]: { functions: ['renderOrder'] }, [ctrl]: { classes: ['OrderController'] } }, [[svc, view, ['renderOrder']], [ctrl, svc, ['OrderService']]]));
    expect(buildFixHint(layered, { ruleId: 'FF-S01', filePath: svc, target: view }, g)).toMatchObject({ fix: { action: 'lift-to-caller' }, target: { path: ctrl } });

    const cc = 'src/presentation/http/CatalogController.ts';
    const gw = 'src/persistence/ProductGateway.ts';
    const cat = 'src/business/services/CatalogService.ts';
    const fac = 'src/business/ServiceFactory.ts';
    const g2 = graphFactsFromApg(apg({ [cc]: {}, [gw]: { classes: ['ProductGateway'] }, [cat]: {}, [fac]: {} }, [[cc, gw], [cat, gw], [fac, gw]]));
    expect(buildFixHint(layered, { ruleId: 'FF-S03', filePath: cc, target: gw }, g2)).toMatchObject({ fix: { action: 'route-through' }, target: { path: cat } });
  });
});

describe('report hints', () => {
  const violation = (o: Partial<Violation> & { functionId: string }): Violation => ({
    id: `v-${o.functionId}`, type: 'LAYER_VIOLATION', dimension: 'structural', severity: 'critical', route: 'symbolic', message: 'm', deterministic: true, filePath: '', ...o, functionId: functionId(o.functionId),
  });

  it('keeps blocking violations only, in violation order, with the violation id; paths made project-relative', () => {
    const hints = buildReportFixHints(
      [
        violation({ functionId: 'FF-CV05', filePath: 'src/domain/x.ts' }),
        violation({ functionId: 'FF-S01', filePath: '/proj/src/domain/services/LoanPolicy.ts', target: '/proj/src/infrastructure/system/SystemClock.ts', discriminator: ['IMPORTS'] }),
      ],
      clean,
      '/proj',
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ violationId: 'v-FF-S01', filePath: 'src/domain/services/LoanPolicy.ts', targetPath: 'src/infrastructure/system/SystemClock.ts', ruleId: 'FF-S01' });
    const text = formatFixHintsHuman(hints);
    expect(text.split('\n').slice(0, 8)).toEqual([
      '  Fix hints (1 blocking finding):',
      '',
      '  [FF-S01 dependency-direction] src/domain/services/LoanPolicy.ts -> src/infrastructure/system/SystemClock.ts',
      '    Problem: LoanPolicy.ts in domain imports SystemClock.ts in infrastructure, which domain may not depend on.',
      '    Breaks:  src/domain/services/LoanPolicy.ts (domain) -> src/infrastructure/system/SystemClock.ts (infrastructure)',
      '             rule: domain may import only itself (the layer order (inner to outer: domain < application < infrastructure))',
      '    Target:  domain (src/domain/services/)',
      '    Fix:     Introduce a port interface Clock in src/domain/services/Clock.ts (domain) for what LoanPolicy.ts uses from SystemClock.ts; make LoanPolicy.ts depend on Clock, let SystemClock.ts implement it, and wire the implementation in the composition root.',
    ]);
  });
});
