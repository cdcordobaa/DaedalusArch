/**
 * MCP v2 rule semantics: metadata (tier, construct, literature, edge view, v1.3 status), the fast spec rules over the
 * v1.3 reference specs (allowed-dependency layering, DDD, class-level rules, cycles), style applicability and role
 * tokens, and the advisory hints (APG v2, cheap proxies).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { checkSource } from '../../../src/mcp-server/file-check.js';
import { ProjectView } from '../../../src/mcp-server/project-files.js';
import { CONSTRUCTS, hintMeta, specRuleMeta, STYLE_RULE_SOURCES, v13RuleStates } from '../../../src/mcp-server/rule-meta.js';
import { endsWithRole, FAST_RULE_NAMES } from '../../../src/mcp-server/fast-rules.js';
import { APG2_HINT_NAMES, CHEAP_HINT_NAMES } from '../../../src/mcp-server/fast-hints.js';
import { REPO, loadSpec } from './helpers.js';

const REF = path.join(REPO, 'tests/fixtures/v1.3-reference');
const specs: Record<string, ParsedSpec> = {};

beforeAll(async () => {
  for (const s of ['clean-architecture', 'layered', 'nestjs', 'hexagonal']) specs[s] = await loadSpec(path.join(REF, s, 'spec.yaml'));
  specs.ddd = await loadSpec(path.join(REPO, 'presets/ddd.yaml'));
});

const spec = (s: string): ParsedSpec => {
  const v = specs[s];
  if (v === undefined) throw new Error(`no spec ${s}`);
  return v;
};

function tmpProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v2-rules-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const blocking = (res: ReturnType<typeof checkSource>): string[] => res.findings.filter((f) => f.tier === 'blocking').map((f) => f.ruleId);

describe('rule metadata', () => {
  it('STYLE_RULE_SOURCES is the table of Docs/v1.3/style-rule-sources.md, row for row', () => {
    const doc = fs.readFileSync(path.join(REPO, 'Docs/v1.3/style-rule-sources.md'), 'utf8');
    const rows = doc
      .split('\n')
      .filter((l) => l.startsWith('| ') && !l.startsWith('| Style') && !l.startsWith('|---'))
      .map((l) => l.slice(2, -2).split(' | '))
      .map(([style, rule, source, constraint]) => ({ style, rule, source, constraint }));
    expect(rows).toEqual([...STYLE_RULE_SOURCES]);
  });

  it('every finding carries the v1.3 tier of its style (FF-S03 blocking only in layered)', () => {
    expect(specRuleMeta(spec('layered'), { id: 'FF-S03', name: 'no-layer-skip' }).tier).toBe('blocking');
    expect(specRuleMeta(spec('clean-architecture'), { id: 'FF-S03', name: 'no-layer-skip' }).tier).toBe('advisory');
    expect(specRuleMeta(spec('hexagonal'), { id: 'FF-S03', name: 'layer-skip-graph' }).tier).toBe('advisory');
    expect(specRuleMeta(spec('ddd'), { id: 'FF-DS02', name: 'context-isolation' }).tier).toBe('blocking');
    expect(specRuleMeta(spec('ddd'), { id: 'FF-DT05', name: 'domain-event-placement' }).tier).toBe('advisory');
  });

  it('gives the literature row of the style, or of the style the preset composes', () => {
    const layered = specRuleMeta(spec('layered'), { id: 'FF-S01', name: 'dependency-direction' });
    expect(layered).toMatchObject({ sourceRow: 'style', edgeView: 'literal' });
    expect(layered.source).toMatch(/^Fowler, \*Patterns of Enterprise Application Architecture\*/);
    const nest = specRuleMeta(spec('nestjs'), { id: 'FF-S01', name: 'dependency-direction' });
    expect(nest.sourceRow).toBe('composed');
    expect(nest.source).toMatch(/Martin, \*Clean Architecture\*.*Clean row; the NestJS preset composes it/);
    const purity = specRuleMeta(spec('ddd'), { id: 'FF-DT04', name: 'domain-purity' });
    expect(purity).toMatchObject({ sourceRow: 'style', edgeView: 'resolved' });
    expect(purity.source).toMatch(/Evans 2003, ch\. 4/);
  });

  it('every fast rule and hint has a construct; hints are advisory with the APG v2 candidate tier', () => {
    for (const n of [...FAST_RULE_NAMES, ...APG2_HINT_NAMES, ...CHEAP_HINT_NAMES]) expect(CONSTRUCTS[n]).toBeDefined();
    expect(hintMeta('apg2', 'io-outside-adapters')).toMatchObject({ ruleId: 'APG2.io-outside-adapters', tier: 'advisory', tierSource: 'hint', candidateTier: 'blocking' });
    expect(hintMeta('cheap', 'repository-bypass')).toMatchObject({ ruleId: 'CHEAP.repository-bypass', tier: 'advisory' });
    expect(hintMeta('cheap', 'repository-bypass').candidateTier).toBeUndefined();
  });

  it('v1.3 status is the compiler\'s: FF-P06 is not applicable in layered (ADR-V13-02 draft)', () => {
    expect(v13RuleStates(spec('layered')).get('FF-P06')?.status).toBe('not-applicable');
    expect(v13RuleStates(spec('clean-architecture')).get('FF-P06')?.status).toBe('active');
    expect(v13RuleStates(spec('hexagonal')).get('FF-S01')?.status).toBe('active');
  });

  it('role names are camel-case suffixes (v1.3), not substrings', () => {
    expect(endsWithRole('OrderRepository', ['Repository', 'Repo'])).toBe(true);
    expect(endsWithRole('OrderRepositoryImpl', ['Repository'])).toBe(true);
    expect(endsWithRole('CsvReportWriter', ['Repository', 'Repo'])).toBe(false);
    expect(endsWithRole('GatewayRetryPolicy', ['Gateway'])).toBe(false);
  });
});

describe('fast spec rules', () => {
  it('hexagonal: dependency-direction-graph and core-isolation block, layer-skip-graph is advisory', () => {
    const s = spec('hexagonal');
    const core = checkSource(s, { path: 'src/domain/services/P.ts', content: "import { A } from '../../application/ports/out/A';\nexport class P {}" });
    expect(blocking(core).sort()).toEqual(['FF-S01', 'FF-S04']);
    expect(core.blockingVerdict).toBe('block');
    const sideways = checkSource(s, { path: 'src/adapters/inbound/http/C.ts', content: "import { R } from '../../outbound/persistence/R';\nexport class C {}" });
    expect(sideways.findings.map((f) => [f.ruleId, f.tier])).toEqual([['FF-S03', 'advisory']]);
    expect(sideways.blockingVerdict).toBe('pass');
    const fine = checkSource(s, { path: 'src/adapters/inbound/http/C.ts', content: "import { U } from '../../../application/services/U';\nexport class C {}" });
    expect(fine.findings).toEqual([]);
  });

  it('style applicability: FF-P06 is checked in clean, not in layered; FF-S03 blocks in layered only', () => {
    const ctor = "import { Db } from '../../persistence/Database';\nexport class S { constructor(private readonly db: Db) {} }";
    const layered = checkSource(spec('layered'), { path: 'src/business/services/S.ts', content: ctor });
    expect(layered.findings.map((f) => f.ruleId)).not.toContain('FF-P06');
    const clean = checkSource(spec('clean-architecture'), {
      path: 'src/domain/services/S.ts',
      content: "import { SystemClock } from '../../infrastructure/system/SystemClock';\nexport class S { constructor(private readonly clock: SystemClock) {} }",
    });
    expect(blocking(clean).sort()).toEqual(['FF-P06', 'FF-S01', 'FF-S04']);
    const p06 = clean.findings.find((f) => f.ruleId === 'FF-P06');
    expect(p06).toMatchObject({ line: 2, tier: 'blocking', edgeView: 'none', location: 'src/domain/services/S.ts:2', check: 'spec' });
    expect(p06?.construct).toMatch(/Core isolation of state/);
    const skip = checkSource(spec('layered'), { path: 'src/presentation/http/C.ts', content: "import { G } from '../../persistence/ProductGateway';\nexport class C {}" });
    expect(blocking(skip)).toEqual(['FF-S03']);
  });

  it('repository-pattern and port-adapter-pattern use role tokens and need a port', () => {
    const noPort = checkSource(spec('clean-architecture'), { path: 'src/infrastructure/persistence/InMemoryLoanRepository.ts', content: 'export class InMemoryLoanRepository {}' });
    expect(blocking(noPort)).toEqual(['FF-P03']);
    const notRepo = checkSource(spec('clean-architecture'), { path: 'src/infrastructure/http/CsvReportWriter.ts', content: 'export class CsvReportWriter {}' });
    expect(blocking(notRepo)).toEqual([]);
    const root = tmpProject({
      'src/application/ports/out/RoomRepository.ts': 'export interface RoomRepository { all(): string[] }\n',
      'src/adapters/outbound/persistence/RoomStore.ts': 'export interface RoomStore { all(): string[] }\n',
    });
    try {
      const view = new ProjectView({ root });
      const good = checkSource(spec('hexagonal'), { view, path: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts', content: "import type { RoomRepository } from '../../../application/ports/out/RoomRepository';\nexport class InMemoryRoomRepository implements RoomRepository { all() { return []; } }" });
      expect(blocking(good)).toEqual([]);
      const local = checkSource(spec('hexagonal'), { view, path: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts', content: "import type { RoomStore } from './RoomStore';\nexport class InMemoryRoomRepository implements RoomStore { all() { return []; } }" });
      expect(blocking(local)).toEqual(['FF-P03']);
      const helper = checkSource(spec('hexagonal'), { view, path: 'src/adapters/outbound/payment/GatewayRetryPolicy.ts', content: 'export class GatewayRetryPolicy {}' });
      expect(blocking(helper)).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ddd: context isolation (literal view, public API and ACL), aggregate boundary, repositories, value objects, modules', () => {
    const s = spec('ddd');
    const deep = checkSource(s, { path: 'src/billing/application/IssueInvoice.ts', content: "import { Order } from '../../ordering/domain/order/Order.js';\nexport class IssueInvoice {}" });
    expect(blocking(deep)).toEqual(['FF-DS02']);
    expect(deep.findings[0]?.source).toMatch(/Evans 2003, ch\. 14/);
    const viaApi = checkSource(s, { path: 'src/billing/application/IssueInvoice.ts', content: "import { OrderSummary } from '../../ordering/index.js';\nexport class IssueInvoice {}" });
    expect(blocking(viaApi)).toEqual([]);
    const acl = checkSource(s, { path: 'src/billing/acl/OrderingAcl.ts', content: "import { OrderId } from '../../ordering/domain/order/value-objects/OrderId.js';\nexport class OrderingAcl {}" });
    expect(blocking(acl)).toEqual([]);
    const inner = checkSource(s, { path: 'src/ordering/application/GetOrderSummary.ts', content: "import type { OrderLine } from '../domain/order/OrderLine.js';\nexport class GetOrderSummary {}" });
    expect(blocking(inner)).toEqual(['FF-DT01']);
    const repo = checkSource(s, { path: 'src/ordering/domain/order/OrderLineRepository.ts', content: "import type { OrderLine } from './OrderLine.js';\nexport interface OrderLineRepository { save(l: OrderLine): Promise<void> }" });
    expect(blocking(repo)).toEqual(['FF-DT02']);
    const vo = checkSource(s, { path: 'src/ordering/domain/value-objects/Quantity.ts', content: 'export class Quantity {\n  constructor(private amount: number) {}\n  set value(v: number) { this.amount = v; }\n}' });
    expect(blocking(vo)).toEqual(['FF-DT03']);
    expect(vo.findings[0]?.reason).toMatch(/Quantity\.value \(set accessor\)/);
    const stray = checkSource(s, { path: 'src/utils/formatCurrency.ts', content: 'export const f = (n: number): string => String(n);' });
    expect(blocking(stray)).toEqual(['FF-DS01']);
    const up = checkSource(s, { path: 'src/ordering/domain/customer/Customer.ts', content: "import { PlaceOrder } from '../../application/PlaceOrder.js';\nexport class Customer {}" });
    expect(blocking(up)).toEqual(['FF-S01']);
    const event = checkSource(s, { path: 'src/billing/application/InvoiceIssued.ts', content: "import type { DomainEvent } from '../../shared-kernel/DomainEvent.js';\nexport class InvoiceIssued implements DomainEvent {}" });
    expect(event.findings.map((f) => [f.ruleId, f.tier])).toEqual([['FF-DT05', 'advisory']]);
  });

  it('resolved view: an aggregate\'s inner entity and a framework package reached through a barrel', () => {
    const root = tmpProject({
      'src/ordering/domain/order/index.ts': "export { OrderLine } from './OrderLine.js';\n",
      'src/ordering/domain/order/OrderLine.ts': 'export class OrderLine {}\n',
      'src/billing/domain/index.ts': "export { Expose } from 'class-transformer';\n",
    });
    try {
      const view = new ProjectView({ root });
      const s = spec('ddd');
      const viaBarrel = checkSource(s, { view, path: 'src/ordering/application/Q.ts', content: "import { OrderLine } from '../domain/order/index.js';\nexport class Q {}" });
      const dt01 = viaBarrel.findings.find((f) => f.ruleId === 'FF-DT01');
      expect(dt01).toMatchObject({ target: 'src/ordering/domain/order/OrderLine.ts', viaBarrels: ['src/ordering/domain/order/index.ts'], edgeView: 'resolved' });
      const purity = checkSource(s, { view, path: 'src/billing/domain/invoice/Invoice.ts', content: "import { Expose } from '../index.js';\nexport class Invoice {}" });
      expect(blocking(purity)).toEqual(['FF-DT04']);
      // Spec-only (no root): the barrel is not followed, so neither is reported.
      expect(blocking(checkSource(s, { path: 'src/ordering/application/Q.ts', content: "import { OrderLine } from '../domain/order/index.js';\nexport class Q {}" }))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('cycles: with a project root, an import that closes a cycle blocks; without one, FF-S02 is listed as not checked', () => {
    const root = tmpProject({ 'src/domain/entities/Member.ts': "import { Loan } from './Loan';\nexport class Member {}\n", 'src/domain/entities/Loan.ts': 'export class Loan {}\n' });
    try {
      const content = "import { Member } from './Member';\nexport class Loan {}\n";
      const view = new ProjectView({ root, overrides: new Map([['src/domain/entities/Loan.ts', content]]) });
      const res = checkSource(spec('clean-architecture'), { view, path: 'src/domain/entities/Loan.ts', content });
      expect(blocking(res)).toEqual(['FF-S02']);
      expect(res.findings[0]?.reason).toMatch(/Loan\.ts -> src\/domain\/entities\/Member\.ts -> src\/domain\/entities\/Loan\.ts/);
      expect(res.projectAware).toBe(true);
      const specOnly = checkSource(spec('clean-architecture'), { path: 'src/domain/entities/Loan.ts', content });
      expect(blocking(specOnly)).toEqual([]);
      expect(specOnly.notChecked.find((n) => n.ruleId === 'FF-S02')?.reason).toMatch(/whole import graph/);
      expect(specOnly.notChecked.map((n) => n.ruleId)).toContain('FF-C01');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the v1 fields: violations and verdict are the import and naming rules, findings adds the rest', () => {
    const res = checkSource(spec('clean-architecture'), { path: 'src/infrastructure/persistence/InMemoryLoanRepository.ts', content: 'export class InMemoryLoanRepository {}' });
    expect(res.violations).toEqual([]);
    expect(res.verdict).toBe('clean');
    expect(res.findings.map((f) => f.ruleId)).toEqual(['FF-P03']);
    expect(res.blockingSummary).toMatch(/^BLOCK: 1 blocking violation\(s\) of FF-P03/);
  });
});

describe('advisory hints', () => {
  it('boundary-type-leak: an application signature naming an infrastructure type (composition roots exempt)', () => {
    const root = tmpProject({ 'src/infrastructure/http/HttpTypes.ts': 'export interface HttpRequest { body: unknown }\n' });
    try {
      const view = new ProjectView({ root });
      const s = spec('clean-architecture');
      const content = "import type { HttpRequest } from '../../infrastructure/http/HttpTypes';\nexport function toDto(req: HttpRequest): string { return ''; }\n";
      const res = checkSource(s, { view, path: 'src/application/dto/LoanDto.ts', content });
      const leak = res.hints.find((h) => h.ruleId === 'APG2.boundary-type-leak');
      expect(leak).toMatchObject({ tier: 'advisory', candidateTier: 'blocking', check: 'apg2', target: 'src/infrastructure/http/HttpTypes.ts' });
      expect(checkSource(s, { view, path: 'src/application/main.ts', content }).hints.filter((h) => h.ruleId === 'APG2.boundary-type-leak')).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('io-outside-adapters and nondeterminism-in-core in the core; nothing in infrastructure', () => {
    const s = spec('clean-architecture');
    const content = "import { readFileSync } from 'fs';\nimport axios from 'axios';\nexport class R {\n  load() { readFileSync('x'); return axios.get('u'); }\n  now() { return Date.now() + Math.random(); }\n}\n";
    const res = checkSource(s, { path: 'src/application/use-cases/R.ts', content });
    expect(res.hints.map((h) => [h.ruleId, h.subject])).toEqual([
      ['APG2.io-outside-adapters', 'R: fs:readFileSync'],
      ['APG2.io-outside-adapters', 'R: axios:axios.get'],
      ['APG2.nondeterminism-in-core', 'R: Date.now'],
      ['APG2.nondeterminism-in-core', 'R: Math.random'],
    ]);
    expect(res.blockingVerdict).toBe('pass');
    expect(checkSource(s, { path: 'src/infrastructure/R.ts', content }).hints).toEqual([]);
  });

  it('deep-import-declared-api: a DDD context past its declared public API (ACL exempt)', () => {
    const s = spec('ddd');
    const res = checkSource(s, { path: 'src/billing/api/InvoiceController.ts', content: "import { GetOrderSummary } from '../../ordering/application/GetOrderSummary.js';\nexport class InvoiceController {}" });
    expect(res.hints.map((h) => h.ruleId)).toContain('APG2.deep-import-declared-api');
    const acl = checkSource(s, { path: 'src/billing/acl/OrderingAcl.ts', content: "import { OrderId } from '../../ordering/domain/order/value-objects/OrderId.js';\nexport class OrderingAcl {}" });
    expect(acl.hints.map((h) => h.ruleId)).not.toContain('APG2.deep-import-declared-api');
  });

  it('deep-import-inferred-api: a layer with a root index.ts, imported past it (with a project root)', () => {
    const root = tmpProject({ 'src/business/index.ts': "export * from './model/Money';\n", 'src/business/model/Money.ts': 'export class Money {}\n' });
    try {
      const res = checkSource(spec('layered'), { view: new ProjectView({ root }), path: 'src/presentation/views/V.ts', content: "import { Money } from '../../business/model/Money';\nexport class V {}" });
      expect(res.hints.map((h) => h.ruleId)).toEqual(['APG2.deep-import-inferred-api']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('cheap proxies: repository bypass and framework types in core signatures', () => {
    const s = spec('clean-architecture');
    const bypass = checkSource(s, {
      path: 'src/application/use-cases/Report.ts',
      content: "import { getRepository, DataSource } from 'typeorm';\nexport class Report {\n  constructor(private readonly ds: DataSource) {}\n  run() { getRepository('x'); return this.ds.query('select 1'); }\n}\n",
    });
    expect(bypass.hints.filter((h) => h.ruleId === 'CHEAP.repository-bypass').map((h) => h.line)).toEqual([4, 4]);
    const repoClass = checkSource(s, { path: 'src/application/OrderRepository.ts', content: "import { getRepository } from 'typeorm';\nexport class OrderRepository { a() { return getRepository('x'); } }" });
    expect(repoClass.hints.filter((h) => h.ruleId === 'CHEAP.repository-bypass')).toEqual([]);
    const fw = checkSource(s, { path: 'src/application/use-cases/P.ts', content: "import type { Request } from 'express';\nexport class P { execute(req: Request): void {} }" });
    expect(fw.hints.map((h) => [h.ruleId, h.check])).toEqual([['CHEAP.framework-in-core', 'cheap']]);
  });
});
